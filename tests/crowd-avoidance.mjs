import assert from "node:assert/strict";
import { createCrowdMotion, makeWalkPath } from "../src/crowd.js";
import { isBlocked } from "../src/walk.js";
const path = makeWalkPath({x:-15,z:13},{x:-5,z:13},[]);
const actors = Array.from({length:16}, (_,i) => ({
  path, progress:i*path.length*2/16, scale:i%3 ? 1 : 0.65, speed:0.032,
  phase:i, x:-15,z:13,
}));
const advance = createCrowdMotion(actors, []);
const before = actors.map(a => [a.x,a.z]);
let sidesteps=0, minimum=Infinity;
for (let frame=0;frame<1600;frame++) {
  advance(frame%30===0 ? 0.7 : 0.05);
  for (let i=0;i<actors.length;i++) {
    const a=actors[i];
    assert.equal(isBlocked(a.x,a.z,[],a.radius),false);
    if (Math.abs(a.z-13)>0.15) sidesteps++;
    for (let j=0;j<i;j++) {
      const b=actors[j], clearance=Math.hypot(a.x-b.x,a.z-b.z)-a.radius-b.radius;
      minimum=Math.min(minimum,clearance);
      assert.ok(clearance>=-1e-7, `bodies overlap at ${frame}: ${i}/${j}`);
    }
  }
}
assert.ok(sidesteps>30,"Pedestrians must turn aside, not just freeze");
assert.ok(actors.filter((a,i)=>Math.hypot(a.x-before[i][0],a.z-before[i][1])>1).length>8);
console.log("PASS: 16 opposing adults/children, 1600 frames including long frames, actual sidesteps and no body overlaps; minimum gap",minimum);

// Rendering slowly must not starve recovery or change the walking simulation.
function atRate(dt,frames) {
 const group=Array.from({length:16},(_,i)=>({path,progress:i*path.length*2/16,
  scale:i%3 ? 1 : .65,speed:.032,phase:i,x:-15,z:13}));
 const move=createCrowdMotion(group,[]);
 for(let i=0;i<frames;i++)move(dt);
 return group;
}
const normal=atRate(.05,280),slow=atRate(.7,20),fast=atRate(1/60,840);
normal.forEach((a,i)=>{
 for(const key of ["x","z","yaw","progress","walkClock"]) {
  assert.ok(Math.abs(a[key]-slow[i][key])<1e-8,`Slow-frame-dependent crowd ${i}/${key}`);
  assert.ok(Math.abs(a[key]-fast[i][key])<1e-8,`Fast-frame-dependent crowd ${i}/${key}`);
 }
});
console.log("PASS: 14 seconds of crowd simulation produces identical motion at 60fps, 0.05s and 0.7s render intervals");
