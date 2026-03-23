import fetch from "node-fetch";

// LEGO has a public product API used by their own website
const STORES = [
  { country: "se", currency: "SEK", name: "LEGO Shop SE" },
  { country: "no", currency: "NOK", name: "LEGO Shop NO" },
  { country: "dk", currency: "DKK", name: "LEGO Shop DK" },
];

export async function scrapeLego() {
  const results = [];

  for (const store of STORES) {
    try {
      const url = `https://www.lego.com/api/4.0/en-${store.country}/products/new-sets?offset=0&limit=40&sort=RELEVANCE`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; LegoBot/1.0)",
          "Accept": "application/json",
          "x-locale": `${store.country}-${store.country.toUpperCase()}`,
        },
      });

      if (!res.ok) continue;
      const data = await res.json();
      const products = data.results ?? data.products ?? [];

      for (const p of products) {
        const price = p.prices?.salePrice?.formattedAmount
          ? parseFloat(p.prices.salePrice.formattedAmount.replace(/[^0-9,.]/g, "").replace(",", "."))
          : p.prices?.regularPrice?.centAmount
          ? p.prices.regularPrice.centAmount / 100
          : null;

        if (!price) continue;

        results.push({
          set_number: p.productCode ?? p.id ?? null,
          name: p.name,
          store: store.name,
          store_url: `https://www.lego.com/${store.country}-${store.country}/product/${p.productCode ?? p.id}`,
          price_local: price,
          currency: store.currency,
          image_url: p.primaryImage?.url ?? null,
          in_stock: p.availability?.isAvailable ? 1 : 0,
        });
      }
    } catch (e) {
      console.error(`[LEGO ${store.country}]`, e.message);
    }
  }

  return results;
}
