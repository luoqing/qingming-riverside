import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const root = new URL("../", import.meta.url),
  url = process.env.TEST_URL || new URL("index.html", root).href;
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_EXECUTABLE_PATH,
  args: [
    "--no-sandbox",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const results = { checks: [], errors: [], externalRequests: [] };
function watch(page) {
  page.on("pageerror", (e) => results.errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") results.errors.push(m.text());
  });
  page.on("request", (r) => {
    if (/^https?:/.test(r.url()) && !r.url().startsWith(new URL(url).origin))
      results.externalRequests.push(r.url());
  });
}
const state = (page) => page.evaluate(() => window.__qingming);
const check = (name) => {
  results.checks.push(name);
  console.log("PASS", name);
};
async function ready(page) {
  await page.waitForFunction(
    () =>
      window.__qingming?.frames >= 2 &&
      getComputedStyle(document.querySelector("#loading")).opacity === "0",
    null,
    { timeout: 180000 },
  );
  if(await page.getByRole('button',{name:'先看全卷',exact:true}).isVisible())await page.getByRole('button',{name:'先看全卷',exact:true}).click();
}
async function view(page, name) {
  await page.getByRole("button", { name, exact: true }).click();
  await page.waitForFunction(
    () => performance.now() - window.__qingming.lastFrame < 3000,
    null,
    { timeout: 120000 },
  );
}
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 1,
  });
  watch(page);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 180000 });
  await ready(page);
  const first = await state(page);
  assert.equal(first.people.length, 133);
  assert.equal(first.boats.length, 8);
  check("133 figures and 8 boats initialize");
  await page.screenshot({
    path: new URL("preview.png", root).pathname,
    timeout: 120000,
  });
  await page.waitForFunction(
    (t) => window.__qingming.elapsed > t + 0.2,
    first.elapsed,
    { timeout: 120000 },
  );
  const moved = await state(page);
  assert.notDeepEqual(moved.people[0], first.people[0]);
  assert.notDeepEqual(moved.boats[0], first.boats[0]);
  check("People and boats actually change world positions");
  await page.getByRole("button", { name: "暂停场景动画", exact: true }).click();
  const pause = await state(page);
  await page.waitForFunction(
    (n) => window.__qingming.frames > n + 3,
    pause.frames,
    { timeout: 120000 },
  );
  assert.equal((await state(page)).elapsed, pause.elapsed);
  check("Pause freezes animation while rendering stays active");
  await page.getByRole("button", { name: "继续场景动画", exact: true }).click();
  await page.waitForFunction(
    (t) => window.__qingming.elapsed > t + 0.1,
    pause.elapsed,
    { timeout: 120000 },
  );
  check("Resume restores animation");
  await view(page, "虹桥");
  await page.waitForFunction(
    () =>
      window.__qingming.selectedView === "bridge" &&
      Math.abs(window.__qingming.camera[0] - 9) < 0.1,
    null,
    { timeout: 120000 },
  );
  assert.equal(
    await page
      .getByRole("button", { name: "虹桥", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(
    await page
      .getByRole("button", { name: "全卷", exact: true })
      .getAttribute("aria-pressed"),
    "false",
  );
  results.viewButtons = await page
    .locator("[data-view]")
    .evaluateAll((buttons) =>
      buttons.map((b) => ({
        view: b.dataset.view,
        active: b.classList.contains("active"),
        background: getComputedStyle(b).backgroundColor,
      })),
    );
  await page.screenshot({
    path: new URL("bridge-preview.png", root).pathname,
    timeout: 120000,
  });
  check("Bridge preset reaches the real bridge");
  await view(page, "城阙");
  await page.waitForFunction(
    () => Math.abs(window.__qingming.camera[0] - 31) < 0.1,
    null,
    { timeout: 120000 },
  );
  await page.screenshot({
    path: new URL("gate-preview.png", root).pathname,
    timeout: 120000,
  });
  check("Gate preset works");
  await view(page, "全卷");
  await page.waitForFunction(
    () => Math.abs(window.__qingming.camera[2] - 83) < 0.1,
    null,
    { timeout: 120000 },
  );
  const beforeDrag = await state(page);
  await page.mouse.move(450, 420);
  await page.mouse.down();
  await page.mouse.move(950, 440, { steps: 8 });
  await page.mouse.up();
  await page.waitForFunction(() => window.__qingming.camera[2] < -30, null, {
    timeout: 120000,
  });
  await page.screenshot({
    path: new URL("rear-preview.png", root).pathname,
    timeout: 120000,
  });
  check("Native drag reveals the modeled reverse side");
  const beforeZoom = await state(page);
  await page.mouse.wheel(0, -400);
  await page.waitForFunction(
    (c) =>
      Math.hypot(
        ...window.__qingming.camera.map(
          (n, i) => n - window.__qingming.target[i],
        ),
      ) <
      Math.hypot(...c.camera.map((n, i) => n - c.target[i])) - 1,
    beforeZoom,
    { timeout: 120000 },
  );
  check("Mouse wheel zoom works");
  await page.getByRole("button", { name: "开启自动环游", exact: true }).click();
  assert.equal((await state(page)).touring, true);
  const tour = await state(page);
  await page.waitForFunction(
    (c) => Math.abs(window.__qingming.camera[0] - c) > 0.05,
    tour.camera[0],
    { timeout: 120000 },
  );
  check("Automatic orbit changes camera position");
  await page.getByRole("button", { name: "关闭自动环游", exact: true }).click();
  await page.close();
  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  watch(mobile);
  await mobile.goto(new URL("index.html", root).href, {
    waitUntil: "domcontentloaded",
    timeout: 180000,
  });
  await ready(mobile);
  const layout = await mobile.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
    dock: document.querySelector(".dock").getBoundingClientRect().toJSON(),
    title: document.querySelector("header").getBoundingClientRect().toJSON(),
  }));
  assert.equal(layout.scroll, layout.width);
  assert.ok(layout.dock.x >= 0 && layout.dock.right <= 390);
  assert.ok(layout.title.right <= 390);
  await mobile.screenshot({
    path: new URL("mobile-preview.png", root).pathname,
    timeout: 120000,
  });
  check("Standalone HTML opens offline; 390px mobile layout fits");
  await mobile.getByRole("button", { name: "虹桥", exact: true }).click();
  await mobile.waitForFunction(
    () => window.__qingming.selectedView === "bridge",
    null,
    { timeout: 120000 },
  );
  check("Mobile buttons remain usable");
  assert.deepEqual(results.externalRequests, []);
  assert.deepEqual(results.errors, []);
  check("No external asset requests or browser errors");
  results.desktop = { calls: moved.calls, triangles: moved.triangles };
  results.passed = true;
} catch (e) {
  results.passed = false;
  results.failure = e.stack;
  throw e;
} finally {
  await writeFile(
    new URL("test-results.json", root),
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
}
