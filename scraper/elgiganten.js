import fetch from "node-fetch";
import * as cheerio from "cheerio";

export async function scrapeElgiganten() {
  const results = [];

  try {
    const url = "https://www.elgiganten.se/search?q=lego&sz=60";
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "sv-SE,sv;q=0.9",
      },
    });
    if (!res.ok) return results;

    const html = await res.text();
    const $ = cheerio.load(html);

    // Try JSON-LD first
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
            set_number: item.name.match(/\b(\d{5,6})\b/)?.[1] ?? null,
            name: item.name,
            store: "Elgiganten",
            store_url: item.offers?.url ?? "https://www.elgiganten.se",
            price_local: price,
            currency: "SEK",
            image_url: item.image ?? null,
            in_stock: item.offers?.availability?.includes("InStock") ? 1 : 0,
          });
        }
      } catch {}
    });

    // Fallback: product cards
    if (!results.length) {
      $("[class*='product-tile'], [class*='product-item'], [data-pid]").each((_, el) => {
        const name = $(el).find("[class*='name'], [class*='title']").first().text().trim();
        const priceText = $(el).find("[class*='price']").first().text().trim();
        const link = $(el).find("a").first().attr("href");
        if (!name?.toLowerCase().includes("lego") || !priceText) return;
        const price = parseFloat(priceText.replace(/[^0-9]/g, ""));
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
  } catch (e) {
    console.error("[Elgiganten]", e.message);
  }

  return results;
}
