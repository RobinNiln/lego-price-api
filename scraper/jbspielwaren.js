import fetch from "node-fetch";
import * as cheerio from "cheerio";

const MIN_PRICE = 5;
const MAX_PRICE = 800;

const URLS = [
  "https://www.jb-spielwaren.de/en/lego/",
];

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
};

export async function scrapeJBSpielwaren() {
  const results = [];

  for (const url of URLS) {
    try {
      const res = await fetch(url, { headers: HEADERS, timeout: 20000 });
      if (!res.ok) { console.log(`[JB Spielwaren] HTTP ${res.status}`); continue; }
      const html = await res.text();
      console.log(`[JB Spielwaren] length: ${html.length}`);
      const $ = cheerio.load(html);

      // Log ALL classes
      const cls = new Set();
      $("*").each((_, el) => {
        ($(el).attr("class") || "").split(" ").forEach(c => { if (c.length > 2) cls.add(c); });
      });
      console.log(`[JB Spielwaren] ALL classes:`, [...cls].join(", "));

      // Log product-related elements
      $("[class*='product'], [class*='Product'], [data-product-id], article").each((_, el) => {
        const $el = $(el);
        console.log(`[JB Spielwaren] Found element:`, $el.attr("class"), "| text:", $el.text().substring(0, 100).trim());
      });

      // Log h2/h3
      const headings = [];
      $("h2, h3, h4").each((_, el) => { headings.push($(el).text().trim()); });
      console.log(`[JB Spielwaren] Headings:`, headings.slice(0, 15).join(" | "));

    } catch (e) {
      console.error("[JB Spielwaren]", e.message);
    }
  }

  console.log(`[JB Spielwaren] Scraped ${results.length} products`);
  return results;
}
