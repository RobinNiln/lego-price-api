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
      const html = await fetchWithBrowser(store.url, 7000);
      const $ = cheerio.load(html);

      // Log product-related classes to find right selector
      const classNames = new Set();
      $("*").each((_, el) => {
        const cls = $(el).attr("class") || "";
        cls.split(" ").forEach(c => {
          if (c.toLowerCase().includes("product") || c.toLowerCase().includes("leaf") || c.toLowerCase().includes("tile")) {
            classNames.add(c);
          }
        });
      });
      console.log(`[LEGO ${store.name}] Classes:`, [...classNames].slice(0, 10).join(", "));

      const selectors = [
        "[data-test='product-leaf']",
        "[class*='ProductLeaf']",
        "[class*='product-leaf']",
        "[class*='Tile']",
        "[class*='tile']",
        "li[class*='Product']",
        "li[class*='product']",
        "[class*='GridItem']",
        "article",
      ];

      for (const sel of selectors) {
        const items = $(sel);
        if (items.length < 2) continue;
        console.log(`[LEGO ${store.name}] Trying ${sel}: ${items.length} items`);

        items.each((_, el) => {
          const name = $(el).find("h2, h3, [class*='name'], [class*='Name'], [class*='title']").first().text().trim();
          let price = 0;
          $(el).find("*").each((__, child) => {
            if ($(child).children().length > 0) return;
            const text = $(child).text().trim();
            const num = parseFloat(text.replace(/\s/g, "").replace(",", ".").replace(/[^0-9.]/g, ""));
            if (num > 50 && num < 50000 && num > price) price = num;
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

        if (results.filter(r => r.store === store.name).length > 0) break;
      }

      console.log(`[LEGO ${store.name}] Scraped ${results.filter(r => r.store === store.name).length} products`);
    } catch (e) {
      console.error(`[LEGO ${store.name}]`, e.message);
    }
  }

  console.log(`[LEGO Shop] Total: ${results.length} products`);
  return results;
}
