import fetch from "node-fetch";
import * as cheerio from "cheerio";

const MIN_PRICE = 5;
const MAX_PRICE = 800;

const URLS = [
  "https://www.jb-spielwaren.de/en/lego/?order=price_asc&p=1",
  "https://www.jb-spielwaren.de/en/lego/?order=price_asc&p=2",
  "https://www.jb-spielwaren.de/en/lego/?order=price_asc&p=3",
  "https://www.jb-spielwaren.de/en/lego/lego-star-wars/?order=price_asc",
  "https://www.jb-spielwaren.de/en/lego/lego-technic/?order=price_asc",
  "https://www.jb-spielwaren.de/en/lego/lego-city/?order=price_asc",
];

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
};

export async function scrapeJBSpielwaren() {
  const results = [];
  const seen = new Set();

  for (const url of URLS) {
    try {
      const res = await fetch(url, { headers: HEADERS, timeout: 20000 });
      if (!res.ok) { console.log(`[JB Spielwaren] HTTP ${res.status}`); continue; }
      const html = await res.text();
      console.log(`[JB Spielwaren] ${url} - length: ${html.length}`);
      const $ = cheerio.load(html);

      let found = 0;

      // JSON-LD
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
              store: "JB Spielwaren DE",
              store_url: item.offers?.url ?? item.url ?? "https://www.jb-spielwaren.de",
              price_local: price,
              currency: "EUR",
              image_url: Array.isArray(item.image) ? item.image[0] : item.image ?? null,
              in_stock: item.offers?.availability?.includes("InStock") ? 1 : 0,
            });
          }
        } catch {}
      });

      if (found > 0) { console.log(`[JB Spielwaren] ${found} via JSON-LD`); continue; }

      // DOM fallback
      $("[class*='product'], article").each((_, el) => {
        const $el = $(el);
        const name = $el.find("h2, h3, [class*='title'], [class*='name']").first().text().trim();
        if (!name || name.length < 5) return;
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
          store: "JB Spielwaren DE",
          store_url: link ? (link.startsWith("http") ? link : `https://www.jb-spielwaren.de${link}`) : "https://www.jb-spielwaren.de",
          price_local: price,
          currency: "EUR",
          image_url: $el.find("img").first().attr("src") ?? null,
          in_stock: 1,
        });
      });
    } catch (e) {
      console.error("[JB Spielwaren]", e.message);
    }
  }

  console.log(`[JB Spielwaren] Scraped ${results.length} products`);
  return results;
}
