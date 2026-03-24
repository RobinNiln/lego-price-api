import puppeteer from "puppeteer";
import { getBrowser } from "./browser.js";
import * as cheerio from "cheerio";

const STORES = [
  { lang: "sv-se", currency: "SEK", name: "LEGO Shop SE", url: "https://www.lego.com/sv-se/categories/new-sets" },
  { lang: "nb-no", currency: "NOK", name: "LEGO Shop NO", url: "https://www.lego.com/nb-no/categories/new-sets" },
  { lang: "da-dk", currency: "DKK", name: "LEGO Shop DK", url: "https://www.lego.com/da-dk/categories/new-sets" },
];

async function fetchLegoPage(url) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
    });
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    );

    await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });

    // Dismiss cookie banner
    const cookieBtns = [
      "#onetrust-accept-btn-handler",
      "button[id*='accept']",
      "button[class*='accept']",
    ];
    for (const sel of cookieBtns) {
      try {
        const btn = await page.$(sel);
        if (btn) { await btn.click(); await new Promise(r => setTimeout(r, 1000)); break; }
      } catch {}
    }

    // Scroll down to trigger lazy loading
    await page.evaluate(async () => {
      await new Promise(resolve => {
        let totalHeight = 0;
        const distance = 500;
        const timer = setInterval(() => {
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= 5000) { clearInterval(timer); resolve(); }
        }, 200);
      });
    });

    // Wait for product cards to appear
    await new Promise(r => setTimeout(r, 5000));

    return await page.content();
  } finally {
    await page.close();
  }
}

export async function scrapeLego() {
  const results = [];

  for (const store of STORES) {
    try {
      const html = await fetchLegoPage(store.url);
      const $ = cheerio.load(html);

      // LEGO.com uses data-test attributes
      const selectors = [
        "[data-test='product-leaf']",
        "[class*='ProductLeaf']",
        "[class*='product-leaf']",
        "[class*='Leaf']",
        "li[class*='product']",
        "article[class*='product']",
      ];

      let found = false;
      for (const sel of selectors) {
        const items = $(sel);
        if (items.length < 2) continue;
        console.log(`[LEGO ${store.name}] ${sel}: ${items.length} items`);
        found = true;

        items.each((_, el) => {
          const $el = $(el);
          const name = $el.find("h2, h3, [class*='name'], [class*='Name']").first().text().trim();
          if (!name) return;

          // Find price – look for text matching price format
          let price = 0;
          $el.find("*").each((__, child) => {
            if ($(child).children().length > 0) return;
            const text = $(child).text().trim();
            const num = parseFloat(
              text.replace(/\s/g, "").replace(/[^0-9.,]/g, "").replace(",", ".")
            );
            if (num > 50 && num < 50000 && num > price) price = num;
          });

          const link = $el.find("a").first().attr("href");
          if (!name || !price) return;

          results.push({
            set_number: name.match(/\b(\d{5,6})\b/)?.[1] ?? null,
            name: name.substring(0, 200),
            store: store.name,
            store_url: link
              ? link.startsWith("http") ? link : `https://www.lego.com${link}`
              : store.url,
            price_local: price,
            currency: store.currency,
            image_url: $el.find("img").first().attr("src") ?? null,
            in_stock: 1,
          });
        });
        if (found) break;
      }

      // Fallback: JSON-LD
      if (!found || results.filter(r => r.store === store.name).length === 0) {
        $("script[type='application/ld+json']").each((_, el) => {
          try {
            const data = JSON.parse($(el).html());
            const items = Array.isArray(data) ? data : [data];
            for (const item of items) {
              if (item["@type"] !== "Product") continue;
              const price = parseFloat(item.offers?.price ?? 0);
              if (!price || price > 50000) continue;
              results.push({
                set_number: item.name?.match(/\b(\d{5,6})\b/)?.[1] ?? null,
                name: item.name?.substring(0, 200),
                store: store.name,
                store_url: item.offers?.url ?? store.url,
                price_local: price,
                currency: store.currency,
                image_url: Array.isArray(item.image) ? item.image[0] : item.image ?? null,
                in_stock: item.offers?.availability?.includes("InStock") ? 1 : 0,
              });
            }
          } catch {}
        });
      }

      console.log(`[LEGO ${store.name}] ${results.filter(r => r.store === store.name).length} products`);
    } catch (e) {
      console.error(`[LEGO ${store.name}]`, e.message);
    }
  }

  console.log(`[LEGO Shop] Total: ${results.length} products`);
  return results;
}
