import { fetchWithBrowser } from "./browser.js";
import * as cheerio from "cheerio";

export async function scrapeElgiganten() {
  const results = [];
  try {
    const html = await fetchWithBrowser("https://www.elgiganten.se/search?q=lego&sz=60", 5000);
    const $ = cheerio.load(html);

    $("[class*='product-card']").each((_, el) => {
      const name =
        $(el).find("[class*='product-name'], [class*='product-title'], [class*='name'], h2, h3").first().text().trim() ||
        $(el).find("a").first().attr("title") || "";

      let price = 0;
      $(el).find("*").each((__, child) => {
        const text = $(child).children().length === 0 ? $(child).text().trim() : "";
        if (!text) return;
        const p = parseFloat(text.replace(/\s/g, "").replace(",", ".").replace(/[^0-9.]/g, ""));
        if (p > 50 && p < 50000 && p > price) price = p;
      });

      const link = $(el).find("a").first().attr("href");
      const img = $(el).find("img").first().attr("src") || $(el).find("img").first().attr("data-src") || null;

      if (!name || !price) return;
      if (!name.toLowerCase().includes("lego")) return;

      results.push({
        set_number: name.match(/\b(\d{5,6})\b/)?.[1] ?? null,
        name: name.substring(0, 200),
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
