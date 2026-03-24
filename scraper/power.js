import { fetchWithBrowser } from "./browser.js";
import * as cheerio from "cheerio";

export async function scrapePower() {
  const results = [];
  try {
    const html = await fetchWithBrowser("https://www.power.se/leksaker/lego/", 5000);
    const $ = cheerio.load(html);

    $("[class*='product-item']").each((_, el) => {
      // Try all possible name/price combos
      const name =
        $(el).find("[class*='product-name'], [class*='product-title'], [class*='name'], h2, h3").first().text().trim() ||
        $(el).find("a").first().attr("title") || "";

      // Price: look for any text containing digits followed by kr or :-
      let price = 0;
      $(el).find("*").each((__, child) => {
        const text = $(child).children().length === 0 ? $(child).text().trim() : "";
        if (!text) return;
        const match = text.match(/(\d[\d\s]*)[,.]?(\d{0,2})\s*(?:kr|:-|SEK)?$/);
        if (match) {
          const p = parseFloat(text.replace(/\s/g, "").replace(",", ".").replace(/[^0-9.]/g, ""));
          if (p > 50 && p < 50000 && p > price) price = p;
        }
      });

      const link = $(el).find("a[href*='/produkt/'], a[href*='/product/']").first().attr("href") ||
                   $(el).find("a").first().attr("href");
      const img = $(el).find("img").first().attr("src") || $(el).find("img").first().attr("data-src") || null;

      if (!name || !price) return;
      if (!name.toLowerCase().includes("lego")) return;

      results.push({
        set_number: name.match(/\b(\d{5,6})\b/)?.[1] ?? null,
        name: name.substring(0, 200),
        store: "Power",
        store_url: link ? (link.startsWith("http") ? link : `https://www.power.se${link}`) : "https://www.power.se",
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
