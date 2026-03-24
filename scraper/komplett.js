import { fetchWithBrowser } from "./browser.js";
import * as cheerio from "cheerio";

const MIN_PRICE = 49;
const MAX_PRICE = 80000; // NOK prices can be higher

export async function scrapeKomplett() {
  const results = [];
  try {
    const html = await fetchWithBrowser(
      "https://www.komplett.no/search?q=lego&brands=LEGO", 5000
    );
    const $ = cheerio.load(html);

    // JSON-LD
    $("script[type='application/ld+json']").each((_, el) => {
      try {
        const data = JSON.parse($(el).html());
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          if (item["@type"] !== "Product") continue;
          if (!item.name?.toLowerCase().includes("lego")) continue;
          const price = parseFloat(item.offers?.price ?? 0);
          if (price < MIN_PRICE || price > MAX_PRICE) continue;
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

    // Fallback
    if (!results.length) {
      $("[class*='product'], [class*='Product']").each((_, el) => {
        const $el = $(el);
        const name = $el.find("[class*='name'], [class*='title'], h2, h3").first().text().trim();
        if (!name?.toLowerCase().includes("lego")) return;

        let price = 0;
        $el.find("[class*='price'], [class*='Price']").each((__, p) => {
          const num = parseFloat($(p).text().replace(/\s/g,"").replace(/\.-$/,"").replace(",",".").replace(/[^0-9.]/g,""));
          if (num >= MIN_PRICE && num <= MAX_PRICE) price = num;
        });

        if (!price) return;
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

    console.log(`[Komplett] Scraped ${results.length} products`);
  } catch (e) {
    console.error("[Komplett]", e.message);
  }
  return results;
}
