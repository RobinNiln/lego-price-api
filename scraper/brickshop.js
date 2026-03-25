import fetch from "node-fetch";
import * as cheerio from "cheerio";

const MIN_PRICE = 5;
const MAX_PRICE = 800;

// BrickShop uses VirtueMart (Joomla) - product classes are virtuemart-specific
const URLS = [
  "https://www.brickshop.eu/legohtml.html?limit=96&p=1",
  "https://www.brickshop.eu/legohtml.html?limit=96&p=2",
  "https://www.brickshop.eu/legohtml.html?limit=96&p=3",
];

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8",
};

export async function scrapeBrickShop() {
  const results = [];
  const seen = new Set();

  for (const url of URLS) {
    try {
      const res = await fetch(url, { headers: HEADERS, timeout: 20000 });
      if (!res.ok) { console.log(`[BrickShop] HTTP ${res.status}`); continue; }
      const html = await res.text();
      console.log(`[BrickShop] ${url} - length: ${html.length}`);
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
            const price = parseFloat(item.offers?.price ?? 0);
            if (price < MIN_PRICE || price > MAX_PRICE) continue;
            seen.add(item.name);
            found++;
            results.push({
              set_number: item.name?.match(/\b(\d{5,6})\b/)?.[1] ?? null,
              name: item.name,
              store: "BrickShop NL",
              store_url: item.offers?.url ?? "https://www.brickshop.eu",
              price_local: price,
              currency: "EUR",
              image_url: Array.isArray(item.image) ? item.image[0] : item.image ?? null,
              in_stock: item.offers?.availability?.includes("InStock") ? 1 : 0,
            });
          }
        } catch {}
      });

      if (found > 0) { console.log(`[BrickShop] ${found} via JSON-LD`); continue; }

      // VirtueMart DOM – product containers use specific VM classes
      const vmSelectors = [
        ".vm-product-container",
        "[class*='vm-product']",
        ".product-fields-container",
        "[class*='product-field']",
        "form[class*='product']",
        ".product",
      ];

      for (const sel of vmSelectors) {
        const cards = $(sel);
        if (cards.length < 2) continue;
        console.log(`[BrickShop] ${sel}: ${cards.length} items`);

        cards.each((_, el) => {
          const $el = $(el);
          const name = $el.find(".product-title, [class*='product-name'], [class*='title'], h2, h3").first().text().trim();
          if (!name || name.length < 5) return;
          if (seen.has(name)) return;

          let price = 0;
          $el.find("[class*='price'], .PricesalesPrice, .vm-sales-price").each((__, p) => {
            const text = $(p).text().trim();
            const num = parseFloat(text.replace(/[€\s]/g, "").replace(",", ".").replace(/[^0-9.]/g, ""));
            if (num >= MIN_PRICE && num <= MAX_PRICE) price = num;
          });
          if (!price) return;

          seen.add(name);
          const link = $el.find("a[href*='/lego']").first().attr("href") ?? $el.find("a").first().attr("href");
          results.push({
            set_number: name.match(/\b(\d{5,6})\b/)?.[1] ?? null,
            name: name.substring(0, 200),
            store: "BrickShop NL",
            store_url: link ? (link.startsWith("http") ? link : `https://www.brickshop.eu${link}`) : "https://www.brickshop.eu",
            price_local: price,
            currency: "EUR",
            image_url: $el.find("img").first().attr("src") ?? null,
            in_stock: 1,
          });
        });
        if (results.length > 0) break;
      }
    } catch (e) {
      console.error("[BrickShop]", e.message);
    }
  }

  console.log(`[BrickShop] Scraped ${results.length} products`);
  return results;
}
