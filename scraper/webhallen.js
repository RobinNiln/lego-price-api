import db from "../db.js";
import { scrapeWebhallen } from "./webhallen.js";
import { scrapeInet } from "./inet.js";
import { scrapePower } from "./power.js";
import { scrapeElgiganten } from "./elgiganten.js";
import { scrapeLego } from "./lego.js";

const SCRAPERS = [
  { name: "Webhallen",   fn: scrapeWebhallen },
  { name: "Inet",        fn: scrapeInet },
  { name: "Power",       fn: scrapePower },
  { name: "Elgiganten",  fn: scrapeElgiganten },
  { name: "LEGO Shop",   fn: scrapeLego },
];

// Approximate SEK exchange rates (updated periodically)
const SEK_RATES = { SEK: 1, NOK: 0.95, DKK: 1.48, EUR: 11.2 };

export async function runAllScrapers() {
  const insert = db.prepare(`
    INSERT INTO prices (set_number, name, store, store_url, price_local, currency, price_sek, image_url, in_stock, fetched_at)
    VALUES (@set_number, @name, @store, @store_url, @price_local, @currency, @price_sek, @image_url, @in_stock, CURRENT_TIMESTAMP)
  `);

  // Delete old data before inserting fresh
  db.prepare("DELETE FROM prices WHERE fetched_at < datetime('now', '-13 hours')").run();

  for (const scraper of SCRAPERS) {
    try {
      console.log(`[scraper] Running ${scraper.name}...`);
      const results = await scraper.fn();
      console.log(`[scraper] ${scraper.name}: ${results.length} products`);

      const insertMany = db.transaction((items) => {
        for (const item of items) {
          const rate = SEK_RATES[item.currency] ?? 1;
          insert.run({
            ...item,
            price_sek: Math.round(item.price_local * rate),
          });
        }
      });
      insertMany(results);
    } catch (e) {
      console.error(`[scraper] ${scraper.name} failed:`, e.message);
    }
  }
  console.log("[scraper] All scrapers done.");
}
