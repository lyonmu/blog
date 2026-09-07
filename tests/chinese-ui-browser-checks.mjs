import assert from "node:assert/strict";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const url = process.env.BLOG_URL || "http://127.0.0.1:4321";
try {
  const page = await browser.newPage({ reducedMotion: "reduce" });
  const oldCopy =
    /Building systems|Explore Notes|Engineering Journal|Cloud Native Digital Garden|TOPIC UNIVERSE|SYSTEMS IN BALANCE|On this page|Search notes|Technology areas|Powered by/;
  for (const width of [375, 989, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of [
      "/",
      "/tags/",
      "/posts/",
      "/archives/",
      "/about/",
      "/search/",
    ]) {
      await page.goto(`${url}${route}`);
      const heading = await page.locator("main h1").innerText();
      assert.match(heading, /[\u4e00-\u9fff]/);
      assert.doesNotMatch(await page.locator("body").innerText(), oldCopy);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth
        ),
        false,
        `${route} at ${width}px`
      );
    }
  }
  await page.goto(`${url}/about/`);
  assert.equal(
    await page
      .locator('[aria-label="面包屑导航"] [aria-current="page"]')
      .innerText(),
    "关于"
  );
  await page.goto(url);
  assert.match(
    await page.locator("time").first().innerText(),
    /^\d{4}年\d{1,2}月\d{1,2}日$/
  );
} finally {
  await browser.close();
}
