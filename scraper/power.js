import { fetchWithBrowser } from "./browser.js";
import * as cheerio from "cheerio";

const MIN_PRICE = 49;
const MAX_PRICE = 8000;

const SEARCHES = [
  "lego+star+wars",
  "lego+technic",
  "lego+city",
  "lego+harry+potter",
  "lego+ninjago",
  "lego+creator",
  "lego+friends",
  "lego+icons",
  "lego+minecraft",
];

export async function scrapePower() {
  const results = [];
  const seen = new Set();

  for (const query of SEARCHES) {
    const url = `https://www.power.se/search/?q=${query}&start=0&sz=60`;
    try {
      const html = await fetchWithBrowser(url, 8000);
      const $ = cheerio.load(html);
      let foundOnPage = 0;

      // Strategy 1: JSON-LD (most reliable)
      $("script[type='application/ld+json']").each((_, el) => {
        try {
          const data = JSON.parse($(el).html());
          const items = Array.isArray(data) ? data : [data];
          for (const item of items) {
            if (item["@type"] !== "Product") continue;
            if (!item.name?.toLowerCase().includes("lego")) continue;
            const price = parseFloat(item.offers?.price ?? item.offers?.lowPrice ?? 0);
            if (price < MIN_PRICE || price > MAX_PRICE) continue;
            if (seen.has(item.name)) continue;
            seen.add(item.name);
            foundOnPage++;
            results.push({
              set_number: item.name?.match(/\b(\d{5})\b/)?.[1] ?? null,
              name: item.name,
              store: "Power",
              store_url: item.offers?.url ?? item.url ?? "https://www.power.se",
              price_local: price,
              currency: "SEK",
              image_url: Array.isArray(item.image) ? item.image[0] : item.image ?? null,
              in_stock: item.offers?.availability?.includes("InStock") ? 1 : 0,
            });
          }
        } catch {}
      });

      if (foundOnPage > 0) {
        console.log(`[Power] "${query}": ${foundOnPage} via JSON-LD`);
        continue;
      }

      // Strategy 2: DOM – try data attributes first (most stable)
      const cards = $("[data-product-id], [data-pid]");
      if (cards.length > 0) {
        console.log(`[Power] "${query}": ${cards.length} data-product-id cards`);
        cards.each((_, el) => {
          const $el = $(el);
          const name =
            $el.attr("data-product-name") ??
            $el.find("[class*='title'], [class*='name'], h2, h3").first().text().trim();
          if (!name?.toLowerCase().includes("lego")) return;
          if (seen.has(name)) return;

          let price = parseFloat($el.attr("data-price") ?? $el.attr("data-product-price") ?? "0");
          if (!price || price < MIN_PRICE || price > MAX_PRICE) {
            $el.find("[class*='price']").each((__, p) => {
              if ($(p).attr("class")?.match(/old|was|before|strike/i)) return;
              const num = parseFloat(
                $(p).text().replace(/\s/g, "").replace(/:-$/, "").replace(",", ".").replace(/[^0-9.]/g, "")
              );
              if (num >= MIN_PRICE && num <= MAX_PRICE) price = num;
            });
          }
          if (!price) return;
          seen.add(name);

          const link = $el.find("a").first().attr("href");
          results.push({
            set_number: name.match(/\b(\d{5})\b/)?.[1] ?? null,
            name: name.substring(0, 200),
            store: "Power",
            store_url: link
              ? link.startsWith("http") ? link : `https://www.power.se${link}`
              : "https://www.power.se",
            price_local: price,
            currency: "SEK",
            image_url: $el.find("img").first().attr("src") ?? $el.find("img").first().attr("data-src") ?? null,
            in_stock: 1,
          });
        });
      }
    } catch (e) {
      console.error(`[Power] ${query}:`, e.message);
    }
  }

  console.log(`[Power] Scraped ${results.length} products`);
  return results;
}
