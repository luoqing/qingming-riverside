import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

const kind = process.argv[2];
if (!["panorama", "game"].includes(kind)) throw new Error("Use panorama or game");
const root = new URL("../", import.meta.url);
const output = new URL("recordings/showcase/", root);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_EXECUTABLE_PATH,
  ignoreDefaultArgs: ["--disable-dev-shm-usage"],
  args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const context = await browser.newContext({
  viewport: kind === "panorama" ? { width: 960, height: 620 } : { width: 1120, height: 720 },
  deviceScaleFactor: kind === "panorama" ? 0.55 : 0.85,
  recordVideo: { dir: output.pathname, size: kind === "panorama" ? { width: 960, height: 620 } : { width: 1120, height: 720 } },
});
const page = await context.newPage();
const video = page.video();
page.setDefaultTimeout(120000);
const started = Date.now();
const report = { kind, source: "real browser video; native UI actions; no game-state injection", chapters: [], errors: [] };
page.on("pageerror", error => report.errors.push(error.message));
page.on("console", message => { if (message.type() === "error") report.errors.push(message.text()); });
const mark = title => {
  const seconds = (Date.now() - started) / 1000;
  report.chapters.push({ title, seconds });
  console.log(`${kind} ${seconds.toFixed(1)}s ${title}`);
};
const hold = ms => page.waitForTimeout(ms);
async function waitFrames(count) {
  const previous = await page.evaluate(() => window.__qingming.frames);
  await page.waitForFunction(target => window.__qingming.frames >= target, previous + count, { timeout: 180000 });
}
const state = () => page.evaluate(() => window.__journey);
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
    await hold(500);
    await next.click();
  }
}
async function travel(id) {
  for (let attempt = 0; attempt < 12; attempt++) {
    await page.keyboard.press("KeyM");
    await page.getByRole("combobox", { name: "在导览图上找地点" }).selectOption(id);
    await click("辅助带我走");
    let previous = (await state()).position, still = 0;
    for (let i = 0; i < 30; i++) {
      await hold(10000);
      const current = await state();
      if (!current.route.length && current.near === id) { await hold(800); return; }
      const distance = Math.hypot(current.position.x - previous.x, current.position.z - previous.z);
      still = distance < 0.18 ? still + 1 : 0;
      previous = current.position;
      if (still >= 2 || !current.route.length) break;
    }
    const before = (await state()).position;
    for (const key of ["KeyD", "KeyA", "KeyS", "KeyW"]) {
      await page.keyboard.down(key);
      await hold(1300);
      await page.keyboard.up(key);
      const after = (await state()).position;
      if (Math.hypot(after.x - before.x, after.z - before.z) > 0.4) break;
    }
    console.log(`reroute ${id} after crowd blockage, attempt ${attempt + 1}`);
  }
  throw new Error(`Could not walk to ${id} after real-keyboard detours`);
}
async function talk(owner) {
  await page.keyboard.press("KeyE");
  await page.getByRole("region", { name: `与${owner}交谈`, exact: true }).waitFor();
  await hold(1200);
  await reveal();
}
async function leave() {
  await click("结束交谈");
  await hold(700);
}
async function browse(owner, id, item) {
  mark(`逛${owner}的摊位`);
  await travel(id);
  await talk(owner);
  await click("看看摊上的货");
  await reveal();
  if (item) {
    await click(item);
    await reveal();
  }
  await hold(1700);
  await leave();
}
try {
  await page.goto(new URL("index.html", root).href, { waitUntil: "domcontentloaded", timeout: 240000 });
  await page.waitForFunction(() => window.__qingming?.frames >= 3 && window.__journey?.heroModel.loaded.length === 2, null, { timeout: 300000 });
  if (kind === "panorama") {
    if (await page.getByRole("button", { name: "先看全卷", exact: true }).isVisible()) await click("先看全卷");
    await page.waitForFunction(() => document.querySelector(".j-intro")?.hidden);
    await waitFrames(4);
    mark("汴河全卷：流动的人群和篷船");
    await waitFrames(4);
    await click("虹桥");
    await page.waitForFunction(() => window.__qingming.selectedView === "bridge");
    await waitFrames(5);
    mark("虹桥：桥上桥下的春日街景");
    await waitFrames(4);
    await click("河埠");
    await page.waitForFunction(() => window.__qingming.selectedView === "harbor");
    await waitFrames(5);
    mark("河埠：沿岸街市与行船");
    await waitFrames(4);
    await click("城阙");
    await page.waitForFunction(() => window.__qingming.selectedView === "gate");
    await waitFrames(5);
    mark("城阙：城门与古塔");
    await waitFrames(4);
    await click("全卷");
    await waitFrames(5);
    await click("开启自动环游");
    mark("环游全景：从不同角度看汴京");
    await waitFrames(8);
    await click("关闭自动环游");
    mark("结束");
    report.final = await page.evaluate(() => ({ frames: window.__qingming.frames, people: window.__qingming.people.length, boats: window.__qingming.boats.length }));
    assert.ok(report.final.people > 100 && report.final.boats > 5);
  } else {
    mark("选择主角，走进汴京");
    await page.locator(".j-intro").getByRole("button", { name: "小女孩", exact: true }).click();
    await click("带上120文，出发");
    await hold(1800);
    mark("遇见阿芽，解开纸鸢线");
    await talk("阿芽");
    await click("我来帮你绕开线");
    await reveal();
    await click("我想自己探索");
    await page.waitForFunction(() => !window.__journey.dialogue);
    assert.ok((await state()).story.includes("invited"));
    await browse("阿杏", "cakes");
    await browse("陆翁", "tea");
    mark("玩具摊：问价、还价，买拨浪鼓");
    await travel("toys");
    await talk("周货郎");
    await click("看看摊上的货"); await reveal();
    await click("问问这件多少钱"); await reveal();
    await click("便宜一点可以吗"); await reveal();
    await hold(1200);
    await click("确认购买"); await reveal();
    assert.ok((await state()).inventory.rattle > 0);
    await leave();
    mark("找到豆豆，一起摇拨浪鼓");
    await travel("doudou");
    await talk("豆豆");
    await click("找安静的地方练");
    for (let i = 0; i < 3; i++) { await hold(700); await click("摇一摇"); }
    assert.ok((await state()).story.includes("drum"));
    await reveal(); await click("记住啦");
    mark("花摊：为花婆婆带一枝海棠");
    await travel("flowers");
    await talk("花娘");
    await click("聊聊花婆婆托的花");
    await click("带一枝淡粉海棠");
    await hold(1000); await click("记住啦");
    assert.equal((await state()).inventory.begonia, 1);
    mark("登上虹桥，看风和汴河");
    await travel("bridge");
    await page.keyboard.press("KeyE");
    await page.waitForFunction(() => window.__journey.story.includes("ribbon"));
    await hold(2700);
    mark("与花婆婆交谈，把花送给她");
    await travel("granny");
    await talk("花婆婆");
    await click("把带来的花交给婆婆");
    await hold(1700); await reveal(); await click("记住啦");
    assert.ok((await state()).story.includes("gift"));
    mark("逛城门，沿另一侧再走上虹桥");
    await travel("gate");
    await hold(1800);
    await travel("bridge");
    await hold(1800);
    mark("走下虹桥，去渡口坐船");
    await travel("harbor");
    await talk("沈船娘");
    await click("付12文，坐船游览");
    await page.waitForFunction(() => window.__journey.cruise?.progress > 0.2, null, { timeout: 180000 });
    mark("坐篷船穿过虹桥，吟诗记游");
    await hold(2200);
    await page.keyboard.press("KeyE");
    await reveal();
    await click("我和豆豆把小鼓摇响了。");
    await reveal(); await leave();
    await hold(2700);
    await click("提前返航");
    await page.waitForFunction(() => window.__journey.rides === 1 && !window.__journey.cruise, null, { timeout: 180000 });
    mark("归岸放飞纸鸢，完成春日游会");
    await click("牵住线，开始放飞");
    await hold(1200); await click("帮我慢慢放线");
    await page.waitForFunction(() => window.__journey.completed, null, { timeout: 180000 });
    await hold(3600);
    mark("结束");
    report.final = { completed: (await state()).completed, visited: (await state()).visited, money: (await state()).money };
    assert.ok(report.final.completed);
  }
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.failure = String(error.stack);
  await page.screenshot({ path: new URL(`${kind}-failure.png`, output).pathname, timeout: 120000 }).catch(() => {});
  throw error;
} finally {
  await context.close().catch(() => {});
  await video.saveAs(new URL(`${kind}-raw.webm`, output).pathname).catch(() => {});
  await writeFile(new URL(`${kind}-session.json`, output), JSON.stringify(report, null, 2));
  await browser.close().catch(() => {});
}
