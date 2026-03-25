import db from "../db.js";
import fetch from "node-fetch";
import { scrapeWebhallen } from "./webhallen.js";
import { scrapeInet } from "./inet.js";
import { scrapeElgiganten } from "./elgiganten.js";
import { scrapeEbrix } from "./ebrix.js";
import { scrapeToyspace } from "./toyspace.js";
import { scrapeKomplett } from "./komplett.js";
import { scrapeProshop } from "./proshop.js";
import { scrapeBilka } from "./bilka.js";
import { scrapeLego } from "./lego.js";

const SCRAPERS = [
  { name: "Webhallen",   fn: scrapeWebhallen },
  { name: "Inet",        fn: scrapeInet },
  { name: "Elgiganten",  fn: scrapeElgiganten },
  { name: "Ebrix",       fn: scrapeEbrix },
  { name: "ToySpace",    fn: scrapeToyspace },
  { name: "Komplett NO", fn: scrapeKomplett },
  { name: "Proshop DK",  fn: scrapeProshop },
  { name: "Bilka DK",    fn: scrapeBilka },
  { name: "LEGO Shop",   fn: scrapeLego },
];

// Fallback rates in case the API is unavailable
const FALLBACK_RATES = { SEK: 1, NOK: 0.95, DKK: 1.48, EUR: 11.2 };

/**
 * Fetch live exchange rates from frankfurter.app.
 * Returns rates relative to SEK (i.e. how many SEK per 1 unit of currency).
 */
async function fetchLiveRates() {
  try {
    // Fetch how many SEK we get per 1 unit of each currency
    const res = await fetch("https://api.frankfurter.app/latest?from=SEK&to=NOK,DKK,EUR", {
      timeout: 8000,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // data.rates gives us: { NOK: X, DKK: Y, EUR: Z }
    // These are "how many NOK/DKK/EUR you get for 1 SEK"
    // We need the inverse: "how many SEK per 1 NOK/DKK/EUR"
    const rates = { SEK: 1 };
    for (const [currency, rate] of Object.entries(data.rates)) {
      rates[currency] = 1 / rate;
    }

    console.log("[rates] Live rates fetched:", JSON.stringify(rates, null, 2));
    return rates;
  } catch (e) {
    console.warn("[rates] Could not fetch live rates, using fallback:", e.message);
    return FALLBACK_RATES;
  }
}

export async function runAllScrapers() {
  const insert = db.prepare(`
    INSERT INTO prices (set_number, name, store, store_url, price_local, currency, price_sek, image_url, in_stock, fetched_at)
    VALUES (@set_number, @name, @store, @store_url, @price_local, @currency, @price_sek, @image_url, @in_stock, CURRENT_TIMESTAMP)
  `);

  // Delete stale data
  db.prepare("DELETE FROM prices WHERE fetched_at < datetime('now', '-13 hours')").run();

  // Fetch live exchange rates once before running all scrapers
  const SEK_RATES = await fetchLiveRates();

  for (const scraper of SCRAPERS) {
    try {
      console.log(`[scraper] Running ${scraper.name}...`);
      const results = await scraper.fn();
      console.log(`[scraper] ${scraper.name}: ${results.length} products`);

      const insertMany = db.transaction((items) => {
        for (const item of items) {
          const rate = SEK_RATES[item.currency] ?? FALLBACK_RATES[item.currency] ?? 1;
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
