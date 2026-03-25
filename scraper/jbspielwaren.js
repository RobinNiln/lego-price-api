import { fetchWithBrowser } from "./browser.js";
import * as cheerio from "cheerio";

const MIN_PRICE = 5;
const MAX_PRICE = 800;

// JB Spielwaren loads products via JS - needs Puppeteer
const URLS = [
  "https://www.jb-spielwaren.de/en/lego/",
  "https://www.jb-spielwaren.de/en/lego/?p=2",
  "https://www.jb-spielwaren.de/en/lego/?p=3",
  "https://www.jb-spielwaren.de/en/lego/lego-star-wars-tm/",
  "https://www.jb-spielwaren.de/en/lego/lego-technic/",
];

export async function scrapeJBSpielwaren() {
  const results = [];
  const seen = new Set();

  for (const url of URLS) {
    try {
      const html = await fetchWithBrowser(url, 7000);
      console.log(`[JB Spielwaren] ${url} - length: ${html.length}`);
      const $ = cheerio.load(html);

      let found = 0;

      // JSON-LD
      $("script[type='application/ld+json']").each((_, el) => {
        try {
          const data = JSON.parse($(el).html());
          const items = Array.isArray(data) ? data : [data];
          for (const item of items) {
            if (item["@type"] !== "Product") continue;
            if (seen.has(item.name)) continue;
            const price = parseFloat(item.offers?.price ?? item.offers?.lowPrice ?? 0);
            if (price < MIN_PRICE || price > MAX_PRICE) continue;
            seen.add(item.name);
            found++;
            results.push({
              set_number: item.name?.match(/\b(\d{5,6})\b/)?.[1] ?? null,
              name: item.name,
              store: "JB Spielwaren DE",
              store_url: item.offers?.url ?? item.url ?? "https://www.jb-spielwaren.de",
              price_local: price,
              currency: "EUR",
              image_url: Array.isArray(item.image) ? item.image[0] : item.image ?? null,
              in_stock: item.offers?.availability?.includes("InStock") ? 1 : 0,
            });
          }
        } catch {}
      });

      if (found > 0) { console.log(`[JB Spielwaren] ${found} via JSON-LD`); continue; }

      // Log classes after Puppeteer render to find product elements
      const cls = new Set();
      $("*").each((_, el) => {
        ($(el).attr("class") || "").split(" ").forEach(c => { if (c.length > 3) cls.add(c); });
      });
      console.log(`[JB Spielwaren] Rendered classes:`, [...cls].slice(0, 40).join(", "));

      // Shopware 6 product boxes
      const selectors = [
        ".product-box", ".product-info", ".card-body",
        "[class*='product-box']", "[class*='product-info']",
        ".cms-element-product-listing article",
        ".product-listing article",
      ];

      for (const sel of selectors) {
        const cards = $(sel);
        if (cards.length < 2) continue;
        console.log(`[JB Spielwaren] ${sel}: ${cards.length} items`);

        cards.each((_, el) => {
          const $el = $(el);
          const name = $el.find(".product-name, [class*='product-name'], h2, h3").first().text().trim();
          if (!name || name.length < 5) return;
          if (seen.has(name)) return;

          let price = 0;
          $el.find("[class*='price']").each((__, p) => {
            const text = $(p).text().trim();
            const num = parseFloat(text.replace(/[€\s]/g, "").replace(",", ".").replace(/[^0-9.]/g, ""));
            if (num >= MIN_PRICE && num <= MAX_PRICE) price = num;
          });
          if (!price) return;

          seen.add(name);
          const link = $el.find("a").first().attr("href");
          results.push({
            set_number: name.match(/\b(\d{5,6})\b/)?.[1] ?? null,
            name: name.substring(0, 200),
            store: "JB Spielwaren DE",
            store_url: link ? (link.startsWith("http") ? link : `https://www.jb-spielwaren.de${link}`) : "https://www.jb-spielwaren.de",
            price_local: price,
            currency: "EUR",
            image_url: $el.find("img").first().attr("src") ?? null,
            in_stock: 1,
          });
        });
        if (results.length > 0) break;
      }
    } catch (e) {
      console.error("[JB Spielwaren]", e.message);
    }
  }

  console.log(`[JB Spielwaren] Scraped ${results.length} products`);
  return results;
}
