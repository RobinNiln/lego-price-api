import fetch from "node-fetch";

// Webhallen has a public JSON API used by their own site
const SEARCHES = [
  "LEGO Star Wars",
  "LEGO Technic",
  "LEGO City",
  "LEGO Ninjago",
  "LEGO Creator",
  "LEGO Friends",
  "LEGO Harry Potter",
  "LEGO Icons",
  "LEGO Minecraft",
];

export async function scrapeWebhallen() {
  const results = [];
  const seen = new Set();

  for (const query of SEARCHES) {
    try {
      const url = `https://www.webhallen.com/api/search?query=${encodeURIComponent(query)}&pageSize=40&page=1`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36",
          "Accept": "application/json",
          "Referer": "https://www.webhallen.com/se/category/56-LEGO",
          "x-requested-with": "XMLHttpRequest",
        },
      });

      const text = await res.text();
      if (text.trim().startsWith("<")) {
        console.log(`[Webhallen] HTML response for "${query}" - skipping`);
        continue;
      }

      const data = JSON.parse(text);
      const products = data.products ?? data.results ?? data.items ?? [];

      console.log(`[Webhallen] "${query}": ${products.length} products`);

      for (const item of products) {
        const p = item.product ?? item;
        if (!p?.name?.toLowerCase().includes("lego")) continue;
        const price = p.price?.price ?? p.price?.current ?? p.currentPrice;
        if (!price || price < 49 || price > 15000) continue;
        if (seen.has(p.name)) continue;
        seen.add(p.name);

        results.push({
          set_number: p.name?.match(/\b(\d{5})\b/)?.[1] ?? null,
          name: p.name.substring(0, 200),
          store: "Webhallen",
          store_url: p.canonicalLink
            ? `https://www.webhallen.com${p.canonicalLink}`
            : "https://www.webhallen.com/se/category/56-LEGO",
          price_local: price,
          currency: "SEK",
          image_url: p.images?.zoom ?? p.images?.large ?? null,
          in_stock: (p.stock?.web ?? 0) > 0 ? 1 : 0,
        });
      }
    } catch (e) {
      console.error(`[Webhallen] "${query}":`, e.message);
    }
  }

  console.log(`[Webhallen] Total: ${results.length} products`);
  return results;
}
