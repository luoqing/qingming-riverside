import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createCrowdPaths } from "../src/crowd.js";
import { isBlocked, clearSegment } from "../src/walk.js";
const obstacles = JSON.parse(
  readFileSync(new URL("world-obstacles.json", import.meta.url), "utf8"),
);
const paths = createCrowdPaths(obstacles);
assert.equal(paths.bank[-1].length, 2);
assert.equal(paths.bank[1].length, 2);
assert.equal(paths.bridge.length, 3);
assert.equal(paths.rear.length, 1);
assert.equal(paths.market.length, 3);
let count = 0;
for (const path of [
  ...paths.bank[-1],
  ...paths.bank[1],
  ...paths.bridge,
  ...paths.rear,
  ...paths.market,
]) {
  let previous = path.sample(0);
  for (let d = 0.04; d <= path.length * 4; d += 0.04) {
    const p = path.sample(d);
    assert.equal(isBlocked(p.x, p.z, obstacles), false);
    assert.ok(clearSegment(previous, p, obstacles));
    previous = p;
    count++;
  }
}
console.log(
  `PASS: eleven real-world crowd paths including the market, ${count} forward/reverse samples avoid all ${obstacles.length} solid props, water and bridge rails`,
);
