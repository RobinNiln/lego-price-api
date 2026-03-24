import { fetchWithBrowser } from "./browser.js";
import * as cheerio from "cheerio";

export async function scrapePower() {
  const results = [];
  try {
    const html = await fetchWithBrowser("https://www.power.se/leksaker/lego/", 4000);
    const $ = cheerio.load(html);

    // Log first 500 chars to see structure
    const bodyText = $("body").html()?.substring(0, 500) ?? "";
    console.log("[Power] Body preview:", bodyText.replace(/\s+/g, " ").substring(0, 200));

    // Try multiple selectors
    const selectors = [
      "[class*='ProductCard']",
      "[class*='product-card']",
      "[class*='ProductItem']",
      "[class*='product-item']",
      "[class*='Product_product']",
      "li[class*='product']",
      "[data-test*='product']",
    ];

    for (const sel of selectors) {
      const found = $(sel);
      if (found.length > 0) {
        console.log(`[Power] Found ${found.length} items with selector: ${sel}`);
        found.each((_, el) => {
          const name = $(el).find("[class*='name'], [class*='title'], [class*='Name'], [class*='Title']").first().text().trim();
          const priceText = $(el).find("[class*='price'], [class*='Price']").first().text().trim();
          const link = $(el).find("a").first().attr("href");
          if (!name || !priceText) return;
          const price = parseFloat(priceText.replace(/\s/g, "").replace(",", ".").replace(/[^0-9.]/g, ""));
          if (!price || price <= 0) return;
          results.push({
            set_number: name.match(/\b(\d{5,6})\b/)?.[1] ?? null,
            name,
            store: "Power",
            store_url: link ? (link.startsWith("http") ? link : `https://www.power.se${link}`) : "https://www.power.se",
            price_local: price,
            currency: "SEK",
            image_url: $(el).find("img").first().attr("src") ?? null,
            in_stock: 1,
          });
        });
        if (results.length > 0) break;
      }
    }

    // Fallback: JSON-LD
    if (!results.length) {
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
              store: "Power",
              store_url: item.offers?.url ?? "https://www.power.se",
              price_local: price,
              currency: "SEK",
              image_url: Array.isArray(item.image) ? item.image[0] : item.image ?? null,
              in_stock: item.offers?.availability?.includes("InStock") ? 1 : 0,
            });
          }
        } catch {}
      });
    }

    console.log(`[Power] Scraped ${results.length} products`);
  } catch (e) {
    console.error("[Power]", e.message);
  }
  return results;
}
