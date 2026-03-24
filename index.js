import express from "express";
import cron from "node-cron";
import db from "./db.js";
import bricksetRouter from "./api/brickset.js";
import { runAllScrapers } from "./scraper/run.js";

const app = express();
const PORT = process.env.PORT || 3001;

// CORS
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  next();
});

app.use(express.json());
app.use("/api/brickset", bricksetRouter);

// GET /api/deals – latest deals, deduplicated per store+set
app.get("/api/deals", (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT * FROM prices p1
      WHERE fetched_at > datetime('now', '-12 hours')
      AND id = (
        SELECT id FROM prices p2
        WHERE p2.store = p1.store
        AND (
          (p2.set_number IS NOT NULL AND p2.set_number = p1.set_number)
          OR
          (p2.set_number IS NULL AND p2.name = p1.name)
        )
        ORDER BY fetched_at DESC
        LIMIT 1
      )
      ORDER BY price_sek ASC
      LIMIT 300
    `).all();
    res.json({ deals: rows, count: rows.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/search?q=star+wars – search by name or set number
app.get("/api/search", (req, res) => {
  const q = req.query.q?.trim();
  if (!q) return res.status(400).json({ error: "Missing query" });
  try {
    // Split query into words and search for each (AND logic)
    const words = q.toLowerCase().split(/\s+/).filter(w => w.length > 1);
    const conditions = words.map(() => "LOWER(name) LIKE ?").join(" AND ");
    const params = words.map(w => `%${w}%`);

    const rows = db.prepare(`
      SELECT * FROM prices
      WHERE (
        (${conditions})
        OR LOWER(set_number) LIKE ?
      )
      AND fetched_at > datetime('now', '-12 hours')
      ORDER BY price_sek ASC
      LIMIT 200
    `).all(...params, `%${q.toLowerCase()}%`);

    res.json({ deals: rows, count: rows.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/status – health check
app.get("/api/status", (req, res) => {
  const count = db.prepare("SELECT COUNT(*) as c FROM prices").get();
  const latest = db.prepare("SELECT MAX(fetched_at) as t FROM prices").get();
  res.json({ ok: true, totalPrices: count.c, lastScrape: latest.t });
});

// Run scrapers every 6 hours
cron.schedule("0 */6 * * *", async () => {
  console.log("[cron] Starting scrape...");
  await runAllScrapers();
  console.log("[cron] Done.");
});

// Run once on startup
console.log("[startup] Running initial scrape...");
runAllScrapers().catch(console.error);

app.listen(PORT, () => console.log(`API running on port ${PORT}`));
