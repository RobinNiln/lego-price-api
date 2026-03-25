import fetch from "node-fetch";
import * as cheerio from "cheerio";

const MIN_PRICE = 5;
const MAX_PRICE = 800; // EUR prices

const URLS = [
  "https://bricksdirect.com/all-lego?page=1&limit=96&sort=price_asc",
  "https://bricksdirect.com/all-lego?page=2&limit=96&sort=price_asc",
  "https://bricksdirect.com/all-lego?page=3&limit=96&sort=price_asc",
  "https://bricksdirect.com/all-lego?page=4&limit=96&sort=price_asc",
];

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8",
};

export async function scrapeBricksDirect() {
  const results = [];
  const seen = new Set();

  for (const url of URLS) {
    try {
      const res = await fetch(url, { headers: HEADERS, timeout: 20000 });
      if (!res.ok) { console.log(`[BricksDirect] HTTP ${res.status}`); continue; }
      const html = await res.text();
      console.log(`[BricksDirect] ${url} - length: ${html.length}`);
      const $ = cheerio.load(html);

      let found = 0;

      // Strategy 1: JSON-LD
      $("script[type='application/ld+json']").each((_, el) => {
        try {
          const data = JSON.parse($(el).html());
          const items = Array.isArray(data) ? data : [data];
          for (const item of items) {
            if (item["@type"] !== "Product") continue;
            if (seen.has(item.name)) continue;
            const price = parseFloat(item.offers?.price ?? item.offers?.lowPrice ?? 0);
            if (price < MIN_PRICE || price > MAX_PRICE) continue;
            seen.add(item.name);
            found++;
            results.push({
              set_number: item.name?.match(/\b(\d{5,6})\b/)?.[1] ?? null,
              name: item.name,
              store: "BricksDirect NL",
              store_url: item.offers?.url ?? item.url ?? "https://bricksdirect.com",
              price_local: price,
              currency: "EUR",
              image_url: Array.isArray(item.image) ? item.image[0] : item.image ?? null,
              in_stock: item.offers?.availability?.includes("InStock") ? 1 : 0,
            });
          }
        } catch {}
      });

      if (found > 0) { console.log(`[BricksDirect] ${found} via JSON-LD`); continue; }

      // Strategy 2: DOM – BricksDirect uses Magento-style HTML
      $("[class*='product-item'], [class*='product-card'], .item").each((_, el) => {
        const $el = $(el);
        const name = $el.find("[class*='product-name'], [class*='name'], h2, h3").first().text().trim();
        if (!name) return;
        if (seen.has(name)) return;

        let price = 0;
        $el.find("[class*='price']").each((__, p) => {
          const text = $(p).text().trim();
          const num = parseFloat(text.replace(/[€\s]/g, "").replace(",", ".").replace(/[^0-9.]/g, ""));
          if (num >= MIN_PRICE && num <= MAX_PRICE) price = num;
        });
        if (!price) return;

        seen.add(name);
        const link = $el.find("a").first().attr("href");
        results.push({
          set_number: name.match(/\b(\d{5,6})\b/)?.[1] ?? null,
          name: name.substring(0, 200),
          store: "BricksDirect NL",
          store_url: link ? (link.startsWith("http") ? link : `https://bricksdirect.com${link}`) : "https://bricksdirect.com",
          price_local: price,
          currency: "EUR",
          image_url: $el.find("img").first().attr("src") ?? null,
          in_stock: 1,
        });
      });
    } catch (e) {
      console.error("[BricksDirect]", e.message);
    }
  }

  console.log(`[BricksDirect] Scraped ${results.length} products`);
  return results;
}
