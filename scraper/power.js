import { fetchWithBrowser } from "./browser.js";
import * as cheerio from "cheerio";

const MIN_PRICE = 49;
const MAX_PRICE = 8000;

export async function scrapePower() {
  const results = [];
  try {
    const html = await fetchWithBrowser("https://www.power.se/leksaker/lego/", 6000);
    const $ = cheerio.load(html);

    $("[class*='product-item']").each((_, el) => {
      const $el = $(el);

      // Name from title container
      const name = $el.find("[class*='product-item-title']").text().trim() ||
                   $el.find("h2, h3").first().text().trim();
      if (!name) return;

      // Price from dedicated price container
      let price = 0;
      const priceText = $el.find("[class='product-price'], [class*='product-item-price']")
        .first().text().trim();

      if (priceText) {
        const num = parseFloat(
          priceText.replace(/\s/g, "").replace(/\.-$/, "").replace(",", ".").replace(/[^0-9.]/g, "")
        );
        if (num >= MIN_PRICE && num <= MAX_PRICE) price = num;
      }

      // Fallback: scan all price-related elements
      if (!price) {
        $el.find("[class*='price']").each((__, p) => {
          const text = $(p).text().trim();
          const num = parseFloat(
            text.replace(/\s/g, "").replace(/\.-$/, "").replace(",", ".").replace(/[^0-9.]/g, "")
          );
          if (num >= MIN_PRICE && num <= MAX_PRICE) price = num;
        });
      }

      if (!price) return;

      const link = $el.find("a").first().attr("href");
      const img = $el.find("img").first().attr("src") ??
                  $el.find("img").first().attr("data-src") ?? null;
      const setMatch = name.match(/\b(\d{5})\b/);

      results.push({
        set_number: setMatch?.[1] ?? null,
        name: name.substring(0, 200),
        store: "Power",
        store_url: link
          ? (link.startsWith("http") ? link : `https://www.power.se${link}`)
          : "https://www.power.se",
        price_local: price,
        currency: "SEK",
        image_url: img,
        in_stock: 1,
      });
    });

    console.log(`[Power] Scraped ${results.length} products`);
  } catch (e) {
    console.error("[Power]", e.message);
  }
  return results;
}
