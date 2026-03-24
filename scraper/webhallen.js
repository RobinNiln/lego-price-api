import { fetchWithBrowser } from "./browser.js";
import * as cheerio from "cheerio";

export async function scrapeWebhallen() {
  const results = [];
  try {
    const html = await fetchWithBrowser(
      "https://www.webhallen.com/se/category/56-LEGO?pagesize=100", 5000
    );
    const $ = cheerio.load(html);

    $("[class*='product'], [data-product-id]").each((_, el) => {
      const name = $(el).find("[class*='name'], [class*='title']").first().text().trim();
      if (!name?.toLowerCase().includes("lego")) return;

      // Find price in dedicated price element
      let price = 0;
      const priceEl = $(el).find("[class*='price'], [class*='Price']");
      priceEl.each((__, p) => {
        if ($(p).children("[class*='price'], [class*='Price']").length > 0) return;
        const text = $(p).text().replace(/\s/g, "").replace(/[^\d,.]/g, "").replace(",", ".");
        const num = parseFloat(text);
        if (num >= 50 && num <= 15000) price = num;
      });

      if (!price) return;

      const link = $(el).find("a[href*='/se/product/']").first().attr("href");
      const img = $(el).find("img").first().attr("src") ??
                  $(el).find("img").first().attr("data-src") ?? null;

      const setMatch = name.match(/\b(\d{5})\b/);

      results.push({
        set_number: setMatch?.[1] ?? null,
        name: name.substring(0, 200),
        store: "Webhallen",
        store_url: link
          ? `https://www.webhallen.com${link}`
          : "https://www.webhallen.com/se/category/56-LEGO",
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
