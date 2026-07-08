import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { cell, escapeMd, hasFlag, optionValue, readConfig, ROOT, slash, urlFor, writeJson, writeText } from "./utils.js";

type AuditStatus = "pass" | "warn" | "fail";

type AuditFinding = {
  status: AuditStatus;
  check: string;
  detail: string;
  path?: string;
};

type RouteAudit = {
  route: string;
  path: string;
  exists: boolean;
  title?: string;
  description?: string;
  h1Count?: number;
  canonical?: string;
};

type AuditReport = {
  generatedAt: string;
  baseUrl: string;
  siteRoot: string;
  summary: Record<AuditStatus, number>;
  routes: RouteAudit[];
  findings: AuditFinding[];
};

const config = readConfig();
const baseUrl = (optionValue("--base-url") ?? process.env.SEO_BASE_URL ?? config.baseUrl ?? "https://example.com").replace(/\/$/, "");
const siteRoot = joinOrRoot(optionValue("--site-root") ?? config.siteRoot ?? ".");
const publicDir = config.publicDir ?? "public";
const rootHtml = config.rootHtml ?? "index.html";
const publicRoutes = optionValue("--routes")
  ? optionValue("--routes")!.split(",").map((route) => route.trim()).filter(Boolean)
  : config.publicRoutes ?? ["/"];
const privatePatterns = config.privatePatterns ?? [];
const requiredRootMarkers = config.requiredRootMarkers ?? ["og:title", "twitter:card", "application/ld+json"];
const jsonOut = optionValue("--json-out") ?? join(ROOT, "docs", "reports", "seo-audit.latest.json");
const mdOut = optionValue("--md-out") ?? join(ROOT, "docs", "reports", "SEO_AUDIT.md");
const writeDocs = !hasFlag("--no-write");

const report = buildReport();

if (writeDocs) {
  writeJson(jsonOut, report);
  writeText(mdOut, renderMarkdown(report));
}

console.log(renderConsole(report));
if (report.findings.some((finding) => finding.status === "fail")) process.exitCode = 1;

function buildReport(): AuditReport {
  const findings: AuditFinding[] = [];
  const routes = publicRoutes.map((route) => auditRoute(route, findings));
  auditRootMarkers(findings);
  auditSitemap(routes, findings);
  auditRobots(findings);
  auditPrivateRouteGuard(findings);
  const summary = countBy(findings, (finding) => finding.status);
  for (const status of ["pass", "warn", "fail"] as const) summary[status] ??= 0;
  return {
    generatedAt: new Date().toISOString(),
    baseUrl,
    siteRoot: slash(relative(ROOT, siteRoot)) || ".",
    summary: summary as Record<AuditStatus, number>,
    routes,
    findings,
  };
}

function auditRoute(route: string, findings: AuditFinding[]): RouteAudit {
  const path = routePath(route);
  const rel = slash(relative(ROOT, path));
  if (!existsSync(path)) {
    findings.push({ status: "fail", check: "route_exists", detail: `${route} is missing`, path: rel });
    return { route, path: rel, exists: false };
  }
  const html = readFileSync(path, "utf8");
  const title = textTag(html, "title");
  const description = metaContent(html, "description");
  const canonical = linkHref(html, "canonical");
  const h1Count = (html.match(/<h1[\s>]/gi) ?? []).length;
  pushRequired(findings, Boolean(title), "title", `${route} has a title`, `${route} is missing a title`, rel);
  pushRequired(findings, Boolean(description), "meta_description", `${route} has a meta description`, `${route} is missing a meta description`, rel);
  pushRequired(findings, Boolean(canonical), "canonical", `${route} has a canonical URL`, `${route} is missing a canonical URL`, rel);
  pushRequired(findings, h1Count === 1, "single_h1", `${route} has one H1`, `${route} has ${h1Count} H1 elements`, rel);
  if (description && description.length > 165) {
    findings.push({ status: "warn", check: "meta_description_length", detail: `${route} description is ${description.length} chars`, path: rel });
  }
  if (canonical && !canonical.startsWith(baseUrl)) {
    findings.push({ status: "warn", check: "canonical_base", detail: `${route} canonical does not start with ${baseUrl}`, path: rel });
  }
  return { route, path: rel, exists: true, title, description, h1Count, canonical };
}

function auditRootMarkers(findings: AuditFinding[]): void {
  const path = join(siteRoot, rootHtml);
  const rel = slash(relative(ROOT, path));
  const html = existsSync(path) ? readFileSync(path, "utf8") : "";
  for (const marker of requiredRootMarkers) {
    pushRequired(findings, html.includes(marker), "root_marker", `Root contains ${marker}`, `Root is missing ${marker}`, rel);
  }
}

function auditSitemap(routes: RouteAudit[], findings: AuditFinding[]): void {
  const path = join(siteRoot, publicDir, "sitemap.xml");
  const rel = slash(relative(ROOT, path));
  if (!existsSync(path)) {
    findings.push({ status: "fail", check: "sitemap", detail: "sitemap.xml is missing", path: rel });
    return;
  }
  const xml = readFileSync(path, "utf8");
  for (const route of routes) {
    const loc = urlFor(baseUrl, route.route);
    pushRequired(findings, xml.includes(`<loc>${loc}</loc>`), "sitemap_route", `Sitemap includes ${route.route}`, `Sitemap missing ${loc}`, rel);
  }
}

