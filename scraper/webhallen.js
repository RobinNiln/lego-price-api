import { fetchWithBrowser } from "./browser.js";
import * as cheerio from "cheerio";

const MIN_PRICE = 49;
const MAX_PRICE = 15000;

// Webhallen category pages – stable IDs, more reliable than search
const URLS = [
  "https://www.webhallen.com/se/manufacturer/549-LEGO?pagesize=100",
  "https://www.webhallen.com/se/category/56-LEGO?pagesize=100",
  "https://www.webhallen.com/se/category/3156-LEGO-Technic?pagesize=100",
  "https://www.webhallen.com/se/category/3144-LEGO?pagesize=100",
];

export async function scrapeWebhallen() {
  const results = [];
  const seen = new Set();

  for (const url of URLS) {
    try {
      // Extra long wait – Webhallen is a heavy React app
      const html = await fetchWithBrowser(url, 12000);
      const $ = cheerio.load(html);

      // Strategy 1: JSON-LD
      $("script[type='application/ld+json']").each((_, el) => {
        try {
          const data = JSON.parse($(el).html());
          const items = Array.isArray(data) ? data : [data];
          for (const item of items) {
            if (item["@type"] !== "Product") continue;
            if (!item.name?.toLowerCase().includes("lego")) continue;
            const price = parseFloat(item.offers?.price ?? 0);
            if (price < MIN_PRICE || price > MAX_PRICE) continue;
            if (seen.has(item.name)) continue;
            seen.add(item.name);
            results.push({
              set_number: item.name?.match(/\b(\d{5,6})\b/)?.[1] ?? null,
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

      // Strategy 2: DOM scraping with multiple selector attempts
      if (results.length === 0) {
        const selectors = [
          "[data-product-id]",
          "[class*='product-card']",
          "[class*='ProductCard']",
          "[class*='item-card']",
          "li[class*='product']",
          "article",
        ];

        for (const sel of selectors) {
          const cards = $(sel);
          if (cards.length < 3) continue;
          console.log(`[Webhallen] ${sel}: ${cards.length} items`);

          cards.each((_, el) => {
            const $el = $(el);
            const name =
              $el.attr("data-product-name") ??
              $el.find("h2, h3, [class*='name'], [class*='title']").first().text().trim();
            if (!name?.toLowerCase().includes("lego")) return;
            if (seen.has(name)) return;

            let price = parseFloat($el.attr("data-price") ?? $el.attr("data-product-price") ?? "0");
            if (!price || price < MIN_PRICE || price > MAX_PRICE) {
              $el.find("[class*='price'], [class*='Price']").each((__, p) => {
                if ($(p).attr("class")?.match(/old|was|before|crossed/i)) return;
                const num = parseFloat(
                  $(p).text().replace(/\s/g, "").replace(/:-$/, "").replace(",", ".").replace(/[^0-9.]/g, "")
                );
                if (num >= MIN_PRICE && num <= MAX_PRICE) price = num;
              });
            }
            if (!price) return;
            seen.add(name);

            const link =
              $el.find("a[href*='/se/product/']").first().attr("href") ??
              $el.find("a").first().attr("href");
            const img =
              $el.find("img").first().attr("src") ??
              $el.find("img").first().attr("data-src") ??
              null;

            results.push({
              set_number: name.match(/\b(\d{5,6})\b/)?.[1] ?? null,
              name: name.substring(0, 200),
              store: "Webhallen",
              store_url: link
                ? link.startsWith("http") ? link : `https://www.webhallen.com${link}`
                : url,
              price_local: price,
              currency: "SEK",
              image_url: img,
              in_stock: 1,
            });
          });
          if (results.length > 0) break;
        }
      }

      console.log(`[Webhallen] After ${url}: ${results.length} total`);
    } catch (e) {
      console.error(`[Webhallen] ${url}:`, e.message);
    }
  }

  console.log(`[Webhallen] Total: ${results.length} products`);
  return results;
}
