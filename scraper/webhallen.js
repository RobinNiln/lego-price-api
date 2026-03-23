import fetch from "node-fetch";

const PAGES = 3;

export async function scrapeWebhallen() {
  const results = [];

  for (let page = 1; page <= PAGES; page++) {
    try {
      const url = `https://www.webhallen.com/api/search?query=LEGO&pageSize=40&page=${page}&sortField=discount&sortOrder=desc`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; LegoBot/1.0)",
          "Accept": "application/json",
        },
      });
      if (!res.ok) break;
      const data = await res.json();
      if (!data.products?.length) break;

      for (const { product: p } of data.products) {
        if (!p?.name?.toLowerCase().includes("lego")) continue;
        const price = p.price?.price;
        if (!price || price <= 0) continue;

        const setMatch = p.name.match(/\b(\d{5,6})\b/);
        results.push({
          set_number: setMatch?.[1] ?? null,
          name: p.name,
          store: "Webhallen",
          store_url: `https://www.webhallen.com${p.canonicalLink}`,
          price_local: price,
          currency: "SEK",
          image_url: p.images?.zoom ?? null,
          in_stock: (p.stock?.web ?? 0) > 0 ? 1 : 0,
        });
      }
    } catch (e) {
      console.error("[Webhallen] page", page, e.message);
      break;
    }
  }

  return results;
}
