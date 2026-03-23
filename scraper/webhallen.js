import * as cheerio from "cheerio";
import { fetchWithBrowser } from "./browser.js";

export async function scrapeWebhallen() {
  const results = [];
  try {
    const html = await fetchWithBrowser("https://www.webhallen.com/se/category/56-LEGO?pagesize=100");
    const $ = cheerio.load(html);

    $("[class*='product'], [data-product-id]").each((_, el) => {
      const name = $(el).find("[class*='name'], [class*='title']").first().text().trim();
      const priceText = $(el).find("[class*='price']").first().text().trim();
      const link = $(el).find("a[href*='/se/product/']").first().attr("href");
      const img = $(el).find("img").first().attr("src") ?? null;

      if (!name || !priceText) return;
      const price = parseFloat(priceText.replace(/[^0-9]/g, ""));
      if (!price || price <= 0) return;

      results.push({
        set_number: name.match(/\b(\d{5,6})\b/)?.[1] ?? null,
        name,
        store: "Webhallen",
        store_url: link ? `https://www.webhallen.com${link}` : "https://www.webhallen.com/se/category/56-LEGO",
        price_local: price,
        currency: "SEK",
        image_url: img,
        in_stock: 1,
      });
    });
    console.log(`[Webhallen] Scraped ${results.length} products`);
  } catch (e) {
    console.error("[Webhallen]", e.message);
  }
  return results;
}
