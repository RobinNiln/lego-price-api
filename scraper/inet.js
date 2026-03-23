import * as cheerio from "cheerio";
import { fetchWithBrowser } from "./browser.js";

export async function scrapeInet() {
  const results = [];
  try {
    const html = await fetchWithBrowser("https://www.inet.se/kategori/370/lego");
    const $ = cheerio.load(html);

    $("[class*='product'], .product-item, [data-product]").each((_, el) => {
      const name = $(el).find("[class*='name'], [class*='title'], h2, h3").first().text().trim();
      const priceText = $(el).find("[class*='price']").first().text().trim();
      const link = $(el).find("a").first().attr("href");
      const img = $(el).find("img").first().attr("src") ?? null;

      if (!name || !priceText) return;
      const price = parseFloat(priceText.replace(/[^0-9]/g, ""));
      if (!price || price <= 0) return;

      results.push({
        set_number: name.match(/\b(\d{5,6})\b/)?.[1] ?? null,
        name,
        store: "Inet",
        store_url: link ? (link.startsWith("http") ? link : `https://www.inet.se${link}`) : "https://www.inet.se",
        price_local: price,
        currency: "SEK",
        image_url: img,
        in_stock: 1,
      });
    });
    console.log(`[Inet] Scraped ${results.length} products`);
  } catch (e) {
    console.error("[Inet]", e.message);
  }
  return results;
}
