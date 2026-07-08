import { chromium, type Browser, type Page } from "playwright";
import { join, relative } from "node:path";
import { escapeMd, optionValue, optionValues, readConfig, ROOT, slash, urlFor, writeJson, writeText } from "./utils.js";

type RoutePerf = {
  url: string;
  status: number | null;
  title: string;
  metrics: {
    domContentLoadedMs: number | null;
    loadEventMs: number | null;
    firstContentfulPaintMs: number | null;
    largestContentfulPaintMs: number | null;
    cumulativeLayoutShift: number;
    transferSizeBytes: number;
    encodedBodySizeBytes: number;
  };
  budgets: {
    lcpGoodMs: number;
    clsGood: number;
    loadEventBudgetMs: number;
  };
  statusText: "pass" | "warn" | "fail";
  findings: string[];
};

type PerfReport = {
  generatedAt: string;
  baseUrl: string;
  routes: RoutePerf[];
};

const config = readConfig();
const baseUrl = (optionValue("--base-url") ?? process.env.PLAYWRIGHT_BASE_URL ?? process.env.SEO_BASE_URL ?? config.baseUrl ?? "http://127.0.0.1:5260").replace(/\/$/, "");
const routes = optionValues("--route");
const targetRoutes = routes.length ? routes : config.publicRoutes ?? ["/"];
const jsonOut = optionValue("--json-out") ?? join(ROOT, "docs", "reports", "performance-check.latest.json");
const mdOut = optionValue("--md-out") ?? join(ROOT, "docs", "reports", "PERFORMANCE_QA_REPORT.md");

const browser = await chromium.launch({ headless: true });
try {
  const report: PerfReport = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    routes: [],
  };
  for (const route of targetRoutes) report.routes.push(await auditRoute(browser, route));
  writeJson(jsonOut, report);
  writeText(mdOut, renderMarkdown(report));
  console.log(`wrote ${slash(relative(ROOT, jsonOut))} and ${slash(relative(ROOT, mdOut))}`);
  if (report.routes.some((route) => route.statusText === "fail")) process.exitCode = 1;
} finally {
  await browser.close();
}

async function auditRoute(browser: Browser, route: string): Promise<RoutePerf> {
  const page = await browser.newPage({ viewport: { width: 1440, height: 920 } });
  await installPerfObservers(page);
  const response = await page.goto(urlFor(baseUrl, route), { waitUntil: "load" });
  await page.waitForTimeout(1500);
  const title = await page.title();
  const metrics = await collectMetrics(page);
  await page.close();
  const findings: string[] = [];
  const budgets = { lcpGoodMs: 2500, clsGood: 0.1, loadEventBudgetMs: 3500 };
  if (metrics.largestContentfulPaintMs !== null && metrics.largestContentfulPaintMs > budgets.lcpGoodMs) {
    findings.push(`LCP ${Math.round(metrics.largestContentfulPaintMs)}ms exceeds ${budgets.lcpGoodMs}ms`);
  }
  if (metrics.cumulativeLayoutShift > budgets.clsGood) findings.push(`CLS ${metrics.cumulativeLayoutShift.toFixed(3)} exceeds ${budgets.clsGood}`);
  if (metrics.loadEventMs !== null && metrics.loadEventMs > budgets.loadEventBudgetMs) {
    findings.push(`load event ${Math.round(metrics.loadEventMs)}ms exceeds ${budgets.loadEventBudgetMs}ms`);
  }
  if (!response?.ok()) findings.push(`HTTP status ${response?.status() ?? "unknown"}`);
  return {
    url: urlFor(baseUrl, route),
    status: response?.status() ?? null,
    title,
    metrics,
    budgets,
    statusText: findings.some((finding) => /^HTTP|LCP|CLS/.test(finding)) ? "fail" : findings.length ? "warn" : "pass",
    findings,
  };
}

async function installPerfObservers(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const win = window as typeof window & { __seoPerf?: { fcp: number | null; lcp: number | null; cls: number } };
    win.__seoPerf = { fcp: null, lcp: null, cls: 0 };
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === "first-contentful-paint") win.__seoPerf!.fcp = entry.startTime;
        }
      }).observe({ type: "paint", buffered: true });
      new PerformanceObserver((list) => {
        const last = list.getEntries().at(-1);
        if (last) win.__seoPerf!.lcp = last.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as Array<PerformanceEntry & { value?: number; hadRecentInput?: boolean }>) {
          if (!entry.hadRecentInput) win.__seoPerf!.cls += entry.value ?? 0;
        }
      }).observe({ type: "layout-shift", buffered: true });
    } catch {
      // Not every browser/context supports every observer.
    }
  });
}

async function collectMetrics(page: Page): Promise<RoutePerf["metrics"]> {
  return await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    const perf = (window as typeof window & { __seoPerf?: { fcp: number | null; lcp: number | null; cls: number } }).__seoPerf;
    return {
      domContentLoadedMs: nav ? nav.domContentLoadedEventEnd - nav.startTime : null,
      loadEventMs: nav ? nav.loadEventEnd - nav.startTime : null,
      firstContentfulPaintMs: perf?.fcp ?? null,
      largestContentfulPaintMs: perf?.lcp ?? null,
      cumulativeLayoutShift: perf?.cls ?? 0,
      transferSizeBytes: resources.reduce((sum, entry) => sum + entry.transferSize, nav?.transferSize ?? 0),
      encodedBodySizeBytes: resources.reduce((sum, entry) => sum + entry.encodedBodySize, nav?.encodedBodySize ?? 0),
    };
  });
}

function renderMarkdown(report: PerfReport): string {
  const lines: string[] = [];
  lines.push("# Performance QA Report");
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Base URL: \`${report.baseUrl}\``);
  lines.push("");
  lines.push("> This is a Playwright lab check. Use Lighthouse or field data for final production claims.");
  lines.push("");
  lines.push("| Route | Status | HTTP | FCP | LCP | CLS | Load | Transfer | Findings |");
  lines.push("|---|---|---:|---:|---:|---:|---:|---:|---|");
  for (const route of report.routes) {
    lines.push(`| \`${route.url.replace(report.baseUrl, "") || "/"}\` | ${route.statusText} | ${route.status ?? ""} | ${ms(route.metrics.firstContentfulPaintMs)} | ${ms(route.metrics.largestContentfulPaintMs)} | ${route.metrics.cumulativeLayoutShift.toFixed(3)} | ${ms(route.metrics.loadEventMs)} | ${bytes(route.metrics.transferSizeBytes)} | ${route.findings.length ? route.findings.map(escapeMd).join("; ") : "none"} |`);
  }
  lines.push("");
  return lines.join("\n");
}

function ms(value: number | null): string {
  return value === null ? "" : `${Math.round(value)}ms`;
}

function bytes(value: number): string {
  if (value > 1024 * 1024) return `${(value / 1024 / 1024).toFixed(2)} MB`;
  if (value > 1024) return `${Math.round(value / 1024)} KB`;
  return `${value} B`;
}
