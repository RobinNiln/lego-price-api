import { fetchWithBrowser } from "./browser.js";
import * as cheerio from "cheerio";

const MIN_PRICE = 49;
const MAX_PRICE = 8000;

export async function scrapeEbrix() {
  const results = [];
  try {
    const html = await fetchWithBrowser("https://ebrix.se/lego", 5000);
    const $ = cheerio.load(html);

    // Try JSON-LD first
    $("script[type='application/ld+json']").each((_, el) => {
      try {
        const data = JSON.parse($(el).html());
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          if (item["@type"] !== "Product") continue;
          const price = parseFloat(item.offers?.price ?? 0);
          if (price < MIN_PRICE || price > MAX_PRICE) continue;
          results.push({
            set_number: item.name?.match(/\b(\d{5})\b/)?.[1] ?? null,
            name: item.name,
            store: "Ebrix",
            store_url: item.offers?.url ?? "https://ebrix.se",
            price_local: price,
            currency: "SEK",
            image_url: Array.isArray(item.image) ? item.image[0] : item.image ?? null,
            in_stock: item.offers?.availability?.includes("InStock") ? 1 : 0,
          });
        }
      } catch {}
    });

    // Fallback: product grid
    if (!results.length) {
      $("[class*='product'], [class*='Product']").each((_, el) => {
        const $el = $(el);
        const name = $el.find("[class*='name'], [class*='title'], h2, h3").first().text().trim();
        if (!name?.toLowerCase().includes("lego")) return;

        let price = 0;
        $el.find("[class*='price'], [class*='Price']").each((__, p) => {
          const text = $(p).text().trim();
          if (!text.match(/\d/) ) return;
          const num = parseFloat(text.replace(/\s/g, "").replace(/\.-$/, "").replace(",", ".").replace(/[^0-9.]/g, ""));
          if (num >= MIN_PRICE && num <= MAX_PRICE) price = num;
        });

        if (!price) return;
        const link = $el.find("a").first().attr("href");

        results.push({
          set_number: name.match(/\b(\d{5})\b/)?.[1] ?? null,
          name: name.substring(0, 200),
          store: "Ebrix",
          store_url: link ? (link.startsWith("http") ? link : `https://ebrix.se${link}`) : "https://ebrix.se",
          price_local: price,
          currency: "SEK",
          image_url: $el.find("img").first().attr("src") ?? null,
          in_stock: 1,
        });
      });
    }

    console.log(`[Ebrix] Scraped ${results.length} products`);
  } catch (e) {
    console.error("[Ebrix]", e.message);
  }
  return results;
}
