import puppeteer, { Browser, Page, Protocol } from 'puppeteer';

type CookieBag = Protocol.Network.Cookie[];

let browser: Browser | null = null;
const pages: Map<string, Page> = new Map();

const logger = {
  info: (msg: string) => console.log(`[WEB-BRIDGE] ${msg}`),
  error: (msg: string) => console.error(`[WEB-BRIDGE ERROR] ${msg}`),
};

export async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.connected) {
    logger.info('Launching headless browser...');
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
      ],
    });
    logger.info('Browser launched successfully');
  }
  return browser;
}

export async function createPage(
  sessionId: string,
  url: string,
  cookies?: CookieBag
): Promise<{ title: string; previewText: string }> {
  const b = await getBrowser();
  const page = await b.newPage();

  await page.setViewport({ width: 1280, height: 720 });
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  if (cookies && cookies.length > 0) {
    try {
      const client = await page.createCDPSession();
      await client.send('Network.enable');
      for (const c of cookies) {
        await client.send('Network.setCookie', {
          name: c.name,
          value: c.value,
          domain: c.domain,
          path: c.path,
          secure: c.secure,
          httpOnly: c.httpOnly,
          sameSite: c.sameSite as 'Strict' | 'Lax' | 'None' | undefined,
          expires: c.expires,
        });
      }
    } catch (err) {
      logger.error(`Failed to set cookies: ${err}`);
    }
  }

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  pages.set(sessionId, page);

  const title = await page.title();
  const bodyInnerText = await page.evaluate(() => {
    const body = (globalThis as any).document?.body;
    return body?.innerText?.slice(0, 1500) || '';
  });

  logger.info(`Created page for session ${sessionId}: ${title}`);
  return { title, previewText: bodyInnerText };
}

export async function navigate(
  sessionId: string,
  url: string
): Promise<{ title: string }> {
  const page = pages.get(sessionId);
  if (!page) throw new Error('Page not found for session');

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  const title = await page.title();
  logger.info(`Navigated session ${sessionId} to: ${url}`);
  return { title };
}

export async function refresh(sessionId: string): Promise<{ title: string }> {
  const page = pages.get(sessionId);
  if (!page) throw new Error('Page not found for session');

  await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
  const title = await page.title();
  logger.info(`Refreshed session ${sessionId}`);
  return { title };
}

export async function scrape(
  sessionId: string,
  selectors: string[]
): Promise<Record<string, string[]>> {
  const page = pages.get(sessionId);
  if (!page) throw new Error('Page not found for session');

  const results: Record<string, string[]> = {};
  for (const sel of selectors) {
    try {
      results[sel] = await page.$$eval(sel, (els) =>
        els.map((e) => (e.textContent || '').trim())
      );
    } catch {
      results[sel] = [];
    }
  }
  logger.info(`Scraped session ${sessionId} with ${selectors.length} selectors`);
  return results;
}

export async function capture(
  sessionId: string,
  type: 'screenshot' | 'pdf',
  path?: string
): Promise<{ path: string; base64?: string }> {
  const page = pages.get(sessionId);
  if (!page) throw new Error('Page not found for session');

  const outPath =
    path || `/tmp/atlas-web-${sessionId}-${Date.now()}.${type === 'pdf' ? 'pdf' : 'png'}`;

  if (type === 'pdf') {
    await page.pdf({ path: outPath, printBackground: true, format: 'A4' });
  } else {
    await page.screenshot({ path: outPath, fullPage: true });
  }

  logger.info(`Captured ${type} for session ${sessionId}: ${outPath}`);
  return { path: outPath };
}

export async function captureBase64(
  sessionId: string
): Promise<{ base64: string }> {
  const page = pages.get(sessionId);
  if (!page) throw new Error('Page not found for session');

  const buffer = await page.screenshot({ fullPage: false, encoding: 'base64' });
  return { base64: buffer as string };
}

export async function getCookies(sessionId: string): Promise<CookieBag> {
  const page = pages.get(sessionId);
  if (!page) throw new Error('Page not found for session');

  const client = await page.createCDPSession();
  const { cookies } = await client.send('Network.getAllCookies');
  return cookies;
}

export async function setStorage(
  sessionId: string,
  data: { localStorage?: Record<string, string>; sessionStorage?: Record<string, string> }
): Promise<{ ok: boolean }> {
  const page = pages.get(sessionId);
  if (!page) throw new Error('Page not found for session');

  await page.evaluate((d) => {
    if (d.localStorage) {
      Object.entries(d.localStorage).forEach(([k, v]) =>
        localStorage.setItem(k, String(v))
      );
    }
    if (d.sessionStorage) {
      Object.entries(d.sessionStorage).forEach(([k, v]) =>
        sessionStorage.setItem(k, String(v))
      );
    }
  }, data);

  return { ok: true };
}

export async function getStorage(
  sessionId: string
): Promise<{ localStorage: Record<string, string>; sessionStorage: Record<string, string> }> {
  const page = pages.get(sessionId);
  if (!page) throw new Error('Page not found for session');

  const result = await page.evaluate(() => ({
    localStorage: Object.fromEntries(Object.entries(localStorage)),
    sessionStorage: Object.fromEntries(Object.entries(sessionStorage)),
  }));
  return result;
}

export async function getPageUrl(sessionId: string): Promise<string> {
  const page = pages.get(sessionId);
  if (!page) throw new Error('Page not found for session');
  return page.url();
}

export async function getPageTitle(sessionId: string): Promise<string> {
  const page = pages.get(sessionId);
  if (!page) throw new Error('Page not found for session');
  return page.title();
}

export async function closePage(sessionId: string): Promise<{ ok: boolean }> {
  const page = pages.get(sessionId);
  if (page) {
    try {
      await page.close();
    } catch (err) {
      logger.error(`Error closing page: ${err}`);
    }
    pages.delete(sessionId);
    logger.info(`Closed page for session ${sessionId}`);
  }
  return { ok: true };
}

export function hasPage(sessionId: string): boolean {
  return pages.has(sessionId);
}

export async function getActiveSessions(): Promise<string[]> {
  return Array.from(pages.keys());
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
    pages.clear();
    logger.info('Browser closed');
  }
}
