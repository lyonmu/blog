// Run against `bun run preview` with PLAYWRIGHT_MODULE pointing to Playwright.
import assert from "node:assert/strict";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const url = process.env.BLOG_URL || "http://127.0.0.1:4321";
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const width of [375, 989, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(url);
    await page.locator("[data-hero-scene]").scrollIntoViewIfNeeded();
    await page.waitForSelector(".hero-scene.scene-ready");
    assert.equal(await page.locator(".scene-canvas canvas").count(), 1);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth
      ),
      false
    );
  }
  await page.locator("#theme-btn").click();
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "dark"
  );
  assert.equal(await page.locator(".hero-scene.scene-ready").count(), 1);
  await page.locator('header a[href="/tags"]').first().click();
  await page.waitForURL(/\/tags\/?$/);
  assert.equal(await page.locator(".scene-canvas canvas").count(), 0);
  await page.goBack();
  await page.waitForSelector(".hero-scene.scene-ready");
  assert.equal(await page.locator(".scene-canvas canvas").count(), 1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForFunction(
    () => !document.querySelector(".scene-canvas canvas")
  );
  assert.equal(
    await page
      .locator(".topology-fallback")
      .evaluate(element => getComputedStyle(element).opacity),
    "1"
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.waitForSelector(".hero-scene.scene-ready");
  assert.equal(await page.locator(".scene-canvas canvas").count(), 1);
  assert.deepEqual(errors, []);
  const fallback = await browser.newPage();
  await fallback.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return type === "webgl2" ? null : getContext.call(this, type, ...args);
    };
  });
  await fallback.goto(url);
  await fallback.locator("[data-hero-scene]").scrollIntoViewIfNeeded();
  await fallback.waitForTimeout(600);
  assert.equal(await fallback.locator(".scene-canvas canvas").count(), 0);
  assert.equal(
    await fallback
      .locator(".topology-fallback")
      .evaluate(element => getComputedStyle(element).opacity),
    "1"
  );
} finally {
  await browser.close();
}
