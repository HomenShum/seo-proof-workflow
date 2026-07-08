import { mkdirSync } from "node:fs";
import { join, relative } from "node:path";
import { chromium, type Page } from "playwright";
import { numberOption, optionValue, readConfig, ROOT, slash, writeJson } from "./utils.js";

const config = readConfig();
const cdpUrl = optionValue("--cdp-url") ?? process.env.CHROME_CDP_URL ?? "http://127.0.0.1:9222";
const baseUrl = (optionValue("--base-url") ?? process.env.SEO_BASE_URL ?? config.baseUrl ?? "https://example.com").replace(/\/$/, "");
const search = optionValue("--search") ?? process.env.SEO_TARGET_PHRASE ?? "Example collaborative AI workflow";
const targetHost = optionValue("--target-host") ?? process.env.SEO_TARGET_HOST ?? new URL(baseUrl).host;
const outDir = optionValue("--out-dir") ?? join(ROOT, "artifacts", "chrome-cdp-search");
const frameMs = numberOption("--frame-ms", 250, 100, 2000);
const searchFrames = numberOption("--search-frames", 8, 1, 120);
const landingFrames = numberOption("--landing-frames", 14, 1, 240);

mkdirSync(outDir, { recursive: true });

const browser = await chromium.connectOverCDP(cdpUrl);
const context = browser.contexts()[0] ?? await browser.newContext();
const page = await context.newPage();
let frameIndex = 0;
let visibleTargetResult = false;
let selectedHref: string | null = null;

try {
  await page.setViewportSize({ width: 1440, height: 920 });
  const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(search)}`;
  await page.goto(googleUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await captureFrames(page, "google-serp", searchFrames);

  const result = page.locator(`a[href*="${targetHost}"]`).first();
  visibleTargetResult = await result.isVisible({ timeout: 5_000 }).catch(() => false);
  selectedHref = visibleTargetResult ? await result.getAttribute("href") : null;
  if (selectedHref) {
    await page.goto(normalizeHref(selectedHref), { waitUntil: "domcontentloaded", timeout: 45_000 });
  } else {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
  }
  await captureFrames(page, "target", landingFrames);

  const receipt = {
    generatedAt: new Date().toISOString(),
    source: "Chrome/CDP via Playwright connectOverCDP",
    query: search,
    googleTitle: `${search} - Google Search`,
    googleUrl: `https://www.google.com/search?q=${encodeURIComponent(search).replace(/%20/g, "+")}`,
    visibleTargetResult,
    targetHost,
    targetHref: selectedHref ? sanitizeHref(selectedHref) : null,
    fallbackUrl: selectedHref ? null : baseUrl,
    finalUrl: sanitizeHref(page.url()),
    frameCount: frameIndex,
    privacyNote: "Raw Google account, sign-out, personalization, and location strings are not retained.",
  };
  writeJson(join(outDir, "recording-state.json"), receipt);
  console.log(JSON.stringify({ outDir: slash(relative(ROOT, outDir)), ...receipt }, null, 2));
} finally {
  await page.close().catch(() => undefined);
  await browser.close().catch(() => undefined);
}

async function captureFrames(page: Page, label: string, count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    const path = join(outDir, `${String(frameIndex).padStart(3, "0")}-${label}.jpg`);
    await page.screenshot({ path, type: "jpeg", quality: 82, fullPage: false });
    frameIndex++;
    await page.waitForTimeout(frameMs);
  }
}

function normalizeHref(href: string): string {
  if (href.startsWith("/url?")) {
    const parsed = new URL(href, "https://www.google.com");
    return parsed.searchParams.get("q") ?? href;
  }
  return href.startsWith("http") ? href : new URL(href, "https://www.google.com").toString();
}

function sanitizeHref(href: string): string {
  try {
    const parsed = new URL(normalizeHref(href));
    if (/google\./i.test(parsed.host)) {
      return `${parsed.origin}${parsed.pathname}${parsed.searchParams.has("q") ? `?q=${parsed.searchParams.get("q")}` : ""}`;
    }
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return href;
  }
}
