import fetch from "node-fetch";

const STORES = [
  { lang: "sv-se", currency: "SEK", name: "LEGO Shop SE" },
  { lang: "nb-no", currency: "NOK", name: "LEGO Shop NO" },
  { lang: "da-dk", currency: "DKK", name: "LEGO Shop DK" },
];

export async function scrapeLego() {
  const results = [];

  for (const store of STORES) {
    try {
      // LEGO's correct search/listing endpoint
      const url = `https://www.lego.com/api/4.0/${store.lang}/search?q=lego&sort=RELEVANCE&perPage=40&currentPage=1&inStockOnly=false`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept": "application/json",
          "Referer": `https://www.lego.com/${store.lang}/`,
          "x-locale": store.lang,
        },
      });

      console.log(`[LEGO ${store.name}] Status: ${res.status}`);
      if (!res.ok) continue;

      const data = await res.json();
      const products = data.results ?? data.products ?? data.elements ?? data.hits ?? [];
      console.log(`[LEGO ${store.name}] Found ${products.length} products`);

      for (const p of products) {
        let price = null;
        if (p.prices?.salePrice?.centAmount) price = p.prices.salePrice.centAmount / 100;
        else if (p.prices?.regularPrice?.centAmount) price = p.prices.regularPrice.centAmount / 100;
        else if (p.price?.centAmount) price = p.price.centAmount / 100;
        else if (typeof p.price === "number") price = p.price;

        if (!price || price <= 0) continue;

        const id = p.productCode ?? p.id ?? p.sku ?? null;
        results.push({
          set_number: id ? String(id) : null,
          name: p.name ?? p.title ?? "LEGO Set",
          store: store.name,
          store_url: `https://www.lego.com/${store.lang}/product/${id}`,
          price_local: price,
          currency: store.currency,
          image_url: p.primaryImage?.url ?? p.images?.[0]?.url ?? null,
          in_stock: p.availability?.isAvailable !== false ? 1 : 0,
        });
      }
    } catch (e) {
      console.error(`[LEGO ${store.name}]`, e.message);
    }
  }

  console.log(`[LEGO Shop] Total: ${results.length} products`);
  return results;
}
