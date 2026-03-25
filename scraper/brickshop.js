import fetch from "node-fetch";
import * as cheerio from "cheerio";

const MIN_PRICE = 5;
const MAX_PRICE = 800;

const URLS = [
  "https://www.brickshop.eu/legohtml.html?limit=96&p=1",
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

      // Log ALL classes to find product containers
      const cls = new Set();
      $("*").each((_, el) => {
        ($(el).attr("class") || "").split(" ").forEach(c => { if (c.length > 2) cls.add(c); });
      });
      console.log(`[BrickShop] ALL classes:`, [...cls].join(", "));

      // Log all links containing "lego"
      const links = [];
      $("a[href*='lego'], a[href*='LEGO']").each((_, el) => {
        links.push($(el).attr("href"));
      });
      console.log(`[BrickShop] LEGO links (first 10):`, links.slice(0, 10).join(", "));

      // Log h2/h3 text
      const headings = [];
      $("h2, h3").each((_, el) => { headings.push($(el).text().trim()); });
      console.log(`[BrickShop] Headings:`, headings.slice(0, 10).join(" | "));

    } catch (e) {
      console.error("[BrickShop]", e.message);
    }
  }

  console.log(`[BrickShop] Scraped ${results.length} products`);
  return results;
}
