import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  newJourney,
  restoreJourney,
  talk,
  buy,
  priceFor,
  useFood,
  visit,
} from "../src/travel-state.js";
import {
  storyAction,
  has,
  hasRattle,
  flowerInBag,
  storyReady,
  finishStory,
  FRIENDS,
} from "../src/story.js";
import { VENDORS, SIGHTS, HARBOR } from "../src/travel-data.js";
import {
  findRoute,
  moveOnLand,
  isBlocked,
  walkSurface,
  canStep,
  clearSegment,
} from "../src/walk.js";
const state = newJourney(),
  toys = VENDORS.find((v) => v.id === "toys");
assert.equal(state.money, 120);
assert.equal(state.learnedMovement,false);
assert.equal(restoreJourney({version:1,learnedMovement:true}).learnedMovement,true);
assert.equal(restoreJourney({version:1,learnedMovement:"yes"}).learnedMovement,false);
assert.equal(restoreJourney({version:1,story:["invited"]}).learnedMovement,true);
for (const question of [
  "拨浪鼓多少钱",
  "买拨浪鼓要多少钱",
  "不想买拨浪鼓",
  "我要买拨浪鼓",
]) {
  talk(state, "toys", question, "rattle");
  assert.equal(state.money, 120, "conversation never charges");
}
assert.equal(talk(state, "toys", "我要买拨浪鼓", "rattle").offer, "rattle");
assert.equal(talk(state, "toys", "来两面拨浪鼓", "rattle").quantity, 2);
assert.equal(state.money, 120);
talk(state, "toys", "可以便宜点吗", "rattle");
assert.equal(priceFor(state, toys, toys.items[0]), 10);
talk(state, "toys", "再便宜一点", "rattle");
assert.equal(priceFor(state, toys, toys.items[0]), 10);
assert.ok(buy(state, "toys", "rattle", 2).ok);
assert.equal(state.money, 100);
assert.equal(state.inventory.rattle, 2);
for (const count of [-1, 0, 1.5, NaN, 6])
  assert.equal(buy(state, "toys", "rattle", count).ok, false);
assert.equal(buy(state, "toys", "begonia").ok, false);
state.money = 0;
assert.equal(buy(state, "toys", "kite").ok, false);
assert.equal(state.money, 0);
const free = newJourney();
free.money = 0;
storyAction(free, "invite");
storyAction(free, "loan");
storyAction(free, "loan");
assert.equal(free.inventory.rattle, 1);
storyAction(free, "drum");
storyAction(free, "peony");
storyAction(free, "flower");
assert.equal(free.inventory.peony, 1);
assert.equal(free.inventory.begonia, undefined);
assert.ok(storyAction(free, "gift").text.includes("牡丹"));
assert.equal(free.flowerChoice, "peony");
assert.equal(free.inventory.peony, undefined);
const reward = free.money;
storyAction(free, "gift");
assert.equal(free.money, reward, "gift reward once");
storyAction(free, "ribbon");
assert.ok(storyReady(free));
assert.equal(finishStory(free), false);
free.rides = 1;
free.poems = ["我和豆豆把小鼓摇响了。"];
assert.equal(finishStory(free), true);
assert.equal(finishStory(free), false);
const noDrum = newJourney();
storyAction(noDrum, "drum");
assert.equal(has(noDrum, "drum"), false);
assert.equal(hasRattle(noDrum), false);
assert.ok(storyAction(noDrum, "doudou-loan").text.startsWith("豆豆："));
assert.equal(hasRattle(noDrum), true);
assert.equal(noDrum.inventory.rattle, 1, "豆豆只借一面练习鼓");
storyAction(noDrum, "doudou-loan");
assert.equal(noDrum.inventory.rattle, 1, "再次交谈不会重复领取");
const noFlower = newJourney();
assert.equal(flowerInBag(noFlower), undefined);
noFlower.inventory.peony = 1;
noFlower.flowerChoice = "peony";
assert.equal(flowerInBag(noFlower), "peony");
const restored = restoreJourney(JSON.parse(JSON.stringify(free)));
assert.deepEqual(restored.inventory, free.inventory);
assert.deepEqual(restored.story, free.story);
assert.equal(restored.flowerChoice, "peony");
assert.equal(restoreJourney({ version: 99, money: -1 }).money, 120);
assert.equal(restoreJourney({ version: 1, money: -1 }).money, 120);
assert.deepEqual(
  restoreJourney({
    version: 1,
    inventory: { constructor: 4, unknown: 3, rattle: -1 },
  }).inventory,
  {},
);
buy(state, "cakes", "sesame-cake");
assert.equal(useFood(state, "sesame-cake"), null);
state.money = 12;
assert.ok(buy(state, "cakes", "sesame-cake").ok);
assert.equal(useFood(state, "sesame-cake").energy, 20);
assert.equal(useFood(state, "sesame-cake"), null);
assert.equal(visit(state, "bridge"), true);
assert.equal(visit(state, "bridge"), false);
assert.equal(visit(state, "unknown"), false);
assert.equal(walkSurface(15, 0), null);
assert.ok(walkSurface(-5, 0) > 4.8);
assert.equal(canStep(-6.6, 0, -6.9, 0, []), false, "bridge rail");
const obstacles = JSON.parse(
  readFileSync(new URL("world-obstacles.json", import.meta.url), "utf8"),
);
const destinations = [
  ...FRIENDS.map((f) => ({ ...f, z: f.z + 0.9 })),
  ...VENDORS.map((v) => ({ ...v, z: v.z + v.d / 2 + 0.6 })),
  ...SIGHTS,
  HARBOR,
];
for (const a of destinations)
  for (const b of destinations) {
    const position = { x: a.x, z: a.z, y: 0.5 };
    assert.equal(isBlocked(a.x, a.z, obstacles), false, a.id);
    const route = findRoute(position, b, obstacles);
    assert.ok(route, `${a.id} reaches ${b.id}`);
    for (const waypoint of route)
      assert.equal(
        moveOnLand(
          position,
          waypoint.x - position.x,
          waypoint.z - position.z,
          obstacles,
        ),
        false,
        `${a.id} to ${b.id} without collisions`,
      );
    assert.ok(Math.hypot(position.x - b.x, position.z - b.z) < 0.001);
  }
const edge = { x: -15, y: 0.5, z: 7 };
moveOnLand(edge, 0, -20, obstacles);
assert.ok(walkSurface(edge.x, edge.z) !== null, "cannot walk into river");
const movedProp = [{ kind: "circle", x: -20, z: 12, radius: 0.5 }];
findRoute({ x: -22, z: 10 }, { x: -18, z: 10 }, movedProp);
movedProp[0].z = 10;
let last = { x: -22, z: 10 };
for (const p of findRoute(last, { x: -18, z: 10 }, movedProp)) {
  assert.ok(
    clearSegment(last, p, movedProp),
    "moved props invalidate cached navigation edges",
  );
  last = p;
}
console.log(
  "PASS: prices, confirmation, bargaining, inventory, free story, choices, one-time rewards, save validation, 225 world routes, water and rail collisions",
);
