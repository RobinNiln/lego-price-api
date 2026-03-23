import fetch from "node-fetch";
import * as cheerio from "cheerio";

export async function scrapePower() {
  const results = [];

  try {
    const url = "https://www.power.se/api/search?q=lego&size=60&page=0";
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LegoBot/1.0)",
        "Accept": "application/json",
        "x-requested-with": "XMLHttpRequest",
      },
    });

    if (res.ok) {
      const data = await res.json();
      const products = data.products ?? data.results ?? data.items ?? [];

      for (const p of products) {
        const name = p.name ?? p.title ?? "";
        if (!name.toLowerCase().includes("lego")) continue;
        const price = p.price ?? p.salesPrice ?? p.currentPrice;
        if (!price || price <= 0) continue;

        const setMatch = name.match(/\b(\d{5,6})\b/);
        results.push({
          set_number: setMatch?.[1] ?? null,
          name,
          store: "Power",
          store_url: p.url ? `https://www.power.se${p.url}` : "https://www.power.se",
          price_local: parseFloat(price),
          currency: "SEK",
          image_url: p.image ?? p.imageUrl ?? null,
          in_stock: p.inStock ?? 1,
        });
      }
    }
  } catch (e) {
    console.error("[Power]", e.message);
  }

  return results;
}
