# NodeSEO Feature Proof Storyboard

This storyboard governs public SEO proof media and receipts for NodeSEO. A search/landing demo should not claim ranking success; it should prove crawlability, measurable performance, controlled capture, and honest visual QA.

## Proof Contract

The workflow must prove:

1. **Static SEO contract** - title, description, canonical, robots, sitemap, JSON-LD, Open Graph, and private noindex rules pass for the configured site.
2. **Search Console boundary** - Search Console data is used for query/page performance; scraped rankings and fake clicks are out of scope.
3. **Controlled browser journey** - Playwright or CDP capture records a reproducible search-origin or landing journey.
4. **Media review** - frames/video are compressed into a review artifact and passed to Gemini visual QA when credentials exist.
5. **Receipt handoff** - JSON and Markdown receipts identify what was checked, what failed, and which claims remain unproven.

## Story Beats

1. **Configure** - show the site config and public/private route split.
2. **Audit** - run static SEO audit against the sample or target site.
3. **Journey** - run Playwright or CDP capture with a real route/search-origin scenario.
4. **Review media** - render frames/video and run visual QA.
5. **Report** - show generated reports and explicitly separate Search Console truth from visual/model feedback.

## Validation Checklist

- `npm run validate`
- `PLAYWRIGHT_BASE_URL=<url> npm run journey`
- `npm run perf -- --base-url <url>`
- `npm run frames:video -- --input-dir artifacts/chrome-cdp-search`
- `npm run judge-video -- --input artifacts/chrome-cdp-search.review.mp4 --scenario google-origin`

Credentialed checks should be marked optional unless the relevant Google credentials are present.

## NodeTasks Binding

Future NodeTasks entries for NodeSEO should cover:

- static SEO audit;
- Search Console report;
- Playwright landing journey;
- Chrome/CDP search-origin capture;
- video compression;
- Gemini visual QA;
- receipt boundary review.
