import assert from "node:assert/strict";
import {
  wrap01,
  boatPose,
  riverCenter,
  riverWidth,
  bridgeHeight,
} from "../src/paths.js";
for (const speed of [-0.035, -0.018, 0.018, 0.035])
  for (const phase of [0, 0.1, 0.5, 0.99])
    for (let t = 0; t <= 86400; t += 13) {
      const u = wrap01(phase + t * speed * 0.16);
      assert.ok(u >= 0 && u < 1);
    }
for (const b of [
  { x: -30, lane: 1.7, length: 6.8, speed: 0.24 },
  { x: -19, lane: -1.7, length: 6.3, speed: -0.18 },
  { x: 13, lane: 0.75, length: 7.6, speed: 0.21 },
  { x: 32, lane: -0.9, length: 5.4, speed: -0.16 },
  { x: -35, lane: -1.1, length: 6.2, speed: 0.14 },
])
  for (let t = 0; t <= 86400; t += 17) {
    const p = boatPose(b, t);
    assert.ok(Math.abs(p.x) + b.length / 2 <= 38.000001);
    assert.ok(Math.abs(p.z - riverCenter(p.x)) + 1 < riverWidth(p.x));
    assert.ok(Number.isFinite(p.yaw));
  }
assert.equal(bridgeHeight(0), 4.83);
assert.ok(Math.abs(bridgeHeight(7.7) - 0.68) < 1e-8);
console.log(
  "PASS: signed progress wraps safely; five boat paths remain in bounds for 24 simulated hours",
);
