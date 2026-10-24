import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { isBlocked } from "../src/walk.js";
const root = new URL("../", import.meta.url),
  report = { errors: [], checks: [] };
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
  let page = await browser.newPage({
    viewport: { width: 1200, height: 800 },
  });
  page.setDefaultTimeout(180000);
  page.on("pageerror", (e) => {
    report.errors.push(e.message);
    console.log("ERROR", e.message);
  });
  const click = async (name) => {
    if(name === "地图")return page.keyboard.press("KeyM");
    name=name === "暂停" ? "旅行菜单" : name;
    for(let i=0;i<3 && !await page.getByRole("button",{name,exact:true}).count();i++) {
      const more=page.getByRole("button",{name:"查看其他回答",exact:true});
      if(!await more.isVisible())break;
      await more.click();
    }
    return page.getByRole("button",{name,exact:true}).click();
  };
  async function reveal() {
    await click("显示完整字幕或继续");
    await page.keyboard.press("KeyE");
    await page.keyboard.press("KeyE");
  }
  await page.goto(new URL("index.html", root).href, {
    waitUntil: "domcontentloaded",
    timeout: 180000,
  });
  await page.waitForFunction(() => window.__qingming?.frames >= 2, null, {
    timeout: 180000,
  });
  const world = await page.evaluate(() => ({
    obstacles: window.__qingming.obstacles,
    people: window.__qingming.people,
  }));
  await writeFile(
    new URL("tests/world-obstacles.json", root),
    JSON.stringify(world.obstacles),
  );
  const bad = world.people.filter((p) =>
    isBlocked(p[0], p[2], world.obstacles),
  );
  console.log(
    "obstacles",
    world.obstacles.length,
    "blocked NPCs",
    bad.length,
    bad.slice(0, 5),
  );
  assert.equal(bad.length, 0);
  report.checks.push("All crowd spawn positions outside solid props");
  await click("带上120文，出发");
  assert.equal(await page.getByRole("dialog").count(), 0);
  report.checks.push("Opening stays in world and asks player to approach");
  await page.keyboard.press("KeyE");
  await page.getByRole("region", { name: "与阿芽交谈", exact: true }).waitFor();
  await reveal();
  await click("我来帮你绕开线");
  await reveal();
  await click("我想自己探索");
  report.checks.push("Proximity subtitle conversation and opening activity");
  await click("地图");
  await page.locator(".j-atlas img").waitFor({ state: "visible" });
  await page.waitForFunction(
    () => document.querySelector(".j-atlas img")?.naturalWidth > 100,
  );
  await page
    .getByRole("combobox", { name: "在导览图上找地点" })
    .selectOption("flowers");
  assert.equal(
    (await page
      .locator(".j-navigation-layers [data-layer=buildings] rect")
      .count()) > 15,
    true,
  );
  assert.ok((await page.locator(".j-atlas .map-route").getAttribute("d")).includes("L"));
  assert.equal(
    await page
      .locator(".j-map-legend")
      .getByText("道路", { exact: true })
      .isVisible(),
    true,
  );
  report.checks.push(
    "Navigation has distinct roads, river, building footprints, legend and a real obstacle-avoiding route preview",
  );
  await page.screenshot({
    path: new URL("journey-real-map.png", root).pathname,
    timeout: 180000,
  });
  await page
    .getByRole("combobox", { name: "在导览图上找地点" })
    .selectOption("toys");
  await click("在街上给我指路");
  assert.equal((await page.evaluate(() => window.__journey)).route.length, 0);
  assert.equal(
    (await page.evaluate(() => window.__journey)).guidance.id,
    "toys",
  );
  report.checks.push(
    "Real town survey map and manual guidance without automatic movement",
  );
  await click("地图");
  await page
    .getByRole("combobox", { name: "在导览图上找地点" })
    .selectOption("toys");
  await click("辅助带我走");
  await page.waitForFunction(() => !window.__journey.route.length, null, {
    timeout: 300000,
  });
  console.log("arrived", await page.evaluate(() => window.__journey));
  await page.keyboard.press("KeyE");
  await page
    .getByRole("region", { name: "与周货郎交谈", exact: true })
    .waitFor();
  await reveal();
  await page.screenshot({
    path: new URL("journey-scene-dialogue.png", root).pathname,
    timeout: 180000,
  });
  const money = await page.evaluate(() => window.__journey.money);
  assert.equal(await page.locator(".j-dialogue input").count(),0);
  await click("看看摊上的货");await reveal();
  await click("问问这件多少钱");
  assert.equal(await page.evaluate(() => window.__journey.money), money);
  await reveal();
  await click("确认购买");
  assert.equal(await page.evaluate(() => window.__journey.money), money - 12);
  report.checks.push(
    "Talk to merchant in scene, then open goods and confirm purchase",
  );
  await click("结束交谈");
  await page.keyboard.down("Shift");
  await page.keyboard.down("ArrowDown");
  try {
    const frame = await page.evaluate(()=>window.__qingming.frames);
    await page.waitForFunction(
      (f) => window.__qingming.frames >= f + 3,
      frame,
    );
  } finally {
    await page.keyboard.up("ArrowDown");
    await page.keyboard.up("Shift");
  }
  const after = await page.evaluate(() => window.__journey.position);
  assert.equal(isBlocked(after.x, after.z, world.obstacles), false);
  report.checks.push(
    "Movement input beside solid props does not place the protagonist inside one",
  );
  await click("暂停");
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
  report.checks.push(
    "Pause freezes the whole town and closing the menu resumes it",
  );
  await page.close();
  page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  page.setDefaultTimeout(180000);
  page.on("pageerror", (e) => report.errors.push(e.message));
  await page.goto(new URL("index.html", root).href, {
    waitUntil: "domcontentloaded",
    timeout: 180000,
  });
  await page.waitForFunction(() => window.__qingming?.frames >= 2, null, {
    timeout: 180000,
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
  report.checks.push("Native mobile touch joystick moves the protagonist");
  await page.screenshot({
    path: new URL("journey-mobile-controls.png", root).pathname,
    timeout: 180000,
  });
  await click("地图");
  await page
    .getByRole("combobox", { name: "在导览图上找地点" })
    .selectOption("granny");
  await page.waitForFunction(
    () => document.querySelector(".j-atlas img")?.naturalWidth > 100,
  );
  assert.equal(
    await page
      .getByRole("button", { name: "在街上给我指路", exact: true })
      .isVisible(),
    true,
  );
  const layout = await page.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  assert.equal(layout.width, layout.scroll);
  await page.screenshot({
    path: new URL("journey-mobile-map.png", root).pathname,
    timeout: 180000,
  });
  report.checks.push(
    "Real survey map, destination selector and guidance fit a 390px viewport",
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
    new URL("revision-test-results.json", root),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
