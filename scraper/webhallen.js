import fetch from "node-fetch";

export async function scrapeWebhallen() {
  const results = [];

  try {
    // Webhallen's internal search API
    const url = "https://www.webhallen.com/api/search?query=LEGO&pageSize=100&page=1";
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "sv-SE,sv;q=0.9,en;q=0.8",
        "Referer": "https://www.webhallen.com/se/category/56-LEGO",
        "x-requested-with": "XMLHttpRequest",
      },
    });

    const text = await res.text();

    // Check if we got HTML instead of JSON (blocked)
    if (text.trim().startsWith("<")) {
      console.error("[Webhallen] Got HTML instead of JSON - trying category page");
      return await scrapeWebhallenCategory();
    }

    const data = JSON.parse(text);
    if (!data.products?.length) return results;

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
    console.error("[Webhallen]", e.message);
  }

  return results;
}

async function scrapeWebhallenCategory() {
  const results = [];
  try {
    // Try Webhallen's category JSON endpoint
    const url = "https://www.webhallen.com/api/section/56?pageSize=100";
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        "Accept": "application/json",
        "Referer": "https://www.webhallen.com/se/category/56-LEGO",
      },
    });
    const text = await res.text();
    if (text.trim().startsWith("<")) return results;
    const data = JSON.parse(text);
    const products = data.products ?? data.items ?? [];

    for (const p of (Array.isArray(products) ? products : [])) {
      const item = p.product ?? p;
      const price = item.price?.price ?? item.price;
      if (!price) continue;
      results.push({
        set_number: item.name?.match(/\b(\d{5,6})\b/)?.[1] ?? null,
        name: item.name ?? "LEGO",
        store: "Webhallen",
        store_url: `https://www.webhallen.com${item.canonicalLink ?? ""}`,
        price_local: parseFloat(price),
        currency: "SEK",
        image_url: item.images?.zoom ?? null,
        in_stock: 1,
      });
    }
  } catch (e) {
    console.error("[Webhallen category]", e.message);
  }
  return results;
}
