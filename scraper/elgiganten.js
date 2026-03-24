import { fetchWithBrowser } from "./browser.js";
import * as cheerio from "cheerio";

export async function scrapeElgiganten() {
  const results = [];
  try {
    const html = await fetchWithBrowser("https://www.elgiganten.se/search?q=lego&sz=60", 5000);
    const $ = cheerio.load(html);

    $("[class*='product-card']").each((_, el) => {
      const name = $(el).find("[class*='product-name'], [class*='ProductName'], h2, h3").first().text().trim();
      if (!name?.toLowerCase().includes("lego")) return;

      // Find price specifically in price elements, not anywhere in the card
      let price = 0;
      const priceContainers = $(el).find("[class*='price'], [class*='Price']");
      priceContainers.each((__, p) => {
        // Only look at leaf nodes (no children) to avoid duplicates
        if ($(p).children("[class*='price'], [class*='Price']").length > 0) return;
        const text = $(p).text().replace(/\s/g, "").replace(/[^\d,.]/g, "").replace(",", ".");
        const num = parseFloat(text);
        // Valid LEGO price range: 50–15000 SEK
        if (num >= 50 && num <= 15000) price = num;
      });

      if (!price) return;

      const link = $(el).find("a").first().attr("href");
      const img = $(el).find("img").first().attr("src") ??
                  $(el).find("img").first().attr("data-src") ?? null;

      // Extract set number from name (5-digit number)
      const setMatch = name.match(/\b(\d{5})\b/);

      results.push({
        set_number: setMatch?.[1] ?? null,
        name: name.substring(0, 200),
        store: "Elgiganten",
        store_url: link
          ? (link.startsWith("http") ? link : `https://www.elgiganten.se${link}`)
          : "https://www.elgiganten.se",
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
