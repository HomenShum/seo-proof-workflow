# NodeSEO

A small, repeatable SEO QA toolkit for proving that a public web surface is crawlable, fast, measurable, and visually credible from search to landing.

This repository was extracted from the [NodeRoom](https://noderoom.live/) SEO loop. It intentionally contains only the workflow, not the product app.

## What It Does

- Audits static SEO files: titles, descriptions, canonicals, sitemap, robots.txt, JSON-LD, Open Graph, and private-route noindex guards.
- Pulls Google Search Console query and page data without scraping rankings.
- Records a controlled Playwright landing journey.
- Captures one fresh Google-origin journey from a real Chrome session through CDP when manual proof is needed.
- Compresses videos or screenshot frames into review MP4s.
- Sends the final MP4 to Gemini for structured visual QA.
- Writes machine-readable JSON and Markdown receipts.
- Documents a hub-and-spoke keyword cluster workflow inspired by `AgriciDaniel/codex-seo`.

## Why A Brand Query May Not Show Yet

If a new product ranks for a long-tail phrase but not for the bare brand name, that usually means the brand entity is not strong enough yet for Google to disambiguate it.

For example, `NodeRoom collaborative AI room` is a specific phrase. The bare query `noderoom` competes with older/high-authority meanings such as music channels, blockchain node services, docs pages, and other exact or near-exact names. Search results also vary by account, location, data center, and personalization.

The ethical fix is:

- request indexing for the canonical URL in Search Console;
- keep the homepage title, H1, canonical, schema, and organization/profile links consistent;
- publish public entity anchors such as GitHub, docs, changelog, blog, and social profiles;
- earn real links and mentions;
- monitor Search Console impressions, CTR, and average position.

Do not run fake search clicks, ranking scrapes, or bot traffic.

## Install

```bash
npm install
npx playwright install chromium
cp .env.example .env.local
```

## Configure

Copy `config/seo-workflow.config.example.json` and point it at your static site output:

```json
{
  "baseUrl": "https://your-site.example",
  "siteRoot": "dist",
  "publicDir": ".",
  "rootHtml": "index.html",
  "publicRoutes": ["/", "/pricing/", "/faq/"],
  "privatePatterns": ["/*?room=", "/*?demo="],
  "privateNoindexRequired": true
}
```

## Run The Loop

```bash
npm run audit -- --config config/seo-workflow.config.example.json
PLAYWRIGHT_BASE_URL=https://your-site.example npm run journey
npm run perf -- --base-url https://your-site.example
npm run search-console -- --site-url https://your-site.example/
npm run capture:cdp -- --search "Your brand exact product phrase" --target-host your-site.example --base-url https://your-site.example
npm run frames:video -- --input-dir artifacts/chrome-cdp-search
npm run judge-video -- --input artifacts/chrome-cdp-search.review.mp4 --scenario google-origin
```

## Keyword Clusters

Use `docs/KEYWORD_CLUSTER.md` before adding pages. The short version:

- exact-brand page for the bare brand query;
- pillar page for the broad solution category;
- focused spokes for one intent each;
- internal links between pillar, spokes, use cases, and comparisons;
- Search Console monitoring before adding more pages.

NodeRoom used this pattern for searches such as `NodeRoom`, `collaborative AI workspace`, `AI agent collaboration workspace`, `source-backed AI workflow`, `AI diligence room`, and `AI research workspace`.

## Required Credentials

- `GOOGLE_GENERATIVE_AI_API_KEY` for Gemini video judging.
- `GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN` or `GOOGLE_APPLICATION_CREDENTIALS` for Search Console.
- A local Chrome with remote debugging enabled for `capture:cdp`.

On Windows, launch a separate Chrome profile for CDP capture:

```powershell
Start-Process "$env:ProgramFiles\Google\Chrome\Application\chrome.exe" -ArgumentList "--remote-debugging-port=9222 --user-data-dir=$env:TEMP\nodeseo-chrome"
```

## Receipts

Default outputs go under:

- `docs/reports/seo-audit.latest.json`
- `docs/reports/SEO_AUDIT.md`
- `docs/reports/search-console.latest.json`
- `docs/reports/SEARCH_CONSOLE_REPORT.md`
- `docs/reports/performance-check.latest.json`
- `docs/reports/PERFORMANCE_QA_REPORT.md`
- `artifacts/`

Generated artifacts are gitignored by default.

## Safety Rules

- Do not commit `.env`, service account JSON, access tokens, or API keys.
- Do not retain raw Google account, location, sign-out, or personalization URLs in capture receipts.
- Do not scrape Google rankings at scale or simulate clicks.
- Treat Search Console as the source of truth for query performance.
- Label model reviews as visual QA, not as official search ranking proof.
