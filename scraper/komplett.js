import { fetchWithBrowser } from "./browser.js";
import * as cheerio from "cheerio";

const MIN_PRICE = 49;
const MAX_PRICE = 8000;

const URLS = [
  "https://www.komplett.no/search?q=lego+star+wars&brands=LEGO",
  "https://www.komplett.no/search?q=lego+technic&brands=LEGO",
  "https://www.komplett.no/search?q=lego+city&brands=LEGO",
  "https://www.komplett.no/search?q=lego+ninjago&brands=LEGO",
  "https://www.komplett.no/search?q=lego+creator&brands=LEGO",
  "https://www.komplett.no/search?q=lego+friends&brands=LEGO",
  "https://www.komplett.no/search?q=lego+harry+potter&brands=LEGO",
  "https://www.komplett.no/search?q=lego&brands=LEGO",
];

export async function scrapeKomplett() {
  const results = [];
  const seen = new Set();

  for (const url of URLS) {
    try {
      const html = await fetchWithBrowser(url, 5000);
      const $ = cheerio.load(html);

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

      if (!results.length) {
        $("[class*='product'], [class*='Product']").each((_, el) => {
          const $el = $(el);
          const name = $el.find("[class*='name'], [class*='title'], h2, h3").first().text().trim();
          if (!name?.toLowerCase().includes("lego")) return;
          if (seen.has(name)) return;
          let price = 0;
          $el.find("[class*='price'], [class*='Price']").each((__, p) => {
            const num = parseFloat($(p).text().replace(/\s/g,"").replace(/\.-$/,"").replace(",",".").replace(/[^0-9.]/g,""));
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
    } catch (e) {
      console.error("[Komplett]", e.message);
    }
  }

  console.log(`[Komplett] Scraped ${results.length} products`);
  return results;
}
