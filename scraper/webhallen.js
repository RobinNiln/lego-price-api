import fetch from "node-fetch";

const MIN_PRICE = 49;
const MAX_PRICE = 15000;

// Webhallen's internal API endpoints – these are what their Vue.js frontend uses
// Category IDs: 56=LEGO, 3156=Technic, 3155=Creator, 3144=LEGO kampanj
const CATEGORY_IDS = [56, 3156, 3155, 3157, 3158, 16237, 16580];

const HEADERS = {
  "Accept": "application/json",
  "Accept-Language": "sv-SE,sv;q=0.9",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Referer": "https://www.webhallen.com/se/category/56-LEGO",
  "Origin": "https://www.webhallen.com",
};

async function fetchCategory(categoryId, offset = 0) {
  const url = `https://www.webhallen.com/api/category/${categoryId}/products?offset=${offset}&limit=40`;
  const res = await fetch(url, { headers: HEADERS, timeout: 15000 });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchManufacturer(offset = 0) {
  // Manufacturer ID 549 = LEGO
  const url = `https://www.webhallen.com/api/manufacturer/549/products?offset=${offset}&limit=40`;
  const res = await fetch(url, { headers: HEADERS, timeout: 15000 });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function parseProduct(p, seen) {
  // Webhallen products can have various structures
  const name = p.name ?? p.title ?? "";
  if (!name) return null;

  const id = String(p.id ?? p.product_id ?? name);
  if (seen.has(id)) return null;
  seen.add(id);

  // Price is usually nested under price.price or price.endPrice
  const priceRaw =
    p.price?.price ??
    p.price?.endPrice ??
    p.lowestPrice?.price ??
    p.price ??
    0;
  const price = parseFloat(String(priceRaw).replace(/[^0-9.]/g, ""));
  if (!price || price < MIN_PRICE || price > MAX_PRICE) return null;

  // Build product URL from sectionId and id
  const slug = p.sectionId && p.id
    ? `/se/product/${p.sectionId}-${p.id}`
    : p.canonicalPath ?? p.url ?? "";

  const imageUrl =
    p.images?.zoom ??
    p.images?.large ??
    p.images?.thumb ??
    p.mainImage?.url ??
    null;

  const inStock =
    (p.stock?.web ?? 0) > 0 ||
    p.availability?.web === true ||
    p.isAvailable === true
      ? 1
      : 0;

  return {
    set_number: name.match(/\b(\d{5,6})\b/)?.[1] ?? null,
    name: name.substring(0, 200),
    store: "Webhallen",
    store_url: slug
      ? slug.startsWith("http") ? slug : `https://www.webhallen.com${slug}`
      : "https://www.webhallen.com/se/category/56-LEGO",
    price_local: price,
    currency: "SEK",
    image_url: imageUrl,
    in_stock: inStock,
  };
}

export async function scrapeWebhallen() {
  const results = [];
  const seen = new Set();

  // Try manufacturer endpoint first (most comprehensive)
  try {
    let offset = 0;
    let totalFetched = 0;

    while (true) {
      const data = await fetchManufacturer(offset);

      // API can return products under different keys
      const products =
        data?.products ??
        data?.items ??
        data?.results ??
        (Array.isArray(data) ? data : []);

      if (!products.length) break;

      for (const p of products) {
        const parsed = parseProduct(p, seen);
        if (parsed) results.push(parsed);
      }

      totalFetched += products.length;
      console.log(`[Webhallen] manufacturer offset ${offset}: ${products.length} products, total so far: ${results.length}`);

      // Stop if we got fewer than the limit (last page)
      if (products.length < 40) break;
      offset += 40;

      // Safety cap at 400 products
      if (totalFetched >= 400) break;
    }
  } catch (e) {
    console.error("[Webhallen] manufacturer API failed:", e.message);
  }

  // If manufacturer gave nothing, try individual categories
  if (results.length === 0) {
    for (const catId of CATEGORY_IDS) {
      try {
        let offset = 0;
        while (true) {
          const data = await fetchCategory(catId, offset);
          const products =
            data?.products ??
            data?.items ??
            data?.results ??
            (Array.isArray(data) ? data : []);

          if (!products.length) break;

          for (const p of products) {
            const parsed = parseProduct(p, seen);
            if (parsed) results.push(parsed);
          }

          console.log(`[Webhallen] category ${catId} offset ${offset}: ${products.length} products`);
          if (products.length < 40) break;
          offset += 40;
          if (offset >= 200) break;
        }
      } catch (e) {
        console.error(`[Webhallen] category ${catId} failed:`, e.message);
      }
    }
  }

  console.log(`[Webhallen] Total: ${results.length} products`);
  return results;
}
