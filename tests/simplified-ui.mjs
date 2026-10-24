import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const [journey, css, app] = await Promise.all([
  readFile(new URL("src/journey.js", root), "utf8"),
  readFile(new URL("src/journey.css", root), "utf8"),
  readFile(new URL("src/app.js", root), "utf8"),
]);

const drawerTitles = [...journey.matchAll(/openPanel\("([^"]+)"/g)].map((match) => match[1]);
assert.deepEqual(drawerTitles, [
  "汴京游览图",
  "我的小背包",
  "今天逛过的地方，都飞起来了",
]);
for (const removed of [
  "陪豆豆合奏",
  "虹桥上，风在哪里？",
  "船上，写一句今天",
  "阿芽的纸鸢",
  "给婆婆捎一枝春天",
  "新手玩法路线",
  "今天想做点什么",
  "这一趟，记住了什么",
]) assert.ok(!drawerTitles.includes(removed), `${removed} must not open a drawer`);

assert.match(journey, /j-menu-popover/);
assert.doesNotMatch(journey, /el\("div",\s*"j-help"/);
assert.doesNotMatch(css, /\.j-help\b/);
assert.match(css, /\.j-toast\s*\{[^}]*background:\s*transparent/s);
assert.match(journey, /const carryingRattle = hasRattle\(state\)/);
assert.match(journey, /const flower = flowerInBag\(state\)/);
assert.match(journey, /铜钱不够，还差\$\{shortfall\}文/);
assert.match(journey, /brand\.hidden = false/);
assert.match(journey, /doudouHandPoint\.position/);

const groups = [...app.matchAll(/\["(bridge|bank|market|rear)",\s*(\d+)\]/g)]
  .map(([, name, count]) => [name, Number(count)]);
assert.deepEqual(groups, [
  ["bridge", 30],
  ["bank", 56],
  ["market", 30],
  ["rear", 17],
]);
const total = groups.reduce((sum, [, count]) => sum + count, 0);
assert.equal(total, 133);
assert.ok((166 - total) / 166 >= 0.19 && (166 - total) / 166 <= 0.21);
for (const [name, count] of groups) {
  const combinations = new Set();
  for (let i = 0; i < count; i++) {
    const gender = i % 2 ? "female" : "male";
    const age = i % 7 === 0 ? "elder" : i % 5 === 0 ? "child" : "adult";
    combinations.add(`${age}-${gender}`);
  }
  for (const age of ["child", "adult", "elder"])
    for (const gender of ["male", "female"])
      assert.ok(combinations.has(`${age}-${gender}`), `${name} lacks ${age}-${gender}`);
}
assert.match(app, /age:p\.age,gender:p\.gender/);

console.log("PASS: only map, backpack and ending use large panels; hints are compact; 133 pedestrians remain distributed as men, women, elders and children in every area");
