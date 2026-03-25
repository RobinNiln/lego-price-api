import { fetchWithBrowser } from "./browser.js";
import * as cheerio from "cheerio";

const MIN_PRICE = 49;
const MAX_PRICE = 8000;

// Elgiganten has many LEGO category pages – scrape them all
const URLS = [
  "https://www.elgiganten.se/search?q=lego&sz=60",
  "https://www.elgiganten.se/search?q=lego+star+wars&sz=60",
  "https://www.elgiganten.se/search?q=lego+technic&sz=60",
  "https://www.elgiganten.se/search?q=lego+city&sz=60",
  "https://www.elgiganten.se/search?q=lego+ninjago&sz=60",
  "https://www.elgiganten.se/search?q=lego+harry+potter&sz=60",
  "https://www.elgiganten.se/search?q=lego+creator&sz=60",
  "https://www.elgiganten.se/search?q=lego+friends&sz=60",
  "https://www.elgiganten.se/search?q=lego+minecraft&sz=60",
  "https://www.elgiganten.se/search?q=lego+icons&sz=60",
];

function extractPrice($el, $) {
  const priceSelectors = [
    "[class*='sales-price']",
    "[class*='SalesPrice']",
    "[class*='current-price']",
    "[class*='offer-price']",
    "[class*='product-price']",
  ];
  for (const sel of priceSelectors) {
    const el = $el.find(sel).first();
    if (!el.length) continue;
    const text = el.text().trim();
    if (!text.includes(".-") && !text.includes("kr") && !text.includes(":-")) continue;
    const num = parseFloat(text.replace(/\s/g, "").replace(/\.-$/, "").replace(",", ".").replace(/[^0-9.]/g, ""));
    if (num >= MIN_PRICE && num <= MAX_PRICE) return num;
  }
  let price = 0;
  $el.find("*").each((_, child) => {
    const $child = $(child);
    if ($child.children().length > 0) return;
    const text = $child.text().trim();
    if (!text.match(/\d[\d\s]*[.,-]\s*[-]?$/) && !text.match(/\d[\d\s]*\s*kr$/)) return;
    const num = parseFloat(text.replace(/\s/g, "").replace(/\.-$/, "").replace(",", ".").replace(/[^0-9.]/g, ""));
    if (num >= MIN_PRICE && num <= MAX_PRICE && num > price) price = num;
  });
  return price;
}

export async function scrapeElgiganten() {
  const results = [];
  const seen = new Set();
  let cookieClicked = false;

  for (const url of URLS) {
    try {
      const html = await fetchWithBrowser(url, 5000);
      const $ = cheerio.load(html);

      $("[class*='product-card']").each((_, el) => {
        const $el = $(el);
        const name = $el.find("[class*='product-name'], [class*='ProductName'], h2, h3")
          .first().text().trim();
        if (!name?.toLowerCase().includes("lego")) return;
        if (seen.has(name)) return;

        const price = extractPrice($el, $);
        if (!price) return;

        seen.add(name);
        const link = $el.find("a").first().attr("href");
        const img = $el.find("img").first().attr("src") ?? $el.find("img").first().attr("data-src") ?? null;

        results.push({
          set_number: name.match(/\b(\d{5})\b/)?.[1] ?? null,
          name: name.substring(0, 200),
          store: "Elgiganten",
          store_url: link
            ? (link.startsWith("http") ? link : `https://www.elgiganten.se${link}`)
            : "https://www.elgiganten.se",
          price_local: price,
          currency: "SEK",
          image_url: img,
          in_stock: 1,
        });
      });
    } catch (e) {
      console.error("[Elgiganten]", e.message);
    }
  }

  console.log(`[Elgiganten] Scraped ${results.length} products`);
  return results;
}
