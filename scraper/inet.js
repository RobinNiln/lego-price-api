import { fetchWithBrowser } from "./browser.js";
import * as cheerio from "cheerio";

export async function scrapeInet() {
  const results = [];
  try {
    // Use search instead of category page
    const html = await fetchWithBrowser("https://www.inet.se/search?query=lego&categoryId=370", 5000);
    const $ = cheerio.load(html);

    console.log(`[Inet] Content length: ${html.length}`);

    // Try JSON-LD
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
            store: "Inet",
            store_url: item.offers?.url ?? "https://www.inet.se",
            price_local: price,
            currency: "SEK",
            image_url: Array.isArray(item.image) ? item.image[0] : item.image ?? null,
            in_stock: item.offers?.availability?.includes("InStock") ? 1 : 0,
          });
        }
      } catch {}
    });

    // Try product grid
    if (!results.length) {
      const selectors = ["[class*='product']", "article", "li[class*='item']"];
      for (const sel of selectors) {
        const found = $(sel);
        if (found.length > 2) {
          console.log(`[Inet] Trying selector ${sel}: ${found.length} items`);
          found.each((_, el) => {
            const name = $(el).find("[class*='name'], [class*='title'], h2, h3").first().text().trim();
            let price = 0;
            $(el).find("*").each((__, child) => {
              const text = $(child).children().length === 0 ? $(child).text().trim() : "";
              const p = parseFloat(text.replace(/\s/g, "").replace(",", ".").replace(/[^0-9.]/g, ""));
              if (p > 50 && p < 50000 && p > price) price = p;
            });
            const link = $(el).find("a").first().attr("href");
            if (!name || !price) return;
            results.push({
              set_number: name.match(/\b(\d{5,6})\b/)?.[1] ?? null,
              name: name.substring(0, 200),
              store: "Inet",
              store_url: link ? (link.startsWith("http") ? link : `https://www.inet.se${link}`) : "https://www.inet.se",
              price_local: price,
              currency: "SEK",
              image_url: $(el).find("img").first().attr("src") ?? null,
              in_stock: 1,
            });
          });
          if (results.length > 0) break;
        }
      }
    }

    console.log(`[Inet] Scraped ${results.length} products`);
  } catch (e) {
    console.error("[Inet]", e.message);
  }
  return results;
}
