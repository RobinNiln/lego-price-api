import fetch from "node-fetch";
import * as cheerio from "cheerio";

export async function scrapePower() {
  const results = [];

  try {
    // Power has a search API endpoint
    const url = "https://www.power.se/api/search?q=lego&size=60&page=0";
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LegoBot/1.0)",
        "Accept": "application/json",
        "x-requested-with": "XMLHttpRequest",
      },
    });

    if (res.ok) {
      const data = await res.json();
      const products = data.products ?? data.results ?? data.items ?? [];

      for (const p of products) {
        const name = p.name ?? p.title ?? "";
        if (!name.toLowerCase().includes("lego")) continue;
        const price = p.price ?? p.salesPrice ?? p.currentPrice;
        if (!price || price <= 0) continue;

        const setMatch = name.match(/\b(\d{5,6})\b/);
        results.push({
          set_number: setMatch?.[1] ?? null,
          name,
          store: "Power",
          store_url: p.url ? `https://www.power.se${p.url}` : "https://www.power.se",
          price_local: parseFloat(price),
          currency: "SEK",
          image_url: p.image ?? p.imageUrl ?? null,
          in_stock: p.inStock ?? 1,
        });
      }
    }

    // Fallback: scrape category page
    if (!results.length) {
      const pageRes = await fetch("https://www.power.se/leksaker/lego/", {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
          "Accept": "text/html",
        },
      });
      if (pageRes.ok) {
        const html = await pageRes.text();
        const $ = cheerio.load(html);

        $("[class*='product'], [data-product]").each((_, el) => {
          const name = $(el).find("[class*='name'], [class*='title']").first().text().trim();
          const priceText = $(el).find("[class*='price']").first().text().trim();
          const link = $(el).find("a").first().attr("href");

          if (!name || !priceText) return;
          const price = parseFloat(priceText.replace(/[^0-9]/g, ""));
          if (!price) return;

          results.push({
            set_number: name.match(/\b(\d{5,6})\b/)?.[1] ?? null,
            name,
            store: "Power",
            store_url: link ? `https://www.power.se${link}` : "https://www.power.se",
            price_local: price,
            currency: "SEK",
            image_url: null,
            in_stock: 1,
          });
        });
      }
    }
  } catch (e) {
    console.error("[Power]", e.message);
  }

  return results;
}
