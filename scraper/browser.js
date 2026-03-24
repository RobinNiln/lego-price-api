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
        "--window-size=1920,1080",
      ],
    });
  }
  return browser;
}

export async function fetchWithBrowser(url, waitFor = 5000) {
  const b = await getBrowser();
  const page = await b.newPage();
  try {
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
    });

    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    );
    await page.setExtraHTTPHeaders({
      "Accept-Language": "sv-SE,sv;q=0.9,en;q=0.8",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    });

    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    // Try to dismiss cookie banners
    const cookieSelectors = [
      "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll",
      "#cookie-information-template-wrapper button",
      "button[id*='accept']",
      "button[class*='accept']",
      "button[class*='cookie']",
      "[data-testid*='cookie'] button",
      "#onetrust-accept-btn-handler",
      ".coi-banner__accept",
    ];

    for (const sel of cookieSelectors) {
      try {
        const btn = await page.$(sel);
        if (btn) {
          await btn.click();
          console.log(`[browser] Clicked cookie button: ${sel}`);
          await new Promise(r => setTimeout(r, 1000));
          break;
        }
      } catch {}
    }

    // Wait for content
    await new Promise(r => setTimeout(r, waitFor));

    const content = await page.content();
    console.log(`[browser] ${url} - length: ${content.length}`);
    return content;
  } finally {
    await page.close();
  }
}
