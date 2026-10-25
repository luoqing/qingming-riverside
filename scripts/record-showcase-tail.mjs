import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);
const output = new URL("recordings/showcase/", root);
const url = new URL("index.html", root).href;
const checkpointFile = new URL("replay-checkpoint.json", output);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_EXECUTABLE_PATH,
  ignoreDefaultArgs: ["--disable-dev-shm-usage"],
  args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const report = { kind: "game-tail", source: "actual play resumed from a browser save made by this script", chapters: [], errors: [] };
let context, page, video, started;
const state = () => page.evaluate(() => window.__journey);
const hold = ms => page.waitForTimeout(ms);
const mark = title => {
  const seconds = (Date.now() - started) / 1000;
  report.chapters.push({ title, seconds });
  console.log(`${seconds.toFixed(1)}s ${title}`);
};
async function click(name) {
  for (let i = 0; i < 4 && !await page.getByRole("button", { name, exact: true }).count(); i++) {
    const more = page.getByRole("button", { name: "查看其他回答", exact: true });
    if (!await more.isVisible()) break;
    await more.click();
  }
  await page.getByRole("button", { name, exact: true }).click();
}
async function reveal() {
  for (let i = 0; i < 4; i++) {
    const next = page.getByRole("button", { name: "显示完整字幕或继续", exact: true });
    if (!await next.isVisible()) break;
    await next.click();
  }
}
async function talk(owner) {
  await page.keyboard.press("KeyE");
  await page.getByRole("region", { name: `与${owner}交谈`, exact: true }).waitFor();
  await reveal();
}
async function travel(id) {
  let attempts = 0;
  while (attempts < 12) {
    await page.keyboard.press("KeyM");
    await page.getByRole("combobox", { name: "在导览图上找地点" }).selectOption(id);
    await click("辅助带我走");
    let previous = (await state()).position;
    let still = 0;
    for (let i = 0; i < 30; i++) {
      await hold(10000);
      const current = await state();
      if (!current.route.length && current.near === id) return;
      const distance = Math.hypot(current.position.x - previous.x, current.position.z - previous.z);
      still = distance < 0.18 ? still + 1 : 0;
      previous = current.position;
      if (still >= 2 || !current.route.length) break;
    }
    attempts++;
    const before = (await state()).position;
    for (const key of ["KeyD", "KeyA", "KeyS", "KeyW"]) {
      await page.keyboard.down(key);
      await hold(1300);
      await page.keyboard.up(key);
      const after = (await state()).position;
      if (Math.hypot(after.x - before.x, after.z - before.z) > 0.4) break;
    }
    console.log(`reroute ${id} after crowd blockage, attempt ${attempts}`);
  }
  throw new Error(`Could not walk to ${id} after real-keyboard detours`);
}
async function ready() {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 240000 });
  await page.waitForFunction(() => window.__qingming?.frames >= 3 && window.__journey?.heroModel.loaded.length === 2, null, { timeout: 300000 });
}
try {
  // Recreate the story prerequisites through real choices, then resume that save
  // in a fresh recording context. No quest flag or player position is injected.
  let checkpoint;
  try { checkpoint = JSON.parse(await readFile(checkpointFile, "utf8")); } catch {}
  context = await browser.newContext({ viewport: { width: 720, height: 500 }, deviceScaleFactor: 0.55 });
  if (checkpoint) await context.addInitScript(save => localStorage.setItem("bianhe-spring-journey-v1", save), checkpoint.save);
  page = await context.newPage();
  page.setDefaultTimeout(120000);
  await ready();
  if (checkpoint) await click("继续我的春游");
  else {
    await click("小女孩");
    await click("带上120文，出发");
    await click("旅行菜单");
    await click("对白语音：开");
    await click("继续春游");
  }
  const save = async title => {
    const value = await page.evaluate(() => localStorage.getItem("bianhe-spring-journey-v1"));
    assert.ok(value);
    await writeFile(checkpointFile, JSON.stringify({ title, save: value }));
    console.log(`replay checkpoint: ${title}`);
  };
  if (!(await state()).story.includes("invited")) {
    await talk("阿芽");
    await click("我来帮你绕开线");
    await reveal(); await click("我想自己探索");
    await save("阿芽");
  }
  if (!(await state()).story.includes("drum")) {
    await travel("doudou");
    await talk("豆豆");
    await click("借我一面鼓试试");
    await reveal(); await click("接过鼓，一起摇");
    for (let i = 0; i < 3; i++) await click("摇一摇");
    await reveal(); await click("记住啦");
    await save("豆豆");
  }
  if (!(await state()).story.includes("flower")) {
    await travel("flowers");
    await talk("花娘");
    await click("聊聊花婆婆托的花");
    await click("带一枝淡粉海棠");
    await click("记住啦");
    await save("鲜花");
  }
  if (!(await state()).story.includes("ribbon")) {
    await travel("bridge");
    await page.keyboard.press("KeyE");
    await page.waitForFunction(() => window.__journey.story.includes("ribbon"));
    await save("虹桥");
  }
  if (!(await state()).story.includes("gift")) {
    await travel("granny");
    await talk("花婆婆");
    await click("把带来的花交给婆婆");
    await reveal(); await click("记住啦");
    await save("花婆婆");
  }
  const replay = await state();
  assert.ok(["invited", "drum", "ribbon", "gift"].every(flag => replay.story.includes(flag)));
  const saved = JSON.parse(await readFile(checkpointFile, "utf8"));
  assert.ok(saved.save);
  console.log("Replay checkpoint ready: four story goals completed");
  await context.close();

  context = await browser.newContext({
    viewport: { width: 1120, height: 720 },
    deviceScaleFactor: 0.7,
    recordVideo: { dir: output.pathname, size: { width: 1120, height: 720 } },
  });
  await context.addInitScript(save => localStorage.setItem("bianhe-spring-journey-v1", save), saved.save);
  page = await context.newPage();
  video = page.video();
  page.setDefaultTimeout(120000);
  page.on("pageerror", error => report.errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") report.errors.push(message.text()); });
  started = Date.now();
  await ready();
  await click("继续我的春游");
  mark("花婆婆告别后，再次过虹桥");
  await travel("bridge");
  await hold(1800);
  mark("走下虹桥，前往汴河渡口");
  await travel("harbor");
  await talk("沈船娘");
  await click("付12文，坐船游览");
  await page.waitForFunction(() => window.__journey.cruise?.progress > 0.2, null, { timeout: 180000 });
  mark("乘篷船看汴河，吟诗记游");
  await hold(2800);
  await page.keyboard.press("KeyE");
  await reveal();
  await click("我和豆豆把小鼓摇响了。");
  await reveal(); await click("结束交谈");
  await hold(2300);
  await click("提前返航");
  await page.waitForFunction(() => window.__journey.rides === 1 && !window.__journey.cruise, null, { timeout: 180000 });
  mark("放飞纸鸢，完成春日游会");
  await click("牵住线，开始放飞");
  await hold(1000); await click("帮我慢慢放线");
  await page.waitForFunction(() => window.__journey.completed, null, { timeout: 180000 });
  await hold(4000);
  mark("结束");
  report.final = { completed: (await state()).completed, rides: (await state()).rides, poems: (await state()).poems };
  assert.ok(report.final.completed && report.final.rides === 1 && report.final.poems.length);
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.failure = String(error.stack);
  await page?.screenshot({ path: new URL("tail-failure.png", output).pathname, timeout: 120000 }).catch(() => {});
  throw error;
} finally {
  if (context) await context.close().catch(() => {});
  if (video) await video.saveAs(new URL("game-tail-raw.webm", output).pathname).catch(() => {});
  await writeFile(new URL("game-tail-session.json", output), JSON.stringify(report, null, 2));
  await browser.close().catch(() => {});
}
