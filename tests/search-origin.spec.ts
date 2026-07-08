import { expect, test, type Page, type TestInfo } from "@playwright/test";

test.describe("SEO journey", () => {
  test("records one search-origin scenario or safely falls back to direct landing", async ({ page }, testInfo) => {
    const targetPhrase = process.env.SEO_TARGET_PHRASE ?? "Example collaborative AI workflow";
    const targetHost = process.env.SEO_TARGET_HOST ?? new URL(testInfo.project.use.baseURL ?? "https://example.com").host;
    const directPath = process.env.SEO_DIRECT_PATH ?? "/";
    const heading = process.env.SEO_PRIMARY_HEADING ?? "";
    const cta = process.env.SEO_PRIMARY_CTA_TEXT ?? "";
    const allowGoogle = process.env.SEO_ALLOW_LIVE_GOOGLE === "1";
    const problems = collectPageProblems(page);
    let foundTarget = false;

    if (allowGoogle) {
      await page.goto(`https://www.google.com/search?q=${encodeURIComponent(targetPhrase)}`, { waitUntil: "domcontentloaded" });
      await attachScreenshot(page, testInfo, "google-origin-search");
      const result = page.locator(`a[href*="${targetHost}"]`).first();
      foundTarget = await result.isVisible({ timeout: 5_000 }).catch(() => false);
      if (foundTarget) await result.click();
      else await page.goto(directPath, { waitUntil: "domcontentloaded" });
    } else {
      testInfo.annotations.push({ type: "seo-qa", description: "Google-origin step skipped; set SEO_ALLOW_LIVE_GOOGLE=1 for a one-query manual QA scenario." });
      await page.goto(directPath, { waitUntil: "domcontentloaded" });
    }

    if (heading) await expect(page.getByRole("heading", { name: new RegExp(escapeRegex(heading), "i") })).toBeVisible();
    else await expect(page.locator("h1").first()).toBeVisible();
    if (cta) await expect(page.getByText(new RegExp(escapeRegex(cta), "i")).first()).toBeVisible();
    await attachScreenshot(page, testInfo, foundTarget ? "google-origin-target-result" : "direct-landing");

    expect(problems.errors.filter((error) => !isExternalGoogleNoise(error)), problemsSummary(problems)).toEqual([]);
  });
});

function collectPageProblems(page: Page): { errors: string[]; failedRequests: string[] } {
  const errors: string[] = [];
  const failedRequests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !isIgnoredProblem(message.text())) errors.push(message.text());
  });
  page.on("requestfailed", (request) => {
    const url = request.url();
    if (!isIgnoredProblem(url)) failedRequests.push(`${request.method()} ${url}: ${request.failure()?.errorText ?? "unknown"}`);
  });
  return { errors, failedRequests };
}

async function attachScreenshot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(name, { path, contentType: "image/png" });
}

function problemsSummary(problems: { errors: string[]; failedRequests: string[] }): string {
  return [...problems.errors, ...problems.failedRequests].join("\n");
}

function isIgnoredProblem(value: string): boolean {
  return /fonts\.googleapis\.com|fonts\.gstatic\.com|favicon|ResizeObserver loop/i.test(value);
}

function isExternalGoogleNoise(value: string): boolean {
  return /google|gstatic|consent|captcha|status of 429/i.test(value);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
