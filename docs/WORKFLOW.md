# Workflow Receipt Pattern

Use this pattern for each SEO proof run:

1. State the target surface and query.
2. Run static audit.
3. Run direct landing journey.
4. Run performance budget check.
5. Pull Search Console data.
6. If needed, run one Chrome/CDP search-origin capture from a real browser.
7. Encode a review MP4.
8. Run Gemini visual judge.
9. Record findings, artifacts, model, and credentials used without logging secret values.

## Example Receipt

```md
# SEO Journey QA Report

Generated: 2026-07-08T07:44:04Z
Target: https://example.com/
Query: Example collaborative AI workflow

## Artifacts

- Direct journey video: artifacts/direct.review.mp4
- Search-origin video: artifacts/chrome-cdp-search.review.mp4
- Gemini report: docs/reports/gemini-video-judges/<run-id>.md

## Findings

- Static audit: pass
- Performance: pass
- Search Console: live
- Gemini visual judge: no critical issues

## Deferred Work

- Monitor exact-brand query in Search Console.
- Add external entity anchors and request indexing after deploy.
```
