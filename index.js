// GET /api/search?q=star+wars – search by name or set number
app.get("/api/search", (req, res) => {
  const q = req.query.q?.trim();
  if (!q) return res.status(400).json({ error: "Missing query" });
  try {
    // Split query into words and search for each word
    const words = q.toLowerCase().split(/\s+/).filter(w => w.length > 1);
    
    // Build WHERE clause for all words (AND logic)
    const conditions = words.map(() => "LOWER(name) LIKE ?").join(" AND ");
    const params = words.map(w => `%${w}%`);
    
    // Also search by set number
    const rows = db.prepare(`
      SELECT * FROM prices
      WHERE (
        (${conditions})
        OR set_number LIKE ?
      )
      AND fetched_at > datetime('now', '-12 hours')
      ORDER BY price_sek ASC
      LIMIT 200
    `).all(...params, `%${q}%`);
    
    res.json({ deals: rows, count: rows.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
