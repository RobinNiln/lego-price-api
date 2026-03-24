import { fetchWithBrowser } from "./browser.js";
import * as cheerio from "cheerio";

export async function scrapeElgiganten() {
  const results = [];
  try {
    const html = await fetchWithBrowser("https://www.elgiganten.se/search?q=lego&sz=60", 3000);
    const $ = cheerio.load(html);

    $("script[type='application/ld+json']").each((_, el) => {
      try {
        const data = JSON.parse($(el).html());
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          if (item["@type"] !== "Product") continue;
          if (!item.name?.toLowerCase().includes("lego")) continue;
          const price = parseFloat(item.offers?.price ?? 0);
          if (!price) continue;
          results.push({
            set_number: item.name?.match(/\b(\d{5,6})\b/)?.[1] ?? null,
            name: item.name,
            store: "Elgiganten",
            store_url: item.offers?.url ?? "https://www.elgiganten.se",
            price_local: price,
            currency: "SEK",
            image_url: Array.isArray(item.image) ? item.image[0] : item.image ?? null,
            in_stock: item.offers?.availability?.includes("InStock") ? 1 : 0,
          });
        }
      } catch {}
    });

    if (!results.length) {
      $("[class*='product'], [data-pid]").each((_, el) => {
        const name = $(el).find("[class*='name'], [class*='title']").first().text().trim();
        const priceText = $(el).find("[class*='price']").first().text().trim();
        const link = $(el).find("a").first().attr("href");
        if (!name?.toLowerCase().includes("lego") || !priceText) return;
        const price = parseFloat(priceText.replace(/\s/g, "").replace(",", ".").replace(/[^0-9.]/g, ""));
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
    }

    console.log(`[Elgiganten] Scraped ${results.length} products`);
  } catch (e) {
    console.error("[Elgiganten]", e.message);
  }
  return results;
}
