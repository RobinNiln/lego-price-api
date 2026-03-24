import { fetchWithBrowser } from "./browser.js";
import * as cheerio from "cheerio";

const MIN_PRICE = 49;
const MAX_PRICE = 8000;

// Power uses a search API – hit multiple category searches with pagination
const SEARCHES = [
  "lego+star+wars",
  "lego+technic",
  "lego+city",
  "lego+harry+potter",
  "lego+ninjago",
  "lego+creator",
  "lego+friends",
  "lego+icons",
];

function parsePriceSEK(text) {
  if (!text) return 0;
  // Handle "1 299:-", "429:-", "1299 kr", "429.00"
  const cleaned = text
    .replace(/\s/g, "")
    .replace(/:-$/, "")
    .replace(/kr$/i, "")
    .replace(",", ".")
    .replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);
  return num >= MIN_PRICE && num <= MAX_PRICE ? num : 0;
}

export async function scrapePower() {
  const results = [];
  const seen = new Set();

  for (const query of SEARCHES) {
    // Power paginates via &start=0, &start=24, etc.
    for (let start = 0; start <= 48; start += 24) {
      const url = `https://www.power.se/search/?q=${query}&start=${start}&sz=24`;
      try {
        const html = await fetchWithBrowser(url, 6000);
        const $ = cheerio.load(html);

        // Power's product cards – try multiple selector strategies
        const cardSelectors = [
          "[data-product-id]",
          "[class*='ProductCard']",
          "[class*='product-card']",
          "[class*='product-item']",
          "li[class*='product']",
        ];

        let found = false;
        for (const sel of cardSelectors) {
          const cards = $(sel);
          if (cards.length < 2) continue;
          found = true;

          cards.each((_, el) => {
            const $el = $(el);

            // Name – try data attribute first (most reliable), then text
            const name =
              $el.attr("data-product-name") ??
              $el.find("[class*='product-title'], [class*='ProductTitle'], [class*='name'], h2, h3")
                .first()
                .text()
                .trim();

            if (!name?.toLowerCase().includes("lego")) return;
            const key = $el.attr("data-product-id") ?? name;
            if (seen.has(key)) return;

            // Price – try data attribute first
            let price = parseFloat($el.attr("data-product-price") ?? "0");
            if (!price || price < MIN_PRICE || price > MAX_PRICE) {
              // Fallback: scrape price text
              const priceEl = $el
                .find(
                  "[class*='price']:not([class*='old']):not([class*='was']):not([class*='before'])"
                )
                .first();
              price = parsePriceSEK(priceEl.text());
            }

            if (!price) return;
            seen.add(key);

            const link = $el.find("a[href*='/product/'], a[href*='/p/']").first().attr("href")
              ?? $el.find("a").first().attr("href");
            const img =
              $el.find("img").first().attr("src") ??
              $el.find("img").first().attr("data-src") ??
              null;

            results.push({
              set_number: name.match(/\b(\d{5})\b/)?.[1] ?? null,
              name: name.substring(0, 200),
              store: "Power",
              store_url: link
                ? link.startsWith("http")
                  ? link
                  : `https://www.power.se${link}`
                : "https://www.power.se",
              price_local: price,
              currency: "SEK",
              image_url: img,
              in_stock: $el.attr("data-product-availability") !== "false" ? 1 : 0,
            });
          });

          if (found) break;
        }

        // If zero results on this page, stop paginating this query
        const beforeCount = results.length;
        if (!found || results.length === beforeCount) break;
      } catch (e) {
        console.error(`[Power] ${url}:`, e.message);
        break;
      }
    }
  }

  console.log(`[Power] Scraped ${results.length} products`);
  return results;
}
