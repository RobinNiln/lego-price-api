import { fetchWithBrowser } from "./browser.js";
import * as cheerio from "cheerio";

// Valid LEGO price range in SEK
const MIN_PRICE = 49;
const MAX_PRICE = 8000;

function extractPrice($el, $) {
  // Strategy 1: Look for explicit price class with currency symbol
  const priceSelectors = [
    "[class*='sales-price']",
    "[class*='SalesPrice']",
    "[class*='current-price']",
    "[class*='CurrentPrice']",
    "[class*='offer-price']",
    "[class*='product-price']",
  ];

  for (const sel of priceSelectors) {
    const el = $el.find(sel).first();
    if (!el.length) continue;
    const text = el.text().trim();
    // Must contain ".-" or "kr" to be a price
    if (!text.includes(".-") && !text.includes("kr") && !text.includes(":-")) continue;
    const num = parseFloat(text.replace(/\s/g, "").replace(/\.-$/, "").replace(",", ".").replace(/[^0-9.]/g, ""));
    if (num >= MIN_PRICE && num <= MAX_PRICE) return num;
  }

  // Strategy 2: Find text node that contains ".-" or "kr" suffix
  let price = 0;
  $el.find("*").each((_, child) => {
    const $child = $(child);
    if ($child.children().length > 0) return; // leaf nodes only
    const text = $child.text().trim();
    // Must match price format: "429.-" or "429 kr" or "1 299.-"
    if (!text.match(/\d[\d\s]*[.,-]\s*[-]?$/) && !text.match(/\d[\d\s]*\s*kr$/)) return;
    const num = parseFloat(text.replace(/\s/g, "").replace(/\.-$/, "").replace(",", ".").replace(/[^0-9.]/g, ""));
    if (num >= MIN_PRICE && num <= MAX_PRICE && num > price) price = num;
  });

  return price;
}

export async function scrapeElgiganten() {
  const results = [];
  try {
    const html = await fetchWithBrowser(
      "https://www.elgiganten.se/search?q=lego&sz=60", 5000
    );
    const $ = cheerio.load(html);

    $("[class*='product-card']").each((_, el) => {
      const $el = $(el);
      const name = $el.find("[class*='product-name'], [class*='ProductName'], h2, h3")
        .first().text().trim();
      if (!name?.toLowerCase().includes("lego")) return;

      const price = extractPrice($el, $);
      if (!price) {
        console.log(`[Elgiganten] No valid price for: ${name.substring(0, 50)}`);
        return;
      }

      const link = $el.find("a").first().attr("href");
      const img = $el.find("img").first().attr("src") ??
                  $el.find("img").first().attr("data-src") ?? null;
      const setMatch = name.match(/\b(\d{5})\b/);

      results.push({
        set_number: setMatch?.[1] ?? null,
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

    console.log(`[Elgiganten] Scraped ${results.length} products`);
  } catch (e) {
    console.error("[Elgiganten]", e.message);
  }
  return results;
}
