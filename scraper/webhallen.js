import { fetchWithBrowser } from "./browser.js";
import * as cheerio from "cheerio";

const URLS = [
  "https://www.webhallen.com/se/category/56-LEGO?pagesize=100",
  "https://www.webhallen.com/se/search?query=lego+star+wars&pageSize=40",
  "https://www.webhallen.com/se/search?query=lego+technic&pageSize=40",
  "https://www.webhallen.com/se/search?query=lego+city&pageSize=40",
  "https://www.webhallen.com/se/search?query=lego+ninjago&pageSize=40",
];

export async function scrapeWebhallen() {
  const results = [];
  const seen = new Set();

  for (const url of URLS) {
    try {
      // Use longer wait time to let JS render
      const html = await fetchWithBrowser(url, 8000);
      const $ = cheerio.load(html);

      // Log all classes with 'product' in name
      const cls = new Set();
      $("*").each((_, el) => {
        ($(el).attr("class") || "").split(" ").forEach(c => {
          if (c && c.length > 3 && (c.toLowerCase().includes("product") || c.toLowerCase().includes("item-card") || c.toLowerCase().includes("search-result"))) cls.add(c);
        });
      });
      console.log(`[Webhallen] classes:`, [...cls].slice(0, 15).join(", "));

      // Try JSON-LD
      $("script[type='application/ld+json']").each((_, el) => {
        try {
          const data = JSON.parse($(el).html());
          const items = Array.isArray(data) ? data : [data];
          for (const item of items) {
            if (item["@type"] !== "Product") continue;
            if (!item.name?.toLowerCase().includes("lego")) continue;
            const price = parseFloat(item.offers?.price ?? 0);
            if (price < 49 || price > 15000) continue;
            if (seen.has(item.name)) continue;
            seen.add(item.name);
            results.push({
              set_number: item.name?.match(/\b(\d{5})\b/)?.[1] ?? null,
              name: item.name,
              store: "Webhallen",
              store_url: item.offers?.url ?? url,
              price_local: price,
              currency: "SEK",
              image_url: Array.isArray(item.image) ? item.image[0] : item.image ?? null,
              in_stock: item.offers?.availability?.includes("InStock") ? 1 : 0,
            });
          }
        } catch {}
      });

      if (results.length > 0) {
        console.log(`[Webhallen] Found ${results.length} via JSON-LD`);
        continue;
      }

      // Try all product-related selectors
      const selectors = [
        "[class*='product']","[class*='Product']",
        "[class*='item-card']","[class*='ItemCard']",
        "[class*='search-result']","[data-product-id]",
        "li[class*='list']","article",
      ];

      for (const sel of selectors) {
        const found = $(sel);
        if (found.length < 3) continue;
        console.log(`[Webhallen] ${sel}: ${found.length} items`);
        found.each((_, el) => {
          const $el = $(el);
          const name = $el.find("h2, h3, [class*='name'], [class*='title']").first().text().trim();
          if (!name?.toLowerCase().includes("lego")) return;
          if (seen.has(name)) return;
          let price = 0;
          $el.find("[class*='price'], [class*='Price']").each((__, p) => {
            if ($(p).children("[class*='price']").length > 0) return;
            const num = parseFloat($(p).text().replace(/\s/g,"").replace(/\.-$/,"").replace(",",".").replace(/[^0-9.]/g,""));
            if (num >= 49 && num <= 15000) price = num;
          });
          if (!price) return;
          seen.add(name);
          const link = $el.find("a[href*='/se/product/']").first().attr("href");
          results.push({
            set_number: name.match(/\b(\d{5})\b/)?.[1] ?? null,
            name: name.substring(0, 200),
            store: "Webhallen",
            store_url: link ? `https://www.webhallen.com${link}` : url,
            price_local: price, currency: "SEK",
            image_url: $el.find("img").first().attr("src") ?? null,
            in_stock: 1,
          });
        });
        if (results.length > 0) break;
      }
    } catch (e) {
      console.error("[Webhallen]", e.message);
    }
  }

  console.log(`[Webhallen] Total: ${results.length} products`);
  return results;
}
