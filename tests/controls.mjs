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
const pass = (name) => {
  report.checks.push(name);
  console.log("PASS", name);
};
async function open(options) {
  const page = await browser.newPage(options);
  page.setDefaultTimeout(120000);
  page.on("pageerror", (e) => report.errors.push(e.message));
  await page.goto(new URL("index.html", root).href, {
    waitUntil: "domcontentloaded",
    timeout: 180000,
  });
  await page.waitForFunction(() => window.__qingming?.frames >= 2, null, {
    timeout: 180000,
  });
  return page;
}
try {
  let page = await open({ viewport: { width: 1100, height: 760 } });
  const click = (name) => name === "地图" ? page.keyboard.press("KeyM") :
    page.getByRole("button", { name:name === "暂停" ? "旅行菜单" : name, exact: true }).click();
  await click("带上120文，出发");
  const before = await page.evaluate(() => window.__journey.position);
  await page.keyboard.down("Shift");
  await page.keyboard.down("ArrowDown");
  try {
    await page.waitForFunction(
      (p) =>
        Math.hypot(
          window.__journey.position.x - p.x,
          window.__journey.position.z - p.z,
        ) > 0.2 && window.__journey.stamina < 99,
      before,
    );
  } finally {
    await page.keyboard.up("ArrowDown");
    await page.keyboard.up("Shift");
  }
  pass("Native keyboard walk/run changes position and consumes stamina");
  await click("暂停");
  assert.equal(await page.evaluate(() => window.__journey.paused), true);
  const frozen = await page.evaluate(() => window.__qingming);
  await page.waitForFunction(
    (f) => window.__qingming.frames >= f + 2,
    frozen.frames,
  );
  assert.equal(
    await page.evaluate(() => window.__qingming.elapsed),
    frozen.elapsed,
  );
  await click("关闭窗口");
  assert.equal(await page.evaluate(() => window.__journey.paused), false);
  pass("Pause freezes town animation; closing dialog resumes simulation");
  const position = await page.evaluate(() => window.__journey.position);
  await page.reload({ waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForFunction(() => window.__qingming?.frames >= 2, null, {
    timeout: 180000,
  });
  const restored = await page.evaluate(() => window.__journey.position);
  assert.ok(Math.hypot(restored.x - position.x, restored.z - position.z) < 0.1);
  pass("Page exit saves the latest walk position");
  await click("先看全卷");
  await click("虹桥");
  await page.waitForFunction(
    () => Math.abs(window.__qingming.camera[0] - 9) < 0.1,
  );
  await click("全卷");
  await page.waitForFunction(
    () => Math.abs(window.__qingming.camera[2] - 83) < 0.1,
  );
  await page.mouse.move(300, 350);
  await page.mouse.down();
  await page.mouse.move(800, 350, { steps: 8 });
  await page.mouse.up();
  await page.waitForFunction(() => window.__qingming.camera[2] < -30);
  const beforeZoom = await page.evaluate(() => ({
    camera: window.__qingming.camera,
    target: window.__qingming.target,
  }));
  await page.mouse.wheel(0, -250);
  await page.waitForFunction(
    (c) =>
      Math.hypot(
        ...window.__qingming.camera.map(
          (n, i) => n - window.__qingming.target[i],
        ),
      ) <
      Math.hypot(...c.camera.map((n, i) => n - c.target[i])) - 1,
    beforeZoom,
  );
  pass("Free-view presets, rear orbit and wheel zoom still work");
  await page.close();
  page = await open({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await click("带上120文，出发");
  const pad = await page.locator(".j-pad").boundingBox(),
    start = await page.evaluate(() => window.__journey.position);
  assert.ok(pad?.width > 0);
  const client = await page.context().newCDPSession(page),
    x = pad.x + pad.width / 2,
    y = pad.y + pad.height / 2;
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y, id: 1 }],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x, y: y + 28, id: 1 }],
  });
  try {
    await page.waitForFunction(
      (p) =>
        Math.hypot(
          window.__journey.position.x - p.x,
          window.__journey.position.z - p.z,
        ) > 0.2,
      start,
    );
  } finally {
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  }
  pass("Native mobile touch joystick moves the protagonist");
  const layout = await page.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  assert.equal(layout.width, layout.scroll);
  await page.screenshot({
    path: new URL("journey-mobile-controls.png", root).pathname,
    timeout: 120000,
  });
  await click("地图");
  await page
    .getByRole("combobox", { name: "在导览图上找地点" })
    .selectOption("granny");
  assert.equal(
    await page
      .getByRole("button", { name: "在街上给我指路", exact: true })
      .isVisible(),
    true,
  );
  pass("Mobile controls and scene survey map fit 390px viewport");
  assert.deepEqual(report.errors, []);
  report.passed = true;
} catch (e) {
  report.passed = false;
  report.failure = e.stack;
  throw e;
} finally {
  await writeFile(
    new URL("controls-test-results.json", root),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}
