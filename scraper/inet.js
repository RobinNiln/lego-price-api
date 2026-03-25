import * as cheerio from "cheerio";
import { fetchWithBrowser } from "./browser.js";

const URLS = [
  "https://www.inet.se/kategori/370/lego",
  "https://www.inet.se/kategori/370/lego?page=2",
  "https://www.inet.se/kategori/370/lego?page=3",
  "https://www.inet.se/kategori/370/lego?page=4",
];

export async function scrapeInet() {
  const results = [];
  const seen = new Set();

  for (const url of URLS) {
    try {
      const html = await fetchWithBrowser(url, 8000);
      const $ = cheerio.load(html);
      let foundOnPage = 0;

      // Strategy 1: JSON-LD
      $("script[type='application/ld+json']").each((_, el) => {
        try {
          const data = JSON.parse($(el).html());
          const items = Array.isArray(data) ? data : [data];
          for (const item of items) {
            if (item["@type"] !== "Product") continue;
            const price = parseFloat(item.offers?.price ?? 0);
            if (price < 49 || price > 15000) continue;
            if (seen.has(item.name)) continue;
            seen.add(item.name);
            foundOnPage++;
            results.push({
              set_number: item.name?.match(/\b(\d{5})\b/)?.[1] ?? null,
              name: item.name,
              store: "Inet",
              store_url: item.offers?.url ?? "https://www.inet.se",
              price_local: price,
              currency: "SEK",
              image_url: Array.isArray(item.image) ? item.image[0] : item.image ?? null,
              in_stock: item.offers?.availability?.includes("InStock") ? 1 : 0,
            });
          }
        } catch {}
      });

      if (foundOnPage > 0) {
        console.log(`[Inet] ${url}: ${foundOnPage} via JSON-LD`);
        continue;
      }

      // DEBUG: logga klassnamn
      const cls = new Set();
      $("*").each((_, el) => {
        ($(el).attr("class") || "").split(" ").forEach(c => { if (c.length > 3) cls.add(c); });
      });
      console.log(`[Inet] ${url} - classes:`, [...cls].slice(0, 40).join(", "));

      // Strategy 2: DOM – NOTE: on Inet's category page ALL products are LEGO
      // so we do NOT filter by name containing "lego"
      const selectors = [
        "[class*='ProductCard']",
        "[class*='product-card']",
        "[class*='ProductItem']",
        "[class*='product-item']",
        "[data-testid*='product']",
        "article",
      ];

      for (const sel of selectors) {
        const cards = $(sel);
        if (cards.length < 3) continue;
        console.log(`[Inet] ${sel}: ${cards.length} items`);

        cards.each((_, el) => {
          const $el = $(el);
          // On Inet's category page products don't necessarily say "LEGO" in the name
          const name = $el.find("h2, h3, [class*='name'], [class*='title']").first().text().trim();
          if (!name || name.length < 3) return;
          if (seen.has(name)) return;

          let price = 0;
          $el.find("[class*='price'], [class*='Price']").each((__, p) => {
            const num = parseFloat(
              $(p).text().replace(/\s/g, "").replace(/:-$/, "").replace(",", ".").replace(/[^0-9.]/g, "")
            );
            if (num >= 49 && num <= 15000) price = num;
          });
          if (!price) return;
          seen.add(name);

          const link = $el.find("a").first().attr("href");
          results.push({
            set_number: name.match(/\b(\d{5})\b/)?.[1] ?? null,
            name: name.substring(0, 200),
            store: "Inet",
            store_url: link
              ? link.startsWith("http") ? link : `https://www.inet.se${link}`
              : "https://www.inet.se",
            price_local: price,
            currency: "SEK",
            image_url: $el.find("img").first().attr("src") ?? null,
            in_stock: 1,
          });
        });
        if (results.length > 0) break;
      }
    } catch (e) {
      console.error("[Inet]", e.message);
    }
  }

  console.log(`[Inet] Total: ${results.length} products`);
  return results;
}
