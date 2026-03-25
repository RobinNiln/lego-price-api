import { fetchWithBrowser } from "./browser.js";
import * as cheerio from "cheerio";

const MIN_PRICE = 49;
const MAX_PRICE = 8000;

// Komplett has many LEGO pages – scrape multiple pages per category
const SEARCHES = [
  "lego+star+wars",
  "lego+technic",
  "lego+city",
  "lego+ninjago",
  "lego+creator",
  "lego+friends",
  "lego+harry+potter",
  "lego+icons",
  "lego+minecraft",
  "lego+ideas",
  "lego",
];

export async function scrapeKomplett() {
  const results = [];
  const seen = new Set();

  for (const query of SEARCHES) {
    // Scrape up to 3 pages per search
    for (let page = 1; page <= 3; page++) {
      const url = `https://www.komplett.no/search?q=${query}&brands=LEGO${page > 1 ? `&page=${page}` : ""}`;
      try {
        const html = await fetchWithBrowser(url, 5000);
        const $ = cheerio.load(html);
        let foundOnPage = 0;

        // JSON-LD first
        $("script[type='application/ld+json']").each((_, el) => {
          try {
            const data = JSON.parse($(el).html());
            const items = Array.isArray(data) ? data : [data];
            for (const item of items) {
              if (item["@type"] !== "Product") continue;
              if (!item.name?.toLowerCase().includes("lego")) continue;
              if (seen.has(item.name)) continue;
              const price = parseFloat(item.offers?.price ?? 0);
              if (price < MIN_PRICE || price > MAX_PRICE) continue;
              seen.add(item.name);
              foundOnPage++;
              results.push({
                set_number: item.name?.match(/\b(\d{5})\b/)?.[1] ?? null,
                name: item.name,
                store: "Komplett NO",
                store_url: item.offers?.url ?? "https://www.komplett.no",
                price_local: price,
                currency: "NOK",
                image_url: Array.isArray(item.image) ? item.image[0] : item.image ?? null,
                in_stock: item.offers?.availability?.includes("InStock") ? 1 : 0,
              });
            }
          } catch {}
        });

        // DOM fallback
        if (foundOnPage === 0) {
          $("[class*='product'], [class*='Product']").each((_, el) => {
            const $el = $(el);
            const name = $el.find("[class*='name'], [class*='title'], h2, h3").first().text().trim();
            if (!name?.toLowerCase().includes("lego")) return;
            if (seen.has(name)) return;
            let price = 0;
            $el.find("[class*='price'], [class*='Price']").each((__, p) => {
              const num = parseFloat($(p).text().replace(/\s/g, "").replace(/:-$/, "").replace(",", ".").replace(/[^0-9.]/g, ""));
              if (num >= MIN_PRICE && num <= MAX_PRICE) price = num;
            });
            if (!price) return;
            seen.add(name);
            const link = $el.find("a").first().attr("href");
            results.push({
              set_number: name.match(/\b(\d{5})\b/)?.[1] ?? null,
              name: name.substring(0, 200),
              store: "Komplett NO",
              store_url: link ? (link.startsWith("http") ? link : `https://www.komplett.no${link}`) : "https://www.komplett.no",
              price_local: price,
              currency: "NOK",
              image_url: $el.find("img").first().attr("src") ?? null,
              in_stock: 1,
            });
          });
        }

        // Stop paginating if no new products found
        if (foundOnPage === 0) break;
      } catch (e) {
        console.error("[Komplett]", e.message);
        break;
      }
    }
  }

  console.log(`[Komplett] Scraped ${results.length} products`);
  return results;
}
