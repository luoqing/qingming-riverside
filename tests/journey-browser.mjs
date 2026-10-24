import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const root = new URL("../", import.meta.url),
  report = { checks: [], errors: [], externalRequests: [] },
  started = Date.now();
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
let page;
const state = () => page.evaluate(() => window.__journey);
const pass = (name) => {
  report.checks.push(name);
  console.log(Math.round((Date.now() - started) / 1000) + "s PASS", name);
};
const click = async (name) => {
  if(name === "地图") return page.keyboard.press("KeyM");
  if(name === "暂停") name="旅行菜单";
  if(name === "看全卷") {await page.getByRole("button",{name:"旅行菜单",exact:true}).click();name="回看全卷";}
  for(let i=0;i<3 && !await page.getByRole("button",{name,exact:true}).count();i++) {
    const more=page.getByRole("button",{name:"查看其他回答",exact:true});
    if(!await more.isVisible())break;
    await more.click();
  }
  return page.getByRole("button", { name, exact: true }).click();
};
async function close() {
  if ((await state()).dialogue) await click("结束交谈");
  else await click("关闭窗口");
}
async function reveal() {
  for (let i = 0; i < 4; i++) await click("显示完整字幕或继续");
}
async function travel(label, id) {
  await click("地图");
  await page
    .getByRole("combobox", { name: "在导览图上找地点" })
    .selectOption(id);
  await click("辅助带我走");
  console.log("walking", id);
  await page.waitForFunction(
    (id) =>
      !window.__journey.route.length &&
      window.__journey.routeName !== "" &&
      window.__journey.near === id,
    id,
    { timeout: 360000 },
  );
}
async function interact(title) {
  await page.keyboard.press("KeyE");
  const speakers = {
    周货郎玩具摊: "周货郎",
    躲在人后的小鼓手: "豆豆",
    花娘鲜花摊: "花娘",
    城门旁的花婆婆: "花婆婆",
    沈船娘的篷船: "沈船娘",
  };
  if (speakers[title]) {
    await page
      .getByRole("region", { name: `与${speakers[title]}交谈`, exact: true })
      .waitFor();
    await reveal();
  } else await page.getByRole("dialog", { name: title, exact: true }).waitFor();
}
try {
  page = await browser.newPage({ viewport: { width: 960, height: 700 } });
  page.setDefaultTimeout(120000);
  page.on("pageerror", (e) => {
    report.errors.push(e.message);
    console.log("ERROR", e.message);
  });
  page.on("console", (m) => {
    if (m.type() === "error") report.errors.push(m.text());
  });
  page.on("request", (r) => {
    if (/^https?:/.test(r.url())) report.externalRequests.push(r.url());
  });
  await page.goto(new URL("index.html", root).href, {
    waitUntil: "domcontentloaded",
    timeout: 180000,
  });
  await page.waitForFunction(() => window.__qingming?.frames >= 2, null, {
    timeout: 180000,
  });
  pass("Offline standalone boots");
  const demo = await page.evaluate(() => window.__qingming.demographics);
  for (const age of ["child", "adult", "elder"])
    for (const gender of ["male", "female"])
      assert.ok(demo[`${age}-${gender}`] > 0);
  report.demographics = demo;
  pass("Men, women, elderly and children all present");
  await click("小男孩");
  await click("带上120文，出发");
  await page.keyboard.press("KeyE");
  await reveal();
  await click("我来帮你绕开线");
  assert.ok((await state()).story.includes("invited"));
  pass("Choose protagonist and untangle introduction");
  await reveal();
  await click("我想自己探索");
  await travel("", "toys");
  pass("Hero walks along real roads to a stall");
  await page.screenshot({
    path: new URL("journey-preview.png", root).pathname,
    timeout: 120000,
  });
  await interact("周货郎玩具摊");
  assert.equal(await page.locator(".j-dialogue input").count(),0);
  await click("看看摊上的货");await reveal();
  await click("问问这件多少钱");await reveal();
  assert.equal((await state()).money, 120);
  await click("便宜一点可以吗");
  await reveal();
  assert.equal((await state()).money, 120);
  await click("确认购买");
  assert.equal((await state()).money, 110);
  assert.equal((await state()).inventory.rattle, 1);
  pass("Staged subtitle price inquiry, bargain, explicit confirmation and inventory without textbox");
  await reveal();await click("再看看");await reveal();
  await click("挑选竹蜻蜓");await reveal();
  await click("问问这件多少钱");await reveal();
  await click("确认购买");
  assert.equal((await state()).money, 103);
  await close();
  await click("背包");
  const rattle = page
    .locator(".j-item")
    .filter({ has: page.getByText("拨浪鼓 × 1", { exact: true }) });
  await rattle.getByRole("button", { name: "拿在手里", exact: true }).click();
  await click("摇一摇");
  assert.equal((await state()).drumBeats, 1);
  pass("Bought rattle equips and plays");
  await click("背包");
  const df = page
    .locator(".j-item")
    .filter({ has: page.getByText("竹蜻蜓 × 1", { exact: true }) });
  await df.getByRole("button", { name: "拿在手里", exact: true }).click();
  await click("搓一搓");
  await page.waitForFunction(
    () => window.__journey.flight?.kind === "dragonfly",
  );
  const p1 = (await state()).flight.position;
  await page.waitForFunction(
    (p) =>
      window.__journey.flight &&
      window.__journey.flight.position.some((n, i) => Math.abs(n - p[i]) > 0.1),
    p1,
  );
  pass("Dragonfly actually leaves the hand and moves in world space");
  await travel("找豆豆", "doudou");
  await interact("躲在人后的小鼓手");
  await click("找安静的地方练");
  for (let i = 0; i < 3; i++) await click("摇一摇");
  assert.ok((await state()).story.includes("drum"));
  await reveal();
  await click("记住啦");
  pass("Contextual dialogue and visible drum duet advance story");
  await travel("去花娘鲜花摊", "flowers");
  await interact("花娘鲜花摊");
  await click("聊聊花婆婆托的花");
  await click("带一枝淡粉海棠");
  assert.equal((await state()).inventory.begonia, 1);
  assert.equal((await state()).flowerChoice, "begonia");
  await click("记住啦");
  pass("Free flower quest accepts a meaningful alternate choice");
  await travel("去虹桥", "bridge");
  assert.ok((await state()).position.y > 4.8);
  await page.keyboard.press("KeyE");
  await page.waitForFunction(()=>window.__journey.story.includes("ribbon"));
  assert.ok((await state()).story.includes("ribbon"));
  pass("Bridge climbing and in-world wind observation");
  await travel("找花婆婆", "granny");
  await interact("城门旁的花婆婆");
  await click("把带来的花交给婆婆");
  assert.ok((await state()).story.includes("gift"));
  assert.equal((await state()).inventory.begonia, undefined);
  assert.equal((await state()).money, 123);
  await reveal();
  await click("记住啦");
  pass("Cross-river travel and flower gift consume item with one-time reward");
  await travel("去古塔", "pagoda");
  assert.ok((await state()).visited.includes("pagoda"));
  pass("Can pass town and reach optional pagoda");
  await travel("去汴河渡口", "harbor");
  await interact("沈船娘的篷船");
  await click("付12文，坐船游览");
  await page.waitForFunction(
    () => window.__journey.cruise?.progress > 0.2,
    null,
    { timeout: 180000 },
  );
  const boatPosition = await page.evaluate(() => window.__qingming.boats[6]);
  await page.screenshot({
    path: new URL("journey-boat-preview.png", root).pathname,
    timeout: 120000,
  });
  await page.keyboard.press("KeyE");
  await reveal();
  await click("我和豆豆把小鼓摇响了。");
  assert.ok((await state()).poems.includes("我和豆豆把小鼓摇响了。"));
  await reveal();
  await click("结束交谈");
  await click("提前返航");
  await page.waitForFunction(
    () => window.__journey.rides === 1 && !window.__journey.cruise,
    null,
    { timeout: 180000 },
  );
  pass("Ride a moving boat, write an original line, return safely to shore");
  await click("牵住线，开始放飞");
  await click("帮我慢慢放线");
  await page.waitForFunction(() => window.__journey.completed, null, {
    timeout: 180000,
  });
  assert.ok((await state()).story.includes("finale"));
  await page.screenshot({
    path: new URL("journey-finale-preview.png", root).pathname,
    timeout: 120000,
  });
  pass("Personalized kite launches and full story ends");
  await click("带着纸鸢继续逛");
  await click("暂停");
  assert.equal((await state()).paused, true);
  await click("继续春游");
  assert.equal((await state()).paused, false);
  pass("Pause can resume using close button");
  const beforeRun = (await state()).position;
  await page.keyboard.down("Shift");
  await page.keyboard.down("ArrowDown");
  try {
    await page.waitForFunction(
      (p) =>
        Math.hypot(
          window.__journey.position.x - p.x,
          window.__journey.position.z - p.z,
        ) > 0.2 && window.__journey.stamina < 99,
      beforeRun,
    );
  } finally {
    await page.keyboard.up("ArrowDown");
    await page.keyboard.up("Shift");
  }
  pass("Native directional keys and running change position and stamina");
  const saved = await state();
  await page.reload({ waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForFunction(() => window.__qingming?.frames >= 2, null, {
    timeout: 180000,
  });
  await click("继续我的春游");
  assert.equal((await state()).completed, true);
  assert.equal((await state()).money, saved.money);
  assert.deepEqual((await state()).story, saved.story);
  pass("Reload restores local journey and purchases");
  await click("看全卷");
  assert.equal((await state()).active, false);
  await click("虹桥");
  await page.waitForFunction(
    () => Math.abs(window.__qingming.camera[0] - 9) < 0.1,
  );
  await page.mouse.move(540, 320);
  await page.mouse.wheel(0, -200);
  await click("走进画里 · 开始春游");
  assert.equal((await state()).completed, true);
  pass("Can return to free camera, use bridge view and resume journey");
  await page.close();
  page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  page.setDefaultTimeout(120000);
  page.on("pageerror", (e) => report.errors.push(e.message));
  await page.goto(new URL("index.html", root).href, {
    waitUntil: "domcontentloaded",
    timeout: 180000,
  });
  await page.waitForFunction(() => window.__qingming?.frames >= 2, null, {
    timeout: 180000,
  });
  await click("带上120文，出发");
  const layout = await page.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
    pad: document.querySelector(".j-pad").getBoundingClientRect().toJSON(),
  }));
  assert.equal(layout.width, layout.scroll);
  assert.ok(layout.pad.width > 0);
  await page.screenshot({
    path: new URL("journey-mobile-preview.png", root).pathname,
    timeout: 120000,
  });
  const beforePad = (await state()).position;
  await page.mouse.move(layout.pad.x + 54, layout.pad.y + 54);
  await page.mouse.down();
  await page.mouse.move(layout.pad.x + 54, layout.pad.y + 85);
  try {
    await page.waitForFunction(
      (p) =>
        Math.hypot(
          window.__journey.position.x - p.x,
          window.__journey.position.z - p.z,
        ) > 0.15,
      beforePad,
    );
  } finally {
    await page.mouse.up();
  }
  pass("Mobile joystick moves the protagonist through pointer events");
  await click("地图");
  await page
    .getByRole("combobox", { name: "在导览图上找地点" })
    .selectOption("granny");
  assert.ok(
    await page
      .getByRole("button", { name: "在街上给我指路", exact: true })
      .isVisible(),
  );
  pass("390px mobile UI, joystick and map fit viewport");
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.externalRequests, []);
  pass("No browser errors or external asset requests");
  report.passed = true;
} catch (e) {
  report.passed = false;
  report.failure = e.stack;
  if (page) {
    report.lastState = await state().catch(() => null);
    await page
      .screenshot({
        path: new URL("journey-failure.png", root).pathname,
        timeout: 30000,
      })
      .catch(() => {});
  }
  throw e;
} finally {
  await writeFile(
    new URL("journey-test-results.json", root),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}
