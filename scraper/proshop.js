import fetch from "node-fetch";
import * as cheerio from "cheerio";

const MIN_PRICE = 49;
const MAX_PRICE = 8000;

const URLS = [
  "https://www.proshop.dk/Legetoej?search=lego+star+wars",
  "https://www.proshop.dk/Legetoej?search=lego+technic",
  "https://www.proshop.dk/Legetoej?search=lego+city",
  "https://www.proshop.dk/Legetoej?search=lego+ninjago",
  "https://www.proshop.dk/Legetoej?search=lego+creator",
  "https://www.proshop.dk/Legetoej?search=lego+friends",
  "https://www.proshop.dk/Legetoej?search=lego+harry+potter",
  "https://www.proshop.dk/Legetoej?search=lego",
];

export async function scrapeProshop() {
  const results = [];
  const seen = new Set();

  for (const url of URLS) {
    try {
      // Proshop returns almost empty HTML to Puppeteer (bot detection)
      // Plain fetch with browser-like headers works much better
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "da-DK,da;q=0.9,en;q=0.8",
          "Accept-Encoding": "gzip, deflate, br",
          "Cache-Control": "no-cache",
          "Referer": "https://www.proshop.dk/",
        },
        timeout: 20000,
      });

      if (!res.ok) {
        console.log(`[Proshop] HTTP ${res.status} for ${url}`);
        continue;
      }

      const html = await res.text();
      console.log(`[Proshop] ${url} - length: ${html.length}`);
      const $ = cheerio.load(html);
      let foundOnPage = 0;

      // JSON-LD
      $("script[type='application/ld+json']").each((_, el) => {
        try {
          const data = JSON.parse($(el).html());
          const items = Array.isArray(data) ? data : [data];
          for (const item of items) {
            if (item["@type"] !== "Product") continue;
            if (!item.name?.toLowerCase().includes("lego")) continue;
            if (seen.has(item.name)) continue;
            const price = parseFloat(item.offers?.price ?? 0);
            if (price < MIN_PRICE || price > MAX_PRICE) continue;
            seen.add(item.name);
            foundOnPage++;
            results.push({
              set_number: item.name?.match(/\b(\d{5})\b/)?.[1] ?? null,
              name: item.name,
              store: "Proshop DK",
              store_url: item.offers?.url ?? "https://www.proshop.dk",
              price_local: price,
              currency: "DKK",
              image_url: Array.isArray(item.image) ? item.image[0] : item.image ?? null,
              in_stock: item.offers?.availability?.includes("InStock") ? 1 : 0,
            });
          }
        } catch {}
      });

      // DOM fallback
      if (foundOnPage === 0) {
        $("[class*='product'], [class*='site-product'], [class*='search-result']").each((_, el) => {
          const $el = $(el);
          const name = $el.find("[class*='name'], [class*='title'], h2, h3").first().text().trim();
          if (!name?.toLowerCase().includes("lego")) return;
          if (seen.has(name)) return;
          let price = 0;
          $el.find("[class*='price']").each((__, p) => {
            const num = parseFloat(
              $(p).text().replace(/\s/g, "").replace(/,-$/, "").replace(",", ".").replace(/[^0-9.]/g, "")
            );
            if (num >= MIN_PRICE && num <= MAX_PRICE) price = num;
          });
          if (!price) return;
          seen.add(name);
          const link = $el.find("a").first().attr("href");
          results.push({
            set_number: name.match(/\b(\d{5})\b/)?.[1] ?? null,
            name: name.substring(0, 200),
            store: "Proshop DK",
            store_url: link
              ? link.startsWith("http") ? link : `https://www.proshop.dk${link}`
              : "https://www.proshop.dk",
            price_local: price,
            currency: "DKK",
            image_url: $el.find("img").first().attr("src") ?? null,
            in_stock: 1,
          });
        });
      }
    } catch (e) {
      console.error("[Proshop]", e.message);
    }
  }

  console.log(`[Proshop] Scraped ${results.length} products`);
  return results;
}
