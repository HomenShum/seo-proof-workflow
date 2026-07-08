import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export const ROOT = process.cwd();
export const args = process.argv.slice(2);

export type WorkflowConfig = {
  baseUrl?: string;
  siteRoot?: string;
  publicDir?: string;
  rootHtml?: string;
  publicRoutes?: string[];
  privatePatterns?: string[];
  requiredRootMarkers?: string[];
  privateNoindexRequired?: boolean;
  journey?: {
    directPath?: string;
    primaryHeading?: string;
    primaryCtaText?: string;
  };
};

loadEnvFile(".env");
loadEnvFile(".env.local");

export function optionValue(name: string): string | undefined {
  const prefix = `${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  if (inline !== undefined) return inline;
  const index = args.indexOf(name);
  const next = args[index + 1];
  return index >= 0 && next && !next.startsWith("--") ? next : undefined;
}

export function optionValues(name: string): string[] {
  const values: string[] = [];
  const prefix = `${name}=`;
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith(prefix)) values.push(args[i].slice(prefix.length));
    else if (args[i] === name && args[i + 1] && !args[i + 1].startsWith("--")) values.push(args[++i]);
  }
  return values;
}

export function hasFlag(name: string): boolean {
  return args.includes(name);
}

export function numberOption(name: string, fallback: number, min = 1, max = Number.MAX_SAFE_INTEGER): number {
  const value = optionValue(name);
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) throw new Error(`${name} must be between ${min} and ${max}`);
  return parsed;
}

export function readConfig(): WorkflowConfig {
  const configPath = optionValue("--config") ?? process.env.SEO_WORKFLOW_CONFIG;
  if (!configPath) return {};
  const path = joinOrAbsolute(configPath);
  if (!existsSync(path)) throw new Error(`Config not found: ${configPath}`);
  return JSON.parse(readFileSync(path, "utf8")) as WorkflowConfig;
}

export function joinOrAbsolute(path: string): string {
  return /^[A-Za-z]:[\\/]/.test(path) || path.startsWith("/") ? path : join(ROOT, path);
}

export function resolveFromRoot(path: string): string {
  return resolve(ROOT, path);
}

export function slash(path: string): string {
  return path.replace(/\\/g, "/");
}

export function writeJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

export function writeText(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

export function escapeMd(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function cell(value: string | undefined): string {
  return value ? escapeMd(value) : "";
}

export function quote(value: string): string {
  return /^[A-Za-z0-9_./:=+-]+$/.test(value) ? value : JSON.stringify(value);
}

export function loadEnvFile(file: string): void {
  const path = join(ROOT, file);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    const key = trimmed.slice(0, index).trim();
    const raw = trimmed.slice(index + 1).trim();
    const value = raw.replace(/^["']|["']$/g, "");
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export function urlFor(baseUrl: string, route: string): string {
  if (/^https?:\/\//i.test(route)) return route;
  return `${baseUrl.replace(/\/$/, "")}${route.startsWith("/") ? "" : "/"}${route}`;
}
