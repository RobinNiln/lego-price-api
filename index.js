import express from "express";
import cron from "node-cron";
import db from "./db.js";
import bricksetRouter from "./api/brickset.js";
import { runAllScrapers } from "./scraper/run.js";

const app = express();
const PORT = process.env.PORT || 3001;

// CORS – allow bestlegoprice.com and localhost
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});

app.use(express.json());
app.use("/api/brickset", bricksetRouter);
// GET /api/deals – latest deals sorted by price
app.get("/api/deals", (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT * FROM prices
      WHERE fetched_at > datetime('now', '-12 hours')
      ORDER BY price_sek ASC
      LIMIT 100
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
    const rows = db.prepare(`
      SELECT * FROM prices
      WHERE (LOWER(name) LIKE ? OR set_number LIKE ?)
      AND fetched_at > datetime('now', '-12 hours')
      ORDER BY price_sek ASC
      LIMIT 100
    `).all(`%${q.toLowerCase()}%`, `%${q}%`);
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
