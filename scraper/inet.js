import { fetchWithBrowser } from "./browser.js";
import * as cheerio from "cheerio";

export async function scrapeInet() {
  const results = [];
  try {
    const html = await fetchWithBrowser("https://www.inet.se/kategori/370/lego", 3000);
    const $ = cheerio.load(html);

    // Try JSON-LD structured data first
    $("script[type='application/ld+json']").each((_, el) => {
      try {
        const data = JSON.parse($(el).html());
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          if (item["@type"] !== "Product") continue;
          const price = parseFloat(item.offers?.price ?? 0);
          if (!price) continue;
          results.push({
            set_number: item.name?.match(/\b(\d{5,6})\b/)?.[1] ?? null,
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

    // Fallback: product grid
    if (!results.length) {
      $("[class*='product'], [data-testid*='product']").each((_, el) => {
        const name = $(el).find("[class*='name'], [class*='title'], h2, h3").first().text().trim();
        const priceText = $(el).find("[class*='price']").first().text().trim();
        const link = $(el).find("a[href*='/produkt/']").first().attr("href");
        if (!name || !priceText) return;
        const price = parseFloat(priceText.replace(/\s/g, "").replace(",", ".").replace(/[^0-9.]/g, ""));
        if (!price) return;
        results.push({
          set_number: name.match(/\b(\d{5,6})\b/)?.[1] ?? null,
          name,
          store: "Inet",
          store_url: link ? `https://www.inet.se${link}` : "https://www.inet.se",
          price_local: price,
          currency: "SEK",
          image_url: $(el).find("img").first().attr("src") ?? null,
          in_stock: 1,
        });
      });
    }

    console.log(`[Inet] Scraped ${results.length} products`);
  } catch (e) {
    console.error("[Inet]", e.message);
  }
  return results;
}
