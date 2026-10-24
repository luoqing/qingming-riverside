import assert from "node:assert/strict";
import {readFileSync,writeFileSync} from "node:fs";
import {createCrowdPaths,createCrowdMotion} from "../src/crowd.js";
import {isBlocked} from "../src/walk.js";
const fixture=JSON.parse(readFileSync(new URL("../diagnostics/crowd-input-current.json",import.meta.url)));
const paths=createCrowdPaths(fixture.obstacles,fixture.fixed);
const actors=fixture.actors.map((raw,i)=>{
 const pool=raw.type==="bridge" ? paths.bridge : raw.type==="bank" ? paths.bank[raw.side] : raw.type==="rear" ? paths.rear : paths.market;
 const path=raw.type==="market" && i%10===0 ? null : pool[i%pool.length];
 return {...raw,path,progress:path ? raw.t*path.length*2 : 0};
});
const advance=createCrowdMotion(actors,fixture.obstacles,fixture.fixed);
const start=actors.map(a=>({x:a.x,z:a.z}));
const stats=actors.map(()=>({travel:0,maxDisplacement:0,stopped:0,turns:0}));
const dt=Number(process.env.CROWD_DT || .05),windowFrames=Math.round(30/dt),frames=windowFrames*(process.env.CROWD_LONG ? 3 : 1),started=performance.now();let minimum=Infinity;
let windowStart=actors.map(a=>({x:a.x,z:a.z})), windowMax=actors.map(()=>0);
const windows=[];
for(let frame=0;frame<frames;frame++){
 const before=actors.map(a=>({x:a.x,z:a.z,yaw:a.yaw,walkClock:a.walkClock}));
 advance(dt);
 actors.forEach((a,i)=>{
  const d=Math.hypot(a.x-before[i].x,a.z-before[i].z),s=stats[i];
  assert.ok(d<=Math.abs(a.speed)*32*dt+1e-7,"Walking recovery must not teleport a body");
  assert.ok(Math.abs(a.yaw-before[i].yaw)<=3*dt+1e-7,"Turning must remain smooth");
  if(!a.moving)assert.equal(a.walkClock,before[i].walkClock,"Blocked people must not march on the spot");
  s.travel+=d;s.maxDisplacement=Math.max(s.maxDisplacement,Math.hypot(a.x-start[i].x,a.z-start[i].z));
  windowMax[i]=Math.max(windowMax[i],Math.hypot(a.x-windowStart[i].x,a.z-windowStart[i].z));
  if(d<.002)s.stopped++;
  if(frame%10===0)assert.equal(isBlocked(a.x,a.z,fixture.obstacles,a.radius),false,`Actor ${i} enters a solid prop`);
  if(frame%5===0)for(let j=0;j<i;j++){
   const b=actors[j];if(Math.abs(a.y-b.y)>1)continue;
   const gap=Math.hypot(a.x-b.x,a.z-b.z)-a.radius-b.radius;
   minimum=Math.min(minimum,gap);assert.ok(gap>=-1e-6,`Bodies ${i}/${j} overlap at frame ${frame}`);
  }
 });
 if((frame+1)%windowFrames===0){
  const summary={};for(const type of ["bridge","bank","market","rear"]){
   const indices=actors.map((a,i)=>a.path&&a.type===type?i:-1).filter(i=>i>=0);
   summary[type]={count:indices.length,active:indices.filter(i=>windowMax[i]>1.5).length};
  }
  windows.push(summary);windowStart=actors.map(a=>({x:a.x,z:a.z}));windowMax.fill(0);
 }
}
const walkers=actors.map((a,i)=>({...stats[i],i,type:a.type,hasPath:!!a.path,
 position:{x:a.x,z:a.z},progress:a.progress,stuck:a.stuck,
 target:a.path?.sampleLoop(a.progress+.7)})).filter(a=>a.hasPath);
const groups={};for(const type of ["bridge","bank","market","rear"]){
 const group=walkers.filter(a=>a.type===type);
 groups[type]={count:group.length,active:group.filter(a=>a.maxDisplacement>1.5).length,
  mostlyStopped:group.filter(a=>a.stopped/frames>.8).length};
}
const result={groups,windows,minimum,computeMs:performance.now()-started,walkers};
writeFileSync(new URL(process.env.CROWD_LONG ? "../diagnostics/crowd-liveliness-long.json" : "../diagnostics/crowd-liveliness.json",import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify({groups,windows,minimum,computeMs:result.computeMs}));
for(const [type,g] of Object.entries(groups))assert.ok(g.active/g.count>=.9,`${type}: at least 90% of walkers must travel visibly, not just shuffle`);
for(const [i,window] of windows.entries())for(const [type,g] of Object.entries(window))assert.ok(g.active/g.count>=.9,`${type}: crowd gradually jams in 30-second window ${i}`);
assert.ok(walkers.filter(a=>a.stopped/frames>.8).length/walkers.length<.08,"No persistent crowd standstill");
console.log("PASS: actual town crowd continuously walks through all four districts without body or prop overlaps");
