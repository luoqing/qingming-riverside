import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const root = new URL("../", import.meta.url),
  report = { checks: [], errors: [] };
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_EXECUTABLE_PATH,
  ignoreDefaultArgs: ["--disable-dev-shm-usage"],
  args: [
    "--no-sandbox",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
try {
  const page = await browser.newPage({
    viewport: { width: 960, height: 700 },
  });
  page.setDefaultTimeout(180000);
  page.on("pageerror", (e) => report.errors.push(e.message));
  const click = (name) =>
    page.getByRole("button", { name, exact: true }).click();
  await page.goto(new URL("index.html", root).href, {
    waitUntil: "domcontentloaded",
    timeout: 180000,
  });
  await page.waitForFunction(() => window.__qingming?.frames >= 2, null, {
    timeout: 180000,
  });
  await click("带上120文，出发");
  await page.keyboard.press("KeyM");
  const select = page.getByRole("combobox", { name: "在导览图上找地点" });
  await select.selectOption("granny");
  await page.waitForFunction(
    () => document.querySelector(".j-atlas img")?.naturalWidth > 100,
  );
  await page.screenshot({
    path: new URL("journey-navigation-preview.png", root).pathname,
    timeout: 180000,
  });
  await select.selectOption("harbor");
  await click("辅助带我走");
  await page.waitForFunction(
    () => !window.__journey.route.length && window.__journey.near === "harbor",
    null,
    { timeout: 360000 },
  );
  await page.keyboard.press("KeyE");
  await page
    .getByRole("region", { name: "与沈船娘交谈", exact: true })
    .waitFor();
  await click("显示完整字幕或继续");
  await page.keyboard.press("KeyE");
  await page.keyboard.press("KeyE");
  await click("付12文，坐船游览");
  const first = await page.evaluate(() => window.__journey.cruise.position);
  await page.waitForFunction(
    () => window.__journey.cruise?.progress > 0.22,
    null,
    { timeout: 240000 },
  );
  const state = await page.evaluate(() => ({
    trip: window.__journey,
    view: window.__qingming,
  }));
  assert.ok(
    Math.hypot(...state.trip.cruise.position.map((n, i) => n - first[i])) > 4,
  );
  assert.ok(
    Math.hypot(
      ...state.trip.cruise.position.map(
        (n, i) => n - state.trip.cruise.passenger[i],
      ),
    ) < 3,
  );
  assert.ok(Math.abs(state.view.camera[1] - state.view.target[1] - 2) < 0.1);
  await page.screenshot({
    path: new URL("journey-boat-preview.png", root).pathname,
    timeout: 180000,
  });
  report.checks.push(
    "Passenger rides an actually moving boat; low river camera remains below the bridge deck",
  );
  await page.keyboard.press("KeyE");
  await click("显示完整字幕或继续");
  await click("我在虹桥看见大船。");
  assert.ok(
    await page.evaluate(() =>
      window.__journey.poems.includes("我在虹桥看见大船。"),
    ),
  );
  await click("结束交谈");
  await click("提前返航");
  await page.waitForFunction(
    () => window.__journey.rides === 1 && !window.__journey.cruise,
    null,
    { timeout: 240000 },
  );
  const landed = await page.evaluate(() => ({
    trip: window.__journey,
    view: window.__qingming,
  }));
  assert.equal(landed.trip.money, 108);
  assert.ok(
    Math.abs(landed.view.camera[1] - landed.view.target[1] - 1.65) < 0.1,
  );
  report.checks.push(
    "In-scene verse saves, return travels back, disembarking restores the walking camera",
  );
  assert.deepEqual(report.errors, []);
  report.passed = true;
} catch (e) {
  report.passed = false;
  report.failure = e.stack;
  throw e;
} finally {
  console.log(JSON.stringify(report, null, 2));
  await writeFile(
    new URL("boat-test-results.json", root),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