function auditRobots(findings: AuditFinding[]): void {
  const path = join(siteRoot, publicDir, "robots.txt");
  const rel = slash(relative(ROOT, path));
  if (!existsSync(path)) {
    findings.push({ status: "fail", check: "robots", detail: "robots.txt is missing", path: rel });
    return;
  }
  const text = readFileSync(path, "utf8");
  pushRequired(findings, /Sitemap:\s*https?:\/\//i.test(text), "robots_sitemap", "robots.txt points to sitemap", "robots.txt does not point to a sitemap", rel);
  for (const pattern of privatePatterns) {
    pushRequired(findings, text.includes(pattern), "robots_private_disallow", `robots.txt disallows ${pattern}`, `robots.txt does not disallow ${pattern}`, rel);
  }
}

function auditPrivateRouteGuard(findings: AuditFinding[]): void {
  if (!config.privateNoindexRequired) return;
  const path = join(siteRoot, rootHtml);
  const rel = slash(relative(ROOT, path));
  const html = existsSync(path) ? readFileSync(path, "utf8") : "";
  pushRequired(
    findings,
    /noindex,nofollow/i.test(html),
    "private_noindex_guard",
    "Root shell has private-route noindex guard",
    "Root shell is missing private-route noindex guard",
    rel,
  );
}

function routePath(route: string): string {
  if (route === "/") return join(siteRoot, rootHtml);
  const publicRoutePath = route.replace(/^\/+|\/+$/g, "");
  return join(siteRoot, publicDir, publicRoutePath, "index.html");
}

function renderConsole(input: AuditReport): string {
  return [
    `SEO audit ${input.generatedAt}`,
    `baseUrl=${input.baseUrl}`,
    `siteRoot=${input.siteRoot}`,
    `pass=${input.summary.pass} warn=${input.summary.warn} fail=${input.summary.fail}`,
    `wrote=${writeDocs ? slash(relative(ROOT, jsonOut)) + ", " + slash(relative(ROOT, mdOut)) : "disabled"}`,
  ].join("\n");
}

function renderMarkdown(input: AuditReport): string {
  const lines: string[] = [];
  lines.push("# SEO Audit");
  lines.push("");
  lines.push(`Generated: ${input.generatedAt}`);
  lines.push(`Base URL: \`${input.baseUrl}\``);
  lines.push(`Site root: \`${input.siteRoot}\``);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Pass: ${input.summary.pass}`);
  lines.push(`- Warn: ${input.summary.warn}`);
  lines.push(`- Fail: ${input.summary.fail}`);
  lines.push("");
  lines.push("## Routes");
  lines.push("");
  lines.push("| Route | File | Title | Description | H1 | Canonical |");
  lines.push("|---|---|---|---|---:|---|");
  for (const route of input.routes) {
    lines.push(`| \`${route.route}\` | \`${route.path}\` | ${cell(route.title)} | ${cell(route.description)} | ${route.h1Count ?? 0} | ${cell(route.canonical)} |`);
  }
  lines.push("");
  lines.push("## Findings");
  lines.push("");
  lines.push("| Status | Check | Path | Detail |");
  lines.push("|---|---|---|---|");
  for (const finding of input.findings) {
    lines.push(`| ${finding.status} | \`${finding.check}\` | ${finding.path ? `\`${finding.path}\`` : ""} | ${escapeMd(finding.detail)} |`);
  }
  lines.push("");
  return lines.join("\n");
}

function pushRequired(findings: AuditFinding[], ok: boolean, check: string, pass: string, fail: string, path: string): void {
  findings.push({ status: ok ? "pass" : "fail", check, detail: ok ? pass : fail, path });
}

function textTag(html: string, tag: string): string | undefined {
  const match = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return match?.[1]?.replace(/\s+/g, " ").trim();
}

function metaContent(html: string, name: string): string | undefined {
  const match = html.match(new RegExp(`<meta\\s+[^>]*name=["']${escapeRegex(name)}["'][^>]*content=["']([^"']+)["'][^>]*>`, "i"))
    ?? html.match(new RegExp(`<meta\\s+[^>]*content=["']([^"']+)["'][^>]*name=["']${escapeRegex(name)}["'][^>]*>`, "i"));
  return match?.[1]?.trim();
}

function linkHref(html: string, rel: string): string | undefined {
  const match = html.match(new RegExp(`<link\\s+[^>]*rel=["']${escapeRegex(rel)}["'][^>]*href=["']([^"']+)["'][^>]*>`, "i"))
    ?? html.match(new RegExp(`<link\\s+[^>]*href=["']([^"']+)["'][^>]*rel=["']${escapeRegex(rel)}["'][^>]*>`, "i"));
  return match?.[1]?.trim();
}

function countBy<T>(items: T[], keyFn: (item: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) out[keyFn(item)] = (out[keyFn(item)] ?? 0) + 1;
  return out;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function joinOrRoot(path: string): string {
  return /^[A-Za-z]:[\\/]/.test(path) || path.startsWith("/") ? path : join(ROOT, path);
}
