import { chromium } from "@playwright/test";
import assert from "node:assert/strict";

const browser = await chromium.launch({ channel: "chrome", headless: true });
const url = process.env.APP_URL || "http://127.0.0.1:8765";
const baseline = process.env.BASELINE_URL;
const errors = [];
async function open(base, viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base);
  await page.waitForSelector("#fold canvas");
  await page.waitForTimeout(300);
  return page;
}
async function slider(page, id, value) {
  await page.locator(`#${id}`).evaluate((input, value) => {
    input.value = String(value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
  await page.waitForTimeout(600);
}
try {
  for (const viewport of [
    { width: 1280, height: 1000 },
    { width: 393, height: 852 },
  ]) {
    const page = await open(url, viewport);
    const old = baseline ? await open(baseline, viewport) : null;
    if (old) {
      const texts = (p) =>
        p.locator("p, button, label, summary, h1, small").allTextContents();
      assert.deepEqual(
        await texts(page),
        await texts(old),
        "UI text must be preserved",
      );
      assert(
        (await page.screenshot({ fullPage: true })).equals(
          await old.screenshot({ fullPage: true }),
        ),
        "initial full-page pixels differ",
      );
    }
    assert.equal(
      await page.locator("#fold canvas").count(),
      1,
      "StrictMode must leave exactly one canvas",
    );
    for (const value of [0, 25, 42, 50, 58, 75, 100]) {
      await slider(page, "progress", value);
      if (old) {
        await slider(old, "progress", value);
        const actual = await page.locator("#fold").screenshot();
        const expected = await old.locator("#fold").screenshot();
        assert(
          actual.equals(expected),
          `canvas pixels differ at ${value}, width ${viewport.width}`,
        );
      }
    }
    for (const value of [0, 50, 100]) {
      await slider(page, "blur-strength", value);
      if (old) {
        await slider(old, "blur-strength", value);
        assert(
          (await page.locator("#fold").screenshot()).equals(
            await old.locator("#fold").screenshot(),
          ),
          `blur ${value} differs`,
        );
      }
    }
    await slider(page, "scatter-x", 73);
    await page.reload();
    await page.waitForSelector("#fold canvas");
    assert.equal(await page.locator("#scatter-x").inputValue(), "73");
    await page.locator("#reset-effects").click();
    const values = await page
      .locator("input[type=range]:not(#progress)")
      .evaluateAll((inputs) => inputs.map((input) => input.value));
    assert(values.every((value) => value === "50"));
    await page.locator("#file").setInputFiles("public/sample.svg");
    await page.waitForFunction(() =>
      document.querySelector("#status").textContent.includes("截图已载入"),
    );
    await page.locator("#immersive").click();
    await page.waitForFunction(() =>
      document.body.classList.contains("immersed"),
    );
    assert.equal(await page.locator("body > #stage").count(), 1);
    await page.locator("#exit").click();
    await page.waitForFunction(
      () => !document.body.classList.contains("immersed"),
    );
    assert.equal(await page.locator("#app > #stage").count(), 1);
    await page.locator("#layout-details").click();
    assert.match(
      await page.locator("#layout-info").textContent(),
      /全参数精调 23/,
    );
    await page.close();
    await old?.close();
  }
  assert.deepEqual(errors, []);
  console.log(
    "Browser regression passed: desktop/mobile, 7 angles, blur extremes, persistence/reset, image import, immersive lifecycle, diagnostics, no runtime errors." +
      (baseline ? " Original/new canvas PNGs are byte-identical." : ""),
  );
} finally {
  await browser.close();
}
