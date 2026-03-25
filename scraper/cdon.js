import fetch from "node-fetch";
import * as cheerio from "cheerio";

const MIN_PRICE = 49;
const MAX_PRICE = 8000;

// CDON uses /manufacturer/ and /lego/ category URLs
const URLS = [
  "https://cdon.se/manufacturer/lego/?pagesize=60&sortby=price_asc",
  "https://cdon.se/lego/lego-leksaker/?pagesize=60&sortby=price_asc",
  "https://cdon.se/manufacturer/lego-technic/?pagesize=60",
  "https://cdon.se/manufacturer/lego/?pagesize=60&page=2",
  "https://cdon.se/manufacturer/lego/?pagesize=60&page=3",
];

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "sv-SE,sv;q=0.9",
  "Referer": "https://cdon.se/",
};

export async function scrapeCDON() {
  const results = [];
  const seen = new Set();

  for (const url of URLS) {
    try {
      const res = await fetch(url, { headers: HEADERS, timeout: 20000 });
      if (!res.ok) { console.log(`[CDON] HTTP ${res.status} for ${url}`); continue; }
      const html = await res.text();
      console.log(`[CDON] ${url} - length: ${html.length}`);
      const $ = cheerio.load(html);

      // Strategy 1: JSON-LD
      let found = 0;
      $("script[type='application/ld+json']").each((_, el) => {
        try {
          const data = JSON.parse($(el).html());
          const items = Array.isArray(data) ? data : [data];
          for (const item of items) {
            if (item["@type"] !== "Product") continue;
            if (!item.name?.toLowerCase().includes("lego")) continue;
            if (seen.has(item.name)) continue;
            const price = parseFloat(item.offers?.price ?? item.offers?.lowPrice ?? 0);
            if (price < MIN_PRICE || price > MAX_PRICE) continue;
            seen.add(item.name);
            found++;
            results.push({
              set_number: item.name?.match(/\b(\d{5,6})\b/)?.[1] ?? null,
              name: item.name,
              store: "CDON",
              store_url: item.offers?.url ?? item.url ?? "https://cdon.se",
              price_local: price,
              currency: "SEK",
              image_url: Array.isArray(item.image) ? item.image[0] : item.image ?? null,
              in_stock: item.offers?.availability?.includes("InStock") ? 1 : 0,
            });
          }
        } catch {}
      });

      if (found > 0) { console.log(`[CDON] ${url}: ${found} via JSON-LD`); continue; }

      // Strategy 2: DOM – CDON is a marketplace with standard HTML
      $("[class*='product'], [class*='Product'], article, [data-testid*='product']").each((_, el) => {
        const $el = $(el);
        const name = $el.find("h2, h3, [class*='title'], [class*='name'], [class*='heading']").first().text().trim();
        if (!name?.toLowerCase().includes("lego")) return;
        if (seen.has(name)) return;
        let price = 0;
        $el.find("[class*='price'], [class*='Price']").each((__, p) => {
          const num = parseFloat($(p).text().replace(/\s/g, "").replace(/:-$/, "").replace(",", ".").replace(/[^0-9.]/g, ""));
          if (num >= MIN_PRICE && num <= MAX_PRICE) price = num;
        });
        if (!price) return;
        seen.add(name);
        const link = $el.find("a").first().attr("href");
        results.push({
          set_number: name.match(/\b(\d{5,6})\b/)?.[1] ?? null,
          name: name.substring(0, 200),
          store: "CDON",
          store_url: link ? (link.startsWith("http") ? link : `https://cdon.se${link}`) : "https://cdon.se",
          price_local: price,
          currency: "SEK",
          image_url: $el.find("img").first().attr("src") ?? null,
          in_stock: 1,
        });
      });
    } catch (e) {
      console.error("[CDON]", e.message);
    }
  }

  console.log(`[CDON] Scraped ${results.length} products`);
  return results;
}
