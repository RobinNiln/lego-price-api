import fetch from "node-fetch";
import * as cheerio from "cheerio";

export async function scrapeInet() {
  const results = [];
  const pages = 3;

  for (let page = 1; page <= pages; page++) {
    try {
      const url = `https://www.inet.se/kategori/370/lego?page=${page}`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
          "Accept": "text/html",
          "Accept-Language": "sv-SE,sv;q=0.9",
        },
      });
      if (!res.ok) break;
      const html = await res.text();
      const $ = cheerio.load(html);

      $(".product-list-item, [data-testid='product-item'], .product-item").each((_, el) => {
        const name = $(el).find(".product-name, h2, h3").first().text().trim();
        const priceText = $(el).find(".price, .product-price, [class*='price']").first().text().trim();
        const link = $(el).find("a").first().attr("href");
        const img = $(el).find("img").first().attr("src") ?? null;

        if (!name || !priceText || !link) return;
        const price = parseFloat(priceText.replace(/[^0-9,.]/g, "").replace(",", "."));
        if (!price || price <= 0) return;

        const setMatch = name.match(/\b(\d{5,6})\b/);
        results.push({
          set_number: setMatch?.[1] ?? null,
          name,
          store: "Inet",
          store_url: link.startsWith("http") ? link : `https://www.inet.se${link}`,
          price_local: price,
          currency: "SEK",
          image_url: img,
          in_stock: 1,
        });
      });
    } catch (e) {
      console.error("[Inet] page", page, e.message);
      break;
    }
  }

  return results;
}
