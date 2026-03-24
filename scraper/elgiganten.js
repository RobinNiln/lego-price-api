import { fetchWithBrowser } from "./browser.js";
import * as cheerio from "cheerio";

export async function scrapeElgiganten() {
  const results = [];
  try {
    const html = await fetchWithBrowser("https://www.elgiganten.se/search?q=lego&sz=60", 4000);
    const $ = cheerio.load(html);

    console.log("[Elgiganten] Body preview:", $("body").html()?.replace(/\s+/g," ").substring(0,300));

    // Try JSON-LD first (most reliable)
    $("script[type='application/ld+json']").each((_, el) => {
      try {
        const raw = $(el).html();
        const data = JSON.parse(raw);
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          if (item["@type"] !== "Product") continue;
          if (!item.name?.toLowerCase().includes("lego")) continue;
          const price = parseFloat(item.offers?.price ?? item.offers?.lowPrice ?? 0);
          if (!price) continue;
          results.push({
            set_number: item.name?.match(/\b(\d{5,6})\b/)?.[1] ?? null,
            name: item.name,
            store: "Elgiganten",
            store_url: item.offers?.url ?? item.url ?? "https://www.elgiganten.se",
            price_local: price,
            currency: "SEK",
            image_url: Array.isArray(item.image) ? item.image[0] : item.image ?? null,
            in_stock: item.offers?.availability?.includes("InStock") ? 1 : 0,
          });
        }
      } catch {}
    });

    // Try product grid selectors
    if (!results.length) {
      const selectors = [
        "[class*='product-tile']",
        "[class*='ProductTile']",
        "[class*='product-card']",
        "[class*='ProductCard']",
        "[data-pid]",
        "[data-productid]",
        "li[class*='product']",
      ];

      for (const sel of selectors) {
        const found = $(sel);
        if (found.length > 0) {
          console.log(`[Elgiganten] Found ${found.length} items with: ${sel}`);
          found.each((_, el) => {
            const name = $(el).find("[class*='name'], [class*='title'], [itemprop='name']").first().text().trim();
            const priceText = $(el).find("[class*='price'], [itemprop='price']").first().text().trim();
            const link = $(el).find("a").first().attr("href");
            if (!name?.toLowerCase().includes("lego") || !priceText) return;
            const price = parseFloat(priceText.replace(/\s/g,"").replace(",",".").replace(/[^0-9.]/g,""));
            if (!price) return;
            results.push({
              set_number: name.match(/\b(\d{5,6})\b/)?.[1] ?? null,
              name,
              store: "Elgiganten",
              store_url: link ? (link.startsWith("http") ? link : `https://www.elgiganten.se${link}`) : "https://www.elgiganten.se",
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

    console.log(`[Elgiganten] Scraped ${results.length} products`);
  } catch (e) {
    console.error("[Elgiganten]", e.message);
  }
  return results;
}
