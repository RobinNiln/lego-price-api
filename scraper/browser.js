import puppeteer from "puppeteer";

let browser = null;

export async function getBrowser() {
  if (!browser || !browser.connected) {
    browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH ?? "/usr/bin/chromium",
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-first-run",
        "--no-zygote",
        "--single-process",
        "--disable-blink-features=AutomationControlled",
      ],
    });
  }
  return browser;
}

export async function fetchWithBrowser(url, waitFor = 3000) {
  const b = await getBrowser();
  const page = await b.newPage();
  try {
    // Hide automation signals
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
    });

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    );
    await page.setExtraHTTPHeaders({
      "Accept-Language": "sv-SE,sv;q=0.9,en;q=0.8",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Wait for content to load
    await new Promise(r => setTimeout(r, waitFor));

    // Try to wait for product elements
    try {
      await page.waitForSelector("[class*='product'], [data-product], article", { timeout: 5000 });
    } catch {}

    const content = await page.content();
    console.log(`[browser] ${url} - content length: ${content.length}`);
    return content;
  } finally {
    await page.close();
  }
}
