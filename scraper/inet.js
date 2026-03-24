import fetch from "node-fetch";

const SEARCHES = [
  "LEGO Star Wars", "LEGO Technic", "LEGO City",
  "LEGO Ninjago", "LEGO Creator", "LEGO Friends",
  "LEGO Harry Potter", "LEGO Icons", "LEGO Minecraft",
];

export async function scrapeInet() {
  const results = [];
  const seen = new Set();

  for (const query of SEARCHES) {
    try {
      // Inet's search endpoint
      const url = `https://www.inet.se/api/search/products?query=${encodeURIComponent(query)}&limit=40&offset=0`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36",
          "Accept": "application/json",
          "Referer": "https://www.inet.se/",
        },
      });

      if (!res.ok) {
        // Fallback: try alternate endpoint
        const url2 = `https://www.inet.se/search?query=${encodeURIComponent(query)}&output=json`;
        const res2 = await fetch(url2, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36",
            "Accept": "application/json",
          },
        });
        if (!res2.ok) { console.log(`[Inet] "${query}": HTTP ${res.status}`); continue; }
        const d2 = await res2.json();
        processInetData(d2, query, seen, results);
        continue;
      }

      const data = await res.json();
      processInetData(data, query, seen, results);
    } catch (e) {
      console.error(`[Inet] "${query}":`, e.message);
    }
  }

  console.log(`[Inet] Total: ${results.length} products`);
  return results;
}

function processInetData(data, query, seen, results) {
  const products = data.products ?? data.results ?? data.items ?? data.hits ?? [];
  console.log(`[Inet] "${query}": ${products.length} products`);

  for (const p of products) {
    const name = p.name ?? p.title ?? "";
    if (!name.toLowerCase().includes("lego")) continue;
    const price = p.price ?? p.currentPrice ?? p.salesPrice;
    if (!price || price < 49 || price > 15000) continue;
    if (seen.has(name)) continue;
    seen.add(name);

    results.push({
      set_number: name.match(/\b(\d{5})\b/)?.[1] ?? null,
      name: name.substring(0, 200),
      store: "Inet",
      store_url: p.url ? (p.url.startsWith("http") ? p.url : `https://www.inet.se${p.url}`) : "https://www.inet.se",
      price_local: parseFloat(price),
      currency: "SEK",
      image_url: p.image ?? p.imageUrl ?? null,
      in_stock: p.inStock ?? 1,
    });
  }
}
