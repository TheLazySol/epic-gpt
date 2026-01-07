import * as cheerio from 'cheerio';
import { chromium, type Browser } from 'playwright';
import { htmlToText, cleanText } from './convert/htmlToText.js';
import { KB } from '../config/constants.js';

let browser: Browser | null = null;

/**
 * Get or create a Playwright browser instance
 */
async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
    });
  }
  return browser;
}

/**
 * Fetch URL content using static fetch + cheerio
 */
async function fetchStatic(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Remove unwanted elements
  $('script, style, noscript, nav, footer, header, aside, .sidebar, .menu, .navigation').remove();

  // Get main content
  const mainContent =
    $('main').html() ||
    $('article').html() ||
    $('[role="main"]').html() ||
    $('body').html() ||
    '';

  const text = htmlToText(mainContent);
  return cleanText(text);
}

/**
 * Fetch URL content using Playwright (for dynamic sites)
 */
async function fetchDynamic(url: string): Promise<string> {
  const browserInstance = await getBrowser();
  const page = await browserInstance.newPage();

  try {
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Wait a bit for any dynamic content
    await page.waitForTimeout(2000);

    // Get the page content
    const html = await page.content();
    const $ = cheerio.load(html);

    // Remove unwanted elements
    $('script, style, noscript, nav, footer, header, aside, .sidebar, .menu, .navigation').remove();

    // Get main content
    const mainContent =
      $('main').html() ||
      $('article').html() ||
      $('[role="main"]').html() ||
      $('body').html() ||
      '';

    const text = htmlToText(mainContent);
    return cleanText(text);
  } finally {
    await page.close();
  }
}

/**
 * Fetch URL content with automatic fallback to Playwright
 */
export async function fetchUrl(url: string): Promise<{
  content: string;
  title: string;
  usedPlaywright: boolean;
}> {
  // Extract title from URL as fallback
  const urlObj = new URL(url);
  let title = urlObj.pathname.split('/').filter(Boolean).pop() || urlObj.hostname;

  // Try static fetch first
  let content = await fetchStatic(url);
  let usedPlaywright = false;

  // If content is too short, try Playwright
  if (content.length < KB.MIN_CONTENT_LENGTH) {
    console.log(`📄 Static fetch returned short content (${content.length} chars), trying Playwright...`);
    try {
      content = await fetchDynamic(url);
      usedPlaywright = true;
    } catch (error) {
      console.warn('Playwright fetch failed:', error);
      // Keep the static content if Playwright fails
    }
  }

  // Try to extract title from content
  const titleMatch = content.match(/^#\s*(.+)$/m) || content.match(/^(.+)\n={3,}$/m);
  if (titleMatch?.[1]) {
    title = titleMatch[1].trim();
  }

  return { content, title, usedPlaywright };
}

/**
 * Close the browser instance (call on shutdown)
 */
export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

export default fetchUrl;
