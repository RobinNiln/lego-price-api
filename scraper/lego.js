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
      const html = await fetchWithBrowser(store.url, 4000);
      const $ = cheerio.load(html);

      console.log(`[LEGO ${store.name}] Content length: ${html.length}`);

      // Try JSON-LD
      $("script[type='application/ld+json']").each((_, el) => {
        try {
          const data = JSON.parse($(el).html());
          const items = Array.isArray(data) ? data : [data];
          for (const item of items) {
            if (item["@type"] !== "Product") continue;
            const price = parseFloat(item.offers?.price ?? 0);
            if (!price) continue;
            results.push({
              set_number: item.name?.match(/\b(\d{5,6})\b/)?.[1] ?? null,
              name: item.name,
              store: store.name,
              store_url: item.offers?.url ?? store.url,
              price_local: price,
              currency: store.currency,
              image_url: Array.isArray(item.image) ? item.image[0] : item.image ?? null,
              in_stock: item.offers?.availability?.includes("InStock") ? 1 : 0,
            });
          }
        } catch {}
      });

      // Try product cards
      if (!results.length) {
        $("[class*='ProductLeaf'], [class*='product-leaf'], [data-test='product-leaf']").each((_, el) => {
          const name = $(el).find("[class*='name'], [class*='title']").first().text().trim();
          const priceText = $(el).find("[class*='price']").first().text().trim();
          const link = $(el).find("a").first().attr("href");
          if (!name || !priceText) return;
          const price = parseFloat(priceText.replace(/\s/g,"").replace(",",".").replace(/[^0-9.]/g,""));
          if (!price) return;
          results.push({
            set_number: name.match(/\b(\d{5,6})\b/)?.[1] ?? null,
            name,
            store: store.name,
            store_url: link ? (link.startsWith("http") ? link : `https://www.lego.com${link}`) : store.url,
            price_local: price,
            currency: store.currency,
            image_url: $(el).find("img").first().attr("src") ?? null,
            in_stock: 1,
          });
        });
      }

      console.log(`[LEGO ${store.name}] Scraped ${results.length} products so far`);
    } catch (e) {
      console.error(`[LEGO ${store.name}]`, e.message);
    }
  }

  console.log(`[LEGO Shop] Total: ${results.length} products`);
  return results;
}
