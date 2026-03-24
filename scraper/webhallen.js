import fetch from "node-fetch";

const MIN_PRICE = 49;
const MAX_PRICE = 15000;

// Webhallen's internal API – far more reliable than HTML scraping
// Their frontend uses this endpoint directly
const BASE_URL = "https://www.webhallen.com/api/search";

const SEARCHES = [
  "lego star wars",
  "lego technic",
  "lego city",
  "lego ninjago",
  "lego harry potter",
  "lego creator",
  "lego friends",
  "lego icons",
  "lego minecraft",
];

export async function scrapeWebhallen() {
  const results = [];
  const seen = new Set();

  for (const query of SEARCHES) {
    let offset = 0;
    const limit = 40;

    while (true) {
      try {
        const url = `${BASE_URL}?query=${encodeURIComponent(query)}&page_size=${limit}&offset=${offset}`;
        const res = await fetch(url, {
          headers: {
            Accept: "application/json",
            "Accept-Language": "sv-SE,sv;q=0.9",
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            Referer: "https://www.webhallen.com/se/search",
          },
          timeout: 15000,
        });

        if (!res.ok) {
          console.log(`[Webhallen] API ${res.status} for "${query}" offset ${offset}`);
          break;
        }

        const data = await res.json();
        const products = data?.results ?? data?.products ?? data?.items ?? [];

        if (!Array.isArray(products) || products.length === 0) break;

        for (const p of products) {
          // Handle both flat and nested structures
          const name = p.name ?? p.title ?? "";
          if (!name.toLowerCase().includes("lego")) continue;

          const id = p.id ?? p.product_id ?? p.sku ?? name;
          if (seen.has(id)) continue;
          seen.add(id);

          // Price can be nested under pricing, price, or lowestPrice
          const priceRaw =
            p.price?.price ??
            p.pricing?.price ??
            p.lowestPrice ??
            p.currentPrice ??
            p.price ??
            0;
          const price = parseFloat(String(priceRaw).replace(/[^0-9.]/g, ""));

          if (!price || price < MIN_PRICE || price > MAX_PRICE) continue;

          const slug = p.sectionId
            ? `/se/product/${p.sectionId}-${p.id}`
            : p.canonicalUrl ?? p.url ?? "";

          const imageUrl =
            p.images?.[0]?.url ??
            p.image?.url ??
            p.imageUrl ??
            p.thumbnail ??
            null;

          const inStock =
            p.stock?.web > 0 ||
            p.availability?.web === true ||
            p.inStock === true
              ? 1
              : 0;

          results.push({
            set_number: name.match(/\b(\d{5,6})\b/)?.[1] ?? null,
            name: name.substring(0, 200),
            store: "Webhallen",
            store_url: slug.startsWith("http")
              ? slug
              : `https://www.webhallen.com${slug}`,
            price_local: price,
            currency: "SEK",
            image_url: imageUrl,
            in_stock: inStock,
          });
        }

        // Stop paginating if we got fewer results than the limit
        if (products.length < limit) break;
        offset += limit;

        // Safety cap – max 3 pages per search term
        if (offset >= limit * 3) break;
      } catch (e) {
        console.error(`[Webhallen] Error for "${query}" offset ${offset}:`, e.message);
        break;
      }
    }
  }

  console.log(`[Webhallen] Total: ${results.length} products`);
  return results;
}
