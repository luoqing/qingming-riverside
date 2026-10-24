import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHumanModel,twoBoneJoint} from '../src/people.js';
import {boatPose,BOAT_SPEED_MULTIPLIER} from '../src/paths.js';
const human=createHumanModel();
for(const [name,{geometry}] of Object.entries(human.specs)){
 for(const attribute of Object.values(geometry.attributes))assert.ok(Array.from(attribute.array).every(Number.isFinite),`${name} finite geometry`);
 geometry.computeBoundingBox();assert.ok(!geometry.boundingBox.isEmpty(),`${name} has volume`);
}
for(const config of [{walking:true},{walking:true,running:true,age:'child'},{walking:false,carrying:true},{rower:true},{holdingToy:true},{seated:true},{gender:'female',age:'child',eating:true},{gender:'female',age:'elder'},{age:'elder',walking:true}])for(let t=0;t<9;t+=.12){
 const matrices={};human.pose(t,{...config,phase:.7,hat:true},(name,matrix)=>matrices[name]=matrix.clone());
 for(const m of Object.values(matrices))assert.ok(m.elements.every(Number.isFinite));
 for(const side of ['L','R']){
  const lo=new THREE.Vector3(0,-.5,0).applyMatrix4(matrices[`upperArm${side}`]);
  const hi=new THREE.Vector3(0,.5,0).applyMatrix4(matrices[`forearm${side}`]);
  assert.ok(lo.distanceTo(hi)<1e-6,'elbow connection');
  assert.ok(Math.abs(new THREE.Vector3(0,.5,0).applyMatrix4(matrices[`upperArm${side}`]).distanceTo(lo)-.225)<1e-6,'upper arm length');
  assert.ok(Math.abs(new THREE.Vector3(0,-.5,0).applyMatrix4(matrices[`forearm${side}`]).distanceTo(hi)-.215)<1e-6,'forearm length');
 }
}
const root=new THREE.Vector3(0,.9,0),tip=new THREE.Vector3(.05,.53,.1),elbow=twoBoneJoint(root,tip,.225,.215,new THREE.Vector3(0,0,-1));
assert.ok(Math.abs(root.distanceTo(elbow)-.225)<1e-8);assert.ok(Math.abs(tip.distanceTo(elbow)-.215)<1e-8);
assert.equal(BOAT_SPEED_MULTIPLIER,2.4);
const b={x:0,lane:1,length:6,speed:.2};assert.ok(boatPose(b,1).x>.47&&boatPose(b,1).x<.49);
console.log('PASS: anatomical model, connected elbows, all poses, finite geometry, 2.4x boat speed');
