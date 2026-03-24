import { fetchWithBrowser } from "./browser.js";
import * as cheerio from "cheerio";

const MIN_PRICE = 49;
const MAX_PRICE = 8000;

const URLS = [
  "https://www.bilka.dk/lego/",
  "https://www.bilka.dk/search?q=lego+star+wars",
  "https://www.bilka.dk/search?q=lego+technic",
  "https://www.bilka.dk/search?q=lego+city",
  "https://www.bilka.dk/search?q=lego+ninjago",
  "https://www.bilka.dk/search?q=lego+creator",
  "https://www.bilka.dk/search?q=lego+friends",
];

export async function scrapeBilka() {
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
              store: "Bilka DK",
              store_url: item.offers?.url ?? "https://www.bilka.dk",
              price_local: price,
              currency: "DKK",
              image_url: Array.isArray(item.image) ? item.image[0] : item.image ?? null,
              in_stock: item.offers?.availability?.includes("InStock") ? 1 : 0,
            });
          }
        } catch {}
      });

      $("[class*='product'], [data-testid*='product']").each((_, el) => {
        const $el = $(el);
        const name = $el.find("[class*='name'], [class*='title'], h2, h3").first().text().trim();
        if (!name?.toLowerCase().includes("lego")) return;
        if (seen.has(name)) return;
        let price = 0;
        $el.find("[class*='price']").each((__, p) => {
          const num = parseFloat($(p).text().replace(/\s/g,"").replace(/\.-$/,"").replace(",",".").replace(/[^0-9.]/g,""));
          if (num >= MIN_PRICE && num <= MAX_PRICE) price = num;
        });
        if (!price) return;
        seen.add(name);
        const link = $el.find("a").first().attr("href");
        results.push({
          set_number: name.match(/\b(\d{5})\b/)?.[1] ?? null,
          name: name.substring(0, 200),
          store: "Bilka DK",
          store_url: link ? (link.startsWith("http") ? link : `https://www.bilka.dk${link}`) : "https://www.bilka.dk",
          price_local: price,
          currency: "DKK",
          image_url: $el.find("img").first().attr("src") ?? null,
          in_stock: 1,
        });
      });
    } catch (e) {
      console.error("[Bilka]", e.message);
    }
  }

  console.log(`[Bilka] Scraped ${results.length} products`);
  return results;
}
