import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "fs";

if (!existsSync("./data")) mkdirSync("./data");

const db = new Database("./data/prices.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS prices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    set_number TEXT,
    name TEXT NOT NULL,
    store TEXT NOT NULL,
    store_url TEXT NOT NULL,
    price_local REAL NOT NULL,
    currency TEXT NOT NULL,
    price_sek REAL NOT NULL,
    image_url TEXT,
    in_stock INTEGER DEFAULT 1,
    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_name ON prices(name);
  CREATE INDEX IF NOT EXISTS idx_set ON prices(set_number);
  CREATE INDEX IF NOT EXISTS idx_fetched ON prices(fetched_at);
`);

export default db;
