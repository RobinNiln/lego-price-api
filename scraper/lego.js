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
      // Updated LEGO API endpoint
      const url = `https://www.lego.com/api/4.0/${store.lang}/products/new-sets?offset=0&limit=40`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept": "application/json, text/plain, */*",
          "Accept-Language": store.lang,
          "Referer": `https://www.lego.com/${store.lang}/`,
          "x-locale": store.lang,
          "Origin": "https://www.lego.com",
        },
      });

      console.log(`[LEGO ${store.name}] Status: ${res.status}`);
      if (!res.ok) {
        // Try alternative endpoint
        const url2 = `https://www.lego.com/api/4.0/${store.lang}/products/new-sets?offset=0&limit=40&orderBy=RELEVANCE`;
        const res2 = await fetch(url2, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36",
            "Accept": "application/json",
            "Referer": `https://www.lego.com/${store.lang}/`,
          },
        });
        console.log(`[LEGO ${store.name}] Alt status: ${res2.status}`);
        if (!res2.ok) continue;
        const data2 = await res2.json();
        processProducts(data2, store, results);
        continue;
      }

      const data = await res.json();
      processProducts(data, store, results);
    } catch (e) {
      console.error(`[LEGO ${store.name}]`, e.message);
    }
  }

  console.log(`[LEGO Shop] Total: ${results.length} products`);
  return results;
}

function processProducts(data, store, results) {
  const products = data.results ?? data.products ?? data.elements ?? data.items ?? [];
  console.log(`[LEGO ${store.name}] Found ${products.length} raw products`);

  for (const p of products) {
    let price = null;
    if (p.prices?.salePrice?.centAmount) price = p.prices.salePrice.centAmount / 100;
    else if (p.prices?.regularPrice?.centAmount) price = p.prices.regularPrice.centAmount / 100;
    else if (p.price?.centAmount) price = p.price.centAmount / 100;
    else if (typeof p.price === "number") price = p.price;
    else if (typeof p.salePrice === "number") price = p.salePrice;

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
}
