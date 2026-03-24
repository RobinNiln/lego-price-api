import { fetchWithBrowser } from "./browser.js";
import * as cheerio from "cheerio";

const MIN_PRICE = 49;
const MAX_PRICE = 8000;

const URLS = [
  "https://www.power.se/leksaker/lego/",
  "https://www.power.se/search/?q=lego+star+wars",
  "https://www.power.se/search/?q=lego+technic",
  "https://www.power.se/search/?q=lego+city",
  "https://www.power.se/search/?q=lego+harry+potter",
  "https://www.power.se/search/?q=lego+ninjago",
  "https://www.power.se/search/?q=lego+creator",
  "https://www.power.se/search/?q=lego+friends",
];

export async function scrapePower() {
  const results = [];
  const seen = new Set();

  for (const url of URLS) {
    try {
      const html = await fetchWithBrowser(url, 6000);
      const $ = cheerio.load(html);

      $("[class*='product-item']").each((_, el) => {
        const $el = $(el);
        const name = $el.find("[class*='product-item-title']").text().trim() ||
                     $el.find("h2, h3").first().text().trim();
        if (!name?.toLowerCase().includes("lego")) return;
        if (seen.has(name)) return;

        let price = 0;
        const priceText = $el.find("[class='product-price'], [class*='product-item-price']")
          .first().text().trim();
        if (priceText) {
          const num = parseFloat(priceText.replace(/\s/g,"").replace(/\.-$/,"").replace(",",".").replace(/[^0-9.]/g,""));
          if (num >= MIN_PRICE && num <= MAX_PRICE) price = num;
        }
        if (!price) {
          $el.find("[class*='price']").each((__, p) => {
            const num = parseFloat($(p).text().replace(/\s/g,"").replace(/\.-$/,"").replace(",",".").replace(/[^0-9.]/g,""));
            if (num >= MIN_PRICE && num <= MAX_PRICE) price = num;
          });
        }
        if (!price) return;

        seen.add(name);
        const link = $el.find("a").first().attr("href");
        const img = $el.find("img").first().attr("src") ?? $el.find("img").first().attr("data-src") ?? null;

        results.push({
          set_number: name.match(/\b(\d{5})\b/)?.[1] ?? null,
          name: name.substring(0, 200),
          store: "Power",
          store_url: link ? (link.startsWith("http") ? link : `https://www.power.se${link}`) : "https://www.power.se",
          price_local: price,
          currency: "SEK",
          image_url: img,
          in_stock: 1,
        });
      });
    } catch (e) {
      console.error("[Power]", e.message);
    }
  }

  console.log(`[Power] Scraped ${results.length} products`);
  return results;
}
