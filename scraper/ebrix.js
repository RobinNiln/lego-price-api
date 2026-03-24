import { fetchWithBrowser } from "./browser.js";
import * as cheerio from "cheerio";

const MIN_PRICE = 49;
const MAX_PRICE = 8000;

export async function scrapeEbrix() {
  const results = [];
  const seen = new Set();

  try {
    const html = await fetchWithBrowser("https://ebrix.se/lego", 5000);
    const $ = cheerio.load(html);

    // Try JSON-LD first
    $("script[type='application/ld+json']").each((_, el) => {
      try {
        const data = JSON.parse($(el).html());
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          if (item["@type"] !== "Product") continue;
          const price = parseFloat(item.offers?.price ?? 0);
          if (price < MIN_PRICE || price > MAX_PRICE) continue;
          const url = item.offers?.url ?? "";
          if (!url || seen.has(url)) continue;
          seen.add(url);
          results.push({
            set_number: item.name?.match(/\b(\d{5})\b/)?.[1] ?? null,
            name: item.name,
            store: "Ebrix",
            store_url: url,
            price_local: price,
            currency: "SEK",
            image_url: Array.isArray(item.image) ? item.image[0] : item.image ?? null,
            in_stock: item.offers?.availability?.includes("InStock") ? 1 : 0,
          });
        }
      } catch {}
    });

    // Fallback: product grid – only pick direct product links
    if (!results.length) {
      // Look for product cards with a direct /produkt/ or /product/ link
      $("a[href*='/produkt/'], a[href*='/product/']").each((_, el) => {
        const $el = $(el);
        const link = $el.attr("href");
        if (!link || seen.has(link)) return;

        const name = $el.find("[class*='name'], [class*='title'], h2, h3").first().text().trim() ||
                     $el.attr("title") || "";
        if (!name?.toLowerCase().includes("lego")) return;

        let price = 0;
        $el.find("[class*='price']").each((__, p) => {
          const num = parseFloat($(p).text().replace(/\s/g,"").replace(/\.-$/,"").replace(",",".").replace(/[^0-9.]/g,""));
          if (num >= MIN_PRICE && num <= MAX_PRICE) price = num;
        });

        if (!price) return;
        seen.add(link);

        results.push({
          set_number: name.match(/\b(\d{5})\b/)?.[1] ?? null,
          name: name.substring(0, 200),
          store: "Ebrix",
          store_url: link.startsWith("http") ? link : `https://ebrix.se${link}`,
          price_local: price,
          currency: "SEK",
          image_url: $el.find("img").first().attr("src") ?? null,
          in_stock: 1,
        });
      });
    }

    console.log(`[Ebrix] Scraped ${results.length} products`);
  } catch (e) {
    console.error("[Ebrix]", e.message);
  }
  return results;
}
