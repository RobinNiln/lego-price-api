import * as cheerio from "cheerio";
import { fetchWithBrowser } from "./browser.js";

export async function scrapeElgiganten() {
  const results = [];
  try {
    const html = await fetchWithBrowser("https://www.elgiganten.se/search?q=lego&sz=60");
    const $ = cheerio.load(html);

    $("[class*='product-tile'], [class*='product-item'], [data-pid]").each((_, el) => {
      const name = $(el).find("[class*='name'], [class*='title']").first().text().trim();
      const priceText = $(el).find("[class*='price']").first().text().trim();
      const link = $(el).find("a").first().attr("href");
      const img = $(el).find("img").first().attr("src") ?? null;

      if (!name?.toLowerCase().includes("lego") || !priceText) return;
      const price = parseFloat(priceText.replace(/[^0-9]/g, ""));
      if (!price || price <= 0) return;

      results.push({
        set_number: name.match(/\b(\d{5,6})\b/)?.[1] ?? null,
        name,
        store: "Elgiganten",
        store_url: link ? (link.startsWith("http") ? link : `https://www.elgiganten.se${link}`) : "https://www.elgiganten.se",
        price_local: price,
        currency: "SEK",
        image_url: img,
        in_stock: 1,
      });
    });
    console.log(`[Elgiganten] Scraped ${results.length} products`);
  } catch (e) {
    console.error("[Elgiganten]", e.message);
  }
  return results;
}
