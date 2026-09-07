// Run against `bun run preview` with PLAYWRIGHT_MODULE pointing to an installed Playwright package.
import assert from "node:assert/strict";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const url = process.env.BLOG_URL || "http://127.0.0.1:4321";
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
  });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${url}/tags/`);
    await page.waitForSelector("[data-planet-labels] a");
    assert.equal(
      await page.locator("[data-planet-labels] a").count(),
      await page.locator("[data-tag-node]").count()
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth
      ),
      false
    );
    assert.equal(await page.locator("[data-canvas-host] canvas").count(), 1);
  }
  await page.locator("[data-universe-pause]").click();
  assert.equal(
    await page.locator("[data-universe-pause]").textContent(),
    "开始公转"
  );
  const lightPanel = await page
    .locator("[data-universe]")
    .evaluate(element => getComputedStyle(element).backgroundColor);
  const lightCanvas = await page
    .locator("[data-canvas-host] canvas")
    .screenshot();
  const labelPosition = await page
    .locator("[data-planet-labels] a")
    .first()
    .getAttribute("style");
  await page.locator("#theme-btn").click();
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "dark"
  );
  const darkPanel = await page
    .locator("[data-universe]")
    .evaluate(element => getComputedStyle(element).backgroundColor);
  assert.notEqual(darkPanel, lightPanel);
  assert.notDeepEqual(
    await page.locator("[data-canvas-host] canvas").screenshot(),
    lightCanvas
  );
  assert.equal(
    await page.locator("[data-planet-labels] a").first().getAttribute("style"),
    labelPosition
  );
  assert.equal(
    await page.locator("[data-universe-pause]").textContent(),
    "开始公转"
  );
  await page.reload();
  await page.waitForSelector("[data-planet-labels] a");
  assert.equal(
    await page
      .locator("[data-universe]")
      .evaluate(element => getComputedStyle(element).backgroundColor),
    darkPanel
  );
  await page.locator("[data-universe-pause]").click();
  await page.locator("#theme-btn").click();
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "light"
  );
  assert.equal(
    await page
      .locator("[data-universe]")
      .evaluate(element => getComputedStyle(element).backgroundColor),
    lightPanel
  );
  const before = await page
    .locator("[data-planet-labels] a")
    .first()
    .getAttribute("style");
  const canvas = await page.locator("canvas").boundingBox();
  await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + 60);
  await page.mouse.down();
  await page.mouse.move(canvas.x + canvas.width / 2 + 100, canvas.y + 100, {
    steps: 10,
  });
  await page.mouse.up();
  assert.notEqual(
    await page.locator("[data-planet-labels] a").first().getAttribute("style"),
    before
  );
  await page.locator("[data-universe-reset]").click();
  await page.locator("[data-fullscreen]").click();
  await page.waitForFunction(
    () =>
      document
        .querySelector("[data-fullscreen]")
        .getAttribute("aria-pressed") === "true"
  );
  assert.equal(
    await page.evaluate(
      () =>
        !!document.fullscreenElement ||
        document.querySelector("[data-universe]").classList.contains("expanded")
    ),
    true
  );
  await page.locator("[data-fullscreen]").click();
  await page.waitForFunction(
    () =>
      document
        .querySelector("[data-fullscreen]")
        .getAttribute("aria-pressed") === "false"
  );
  // Exercise the viewport fallback used on browsers without the Fullscreen API.
  await page.evaluate(() => {
    document.querySelector("[data-universe]").requestFullscreen = () =>
      Promise.reject(new Error("unsupported"));
  });
  await page.locator("[data-fullscreen]").click();
  await page.waitForSelector(".universe.expanded");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".universe.expanded").count(), 0);
  const first = page.locator("[data-planet-labels] a").first();
  await first.focus();
  assert.equal(
    await page.locator("[data-tag-name]").textContent(),
    await first.textContent()
  );
  const href = await first.getAttribute("href");
  await first.press("Enter");
  await page.waitForURL(href);
  await page.goBack();
  await page.waitForSelector("[data-planet-labels] a");
  assert.equal(await page.locator("[data-canvas-host] canvas").count(), 1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForFunction(
    () => document.querySelector("[data-universe-pause]").disabled
  );
  const still = await page
    .locator("[data-planet-labels] a")
    .first()
    .getAttribute("style");
  await page.waitForTimeout(200);
  assert.equal(
    await page.locator("[data-planet-labels] a").first().getAttribute("style"),
    still
  );
  assert.deepEqual(errors, []);
  const fallback = await browser.newPage();
  await fallback.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = () => null;
  });
  await fallback.goto(`${url}/tags/`);
  await fallback.waitForFunction(() =>
    document
      .querySelector("[data-scene-status]")
      .textContent.includes("无法开启")
  );
  assert.equal(
    await fallback.locator("[data-tag-directory]").getAttribute("open"),
    ""
  );
  assert.ok((await fallback.locator("[data-tag-node]:visible").count()) > 0);
} finally {
  await browser.close();
}
