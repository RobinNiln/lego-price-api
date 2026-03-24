import { fetchWithBrowser } from "./browser.js";
import * as cheerio from "cheerio";

export async function scrapePower() {
  const results = [];
  try {
    const html = await fetchWithBrowser("https://www.power.se/leksaker/lego/", 6000);
    const $ = cheerio.load(html);

    // Log all class names containing 'product' to find right selector
    const classNames = new Set();
    $("*").each((_, el) => {
      const cls = $(el).attr("class") || "";
      cls.split(" ").forEach(c => { if (c.toLowerCase().includes("product")) classNames.add(c); });
    });
    console.log("[Power] Product classes:", [...classNames].slice(0, 10).join(", "));

    // Try all product-related selectors
    const selectors = [
      "[class*='product-item']",
      "[class*='ProductItem']",
      "[class*='product-card']",
      "[class*='ProductCard']",
      "[class*='product-list-item']",
      "[class*='ProductListItem']",
      "article",
      "[data-product]",
    ];

    for (const sel of selectors) {
      const items = $(sel);
      if (items.length < 3) continue;
      console.log(`[Power] Trying ${sel}: ${items.length} items`);

      items.each((_, el) => {
        const allText = $(el).text();
        if (!allText.toLowerCase().includes("lego")) return;

        const name = $(el).find("h2, h3, [class*='name'], [class*='title']").first().text().trim();

        // Find price – look for numbers in range 50-50000
        let price = 0;
        const priceEl = $(el).find("[class*='price'], [class*='Price']");
        priceEl.each((__, p) => {
          const text = $(p).text().trim();
          const num = parseFloat(text.replace(/[^\d,.]/g, "").replace(",", "."));
          if (num > 50 && num < 50000) price = num;
        });

        // Fallback: scan all leaf text nodes
        if (!price) {
          $(el).find("*").each((__, child) => {
            if ($(child).children().length > 0) return;
            const text = $(child).text().trim();
            const num = parseFloat(text.replace(/\s/g, "").replace(",", ".").replace(/[^0-9.]/g, ""));
            if (num > 50 && num < 50000 && num > price) price = num;
          });
        }

        const link = $(el).find("a").first().attr("href");
        if (!name || !price) return;

        results.push({
          set_number: name.match(/\b(\d{5,6})\b/)?.[1] ?? null,
          name: name.substring(0, 200),
          store: "Power",
          store_url: link ? (link.startsWith("http") ? link : `https://www.power.se${link}`) : "https://www.power.se",
          price_local: price,
          currency: "SEK",
          image_url: $(el).find("img").first().attr("src") ?? $(el).find("img").first().attr("data-src") ?? null,
          in_stock: 1,
        });
      });

      if (results.length > 0) break;
    }

    console.log(`[Power] Scraped ${results.length} products`);
  } catch (e) {
    console.error("[Power]", e.message);
  }
  return results;
}
