# Keyword Cluster Workflow

This playbook borrows the useful parts of `AgriciDaniel/codex-seo`: topic clustering, SXO intent matching, and GEO/AI-search readiness. It avoids automated ranking manipulation.

## Inputs

- Brand name
- Base URL
- Product category
- 5-10 seed search intents
- Existing public pages
- Search Console query and page data

## Cluster Shape

Use this shape for a new or low-authority product:

| Page type | Purpose | Example URL |
|---|---|---|
| Exact-brand page | Disambiguate bare brand searches | `/brand/example/` |
| Solution hub | Pillar for the category cluster | `/solutions/` |
| Solution spokes | One search intent per page | `/solutions/collaborative-ai-workspace/` |
| Use-case pages | Persona/workflow intent | `/use-cases/startups/` |
| Comparison pages | Commercial evaluation | `/compare/notion-ai/` |
| Learn/FAQ pages | Informational and support intent | `/learn/`, `/faq/` |

## Search Intent Rules

- One primary query per page.
- One H1 per page.
- Title, meta description, and canonical must match the visible content.
- Do not create pages for terms where the product is not a real fit.
- Do not claim integrations, compliance, or vertical expertise that the product does not actually have.
- Link each spoke back to the pillar and at least one adjacent page.

## GEO / AI Search Readiness

- Add `/llms.txt` with the official product description and key public pages.
- Keep content server-rendered or static for important public pages.
- Use self-contained answer blocks that define the product plainly.
- Add source-backed claims and avoid vague marketese.
- Explicitly allow search-oriented AI crawlers in `robots.txt` when that matches the site policy.

## NodeRoom Example

The NodeRoom cluster used:

- `/brand/noderoom/` for `NodeRoom`, `NodeRoom app`, `NodeRoom live`, `NodeRoom AI`.
- `/solutions/` as the solution hub.
- `/solutions/collaborative-ai-workspace/` for `collaborative AI workspace`.
- `/solutions/ai-agent-collaboration/` for `AI agent collaboration workspace`.
- `/solutions/source-backed-ai-workflows/` for `source-backed AI workflow`.
- `/solutions/ai-diligence-room/` for `AI diligence room`.
- `/solutions/ai-research-workspace/` for `AI research workspace`.

## Measurement Loop

1. Run static audit.
2. Deploy.
3. Submit sitemap and inspect new URLs in Search Console.
4. Wait for impressions before judging ranking.
5. Add only the next highest-confidence spoke when Search Console shows a real query pattern.
6. Use Chrome/CDP and Gemini video judging for user-visible landing quality, not ranking claims.

## Anti-Spam Guardrails

- No fake clicks.
- No mass Google query automation.
- No scraped rank dashboards as the source of truth.
- No doorway pages.
- No duplicated template pages with only keyword swaps.
- No private room or user content in the sitemap.
