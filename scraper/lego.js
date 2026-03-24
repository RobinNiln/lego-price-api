import { fetchWithBrowser } from "./browser.js";
import * as cheerio from "cheerio";

const STORES = [
  { lang: "sv-se", currency: "SEK", name: "LEGO Shop SE", url: "https://www.lego.com/sv-se/categories/new-sets" },
  { lang: "nb-no", currency: "NOK", name: "LEGO Shop NO", url: "https://www.lego.com/nb-no/categories/new-sets" },
  { lang: "da-dk", currency: "DKK", name: "LEGO Shop DK", url: "https://www.lego.com/da-dk/categories/new-sets" },
];

export async function scrapeLego() {
  const results = [];

  for (const store of STORES) {
    try {
      const html = await fetchWithBrowser(store.url, 6000);
      const $ = cheerio.load(html);

      // LEGO uses data attributes and specific class patterns
      const selectors = [
        "[data-test='product-leaf']",
        "[class*='ProductLeaf']",
        "[class*='product-leaf']",
        "[class*='ProductCard']",
        "[class*='product-card']",
        "li[class*='product']",
      ];

      let found = false;
      for (const sel of selectors) {
        const items = $(sel);
        if (items.length > 0) {
          console.log(`[LEGO ${store.name}] Found ${items.length} items with: ${sel}`);
          items.each((_, el) => {
            const name = $(el).find("[class*='name'], [class*='title'], h3, h2").first().text().trim();
            let price = 0;
            $(el).find("*").each((__, child) => {
              const text = $(child).children().length === 0 ? $(child).text().trim() : "";
              const p = parseFloat(text.replace(/\s/g, "").replace(",", ".").replace(/[^0-9.]/g, ""));
              if (p > 50 && p < 50000 && p > price) price = p;
            });
            const link = $(el).find("a").first().attr("href");
            if (!name || !price) return;
            results.push({
              set_number: name.match(/\b(\d{5,6})\b/)?.[1] ?? null,
              name: name.substring(0, 200),
              store: store.name,
              store_url: link ? (link.startsWith("http") ? link : `https://www.lego.com${link}`) : store.url,
              price_local: price,
              currency: store.currency,
              image_url: $(el).find("img").first().attr("src") ?? null,
              in_stock: 1,
            });
          });
          if (results.length > 0) { found = true; break; }
        }
      }

      if (!found) console.log(`[LEGO ${store.name}] No products found`);
    } catch (e) {
      console.error(`[LEGO ${store.name}]`, e.message);
    }
  }

  console.log(`[LEGO Shop] Total: ${results.length} products`);
  return results;
}
