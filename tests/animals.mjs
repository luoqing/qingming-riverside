import assert from "node:assert/strict";
import {camelBodies,canMoveCamel} from "../src/animals.js";
import {moveOnLand,isBlocked} from "../src/walk.js";
import {makeWalkPath,createCrowdMotion} from "../src/crowd.js";
const camel={x:-10,z:13},bodies=camelBodies(camel);
for(const [x,z,dx,dz] of [[-8,13,-4,0],[-13,13,5,0],[-9.62,15,0,-4]]){
 const p={x,z,y:.5};moveOnLand(p,dx,dz,bodies);
 assert.equal(isBlocked(p.x,p.z,bodies),false,"Player must stop outside the camel");
 if(dx<0)assert.ok(p.x>camel.x+.9);
 else if(dx>0)assert.ok(p.x<camel.x-1.42);
 else assert.ok(p.z>camel.z+.52);
}
assert.equal(canMoveCamel(camel,{x:-8,z:13},[{x:-8,z:13,y:.5,radius:.24}]),false,"Moving camel must not push through a person");
assert.equal(canMoveCamel(camel,{x:-10.2,z:13},[]),true);
const path=makeWalkPath({x:-15,z:13},{x:-5,z:13},[]);
const actors=Array.from({length:16},(_,i)=>({path,progress:i*path.length*2/16,
 scale:i%3?1:.65,speed:.032,phase:i,x:-15,z:13}));
const advance=createCrowdMotion(actors,[],bodies);let minimum=Infinity;
for(let frame=0;frame<500;frame++){
 advance(.05,camelBodies(camel));
 const next={x:-10+Math.sin(frame*.05*.4)*.5,z:13};
 if(canMoveCamel(camel,next,actors))Object.assign(camel,next);
 for(const a of actors)for(const body of camelBodies(camel)){
  const gap=Math.hypot(a.x-body.x,a.z-body.z)-a.radius-body.radius;
  minimum=Math.min(minimum,gap);assert.ok(gap>=-1e-7,`A passer-by intersects the camel at ${frame}`);
 }
}
console.log("PASS: player cannot cross body/head/panniers; moving camels and 16 walking adults/children never overlap; minimum gap",minimum);
