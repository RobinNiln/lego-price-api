import fetch from "node-fetch";

const STORES = [
  { country: "se", lang: "sv-se", currency: "SEK", name: "LEGO Shop SE" },
  { country: "no", lang: "nb-no", currency: "NOK", name: "LEGO Shop NO" },
  { country: "dk", lang: "da-dk", currency: "DKK", name: "LEGO Shop DK" },
];

export async function scrapeLego() {
  const results = [];

  for (const store of STORES) {
    try {
      // LEGO's official product listing API
      const url = `https://www.lego.com/api/4.0/${store.lang}/products/new-sets?offset=0&limit=40&sort=RELEVANCE&includeSoldOut=false`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
          "Accept": "application/json",
          "Accept-Language": store.lang,
          "x-locale": store.lang,
        },
      });

      if (!res.ok) {
        console.error(`[LEGO ${store.country}] HTTP ${res.status}`);
        continue;
      }

      const data = await res.json();
      const products = data.results ?? data.products ?? [];
      console.log(`[LEGO ${store.country}] Found ${products.length} products`);

      for (const p of products) {
        // Try multiple price fields
        let price = null;
        if (p.prices?.salePrice?.centAmount) {
          price = p.prices.salePrice.centAmount / 100;
        } else if (p.prices?.regularPrice?.centAmount) {
          price = p.prices.regularPrice.centAmount / 100;
        } else if (p.price?.centAmount) {
          price = p.price.centAmount / 100;
        }

        if (!price || price <= 0) continue;

        const setNum = p.productCode ?? p.variants?.[0]?.sku ?? p.id ?? null;
        results.push({
          set_number: setNum,
          name: p.name,
          store: store.name,
          store_url: `https://www.lego.com/${store.lang}/product/${setNum}`,
          price_local: price,
          currency: store.currency,
          image_url: p.primaryImage?.url ?? p.images?.[0]?.url ?? null,
          in_stock: p.availability?.isAvailable !== false ? 1 : 0,
        });
      }
    } catch (e) {
      console.error(`[LEGO ${store.country}]`, e.message);
    }
  }

  return results;
}
