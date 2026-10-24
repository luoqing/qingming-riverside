import assert from "node:assert/strict";
import {legGait} from "../src/gait.js";
let maxKnee=0, minKnee=Infinity;
let maxWalkHip=0, maxWalkKnee=0;
for(let i=0;i<=240;i++) {
 const phase=i/240*Math.PI*2,a=legGait(phase,true),b=legGait(phase+Math.PI,true);
 const walk=legGait(phase,false);
 assert.ok(a.knee<0,"Knees fold backwards, not into reverse joints");
 assert.ok(Math.abs(a.hip+b.hip)<1e-10,"Legs alternate");
 assert.ok(Number.isFinite(a.ankle));
 maxKnee=Math.max(maxKnee,-a.knee);minKnee=Math.min(minKnee,-a.knee);
 maxWalkHip=Math.max(maxWalkHip,Math.abs(walk.hip));
 maxWalkKnee=Math.max(maxWalkKnee,-walk.knee);
}
assert.ok(maxKnee>1.4 && maxKnee<1.55,"Recovery leg should visibly fold 80+ degrees");
assert.ok(minKnee>=.19,"Stance knee should not lock straight");
assert.ok(Math.abs(legGait(Math.PI*1.5,true).knee)>Math.abs(legGait(Math.PI*1.5,false).knee)*2);
assert.ok(maxWalkHip>.5 && maxWalkKnee>.7,"Walking must visibly lift thighs and flex knees rather than slide");
console.log(`PASS: visible walking gait (${(maxWalkHip*180/Math.PI).toFixed(1)}° hip, ${(maxWalkKnee*180/Math.PI).toFixed(1)}° knee); running knee flexion ${(minKnee*180/Math.PI).toFixed(1)}–${(maxKnee*180/Math.PI).toFixed(1)} degrees`);
