import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { createHeroVisual } from "./hero-model.js";
import { makeToy } from "./toys.js";
const scene=new THREE.Scene();scene.background=new THREE.Color("#eee7d8");
const camera=new THREE.PerspectiveCamera(34,innerWidth/innerHeight,0.05,50);
camera.position.set(1.5,1.05,2.8);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
document.body.prepend(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.65,0);controls.minDistance=1.4;controls.maxDistance=5;controls.maxPolarAngle=Math.PI*.49;controls.update();
scene.add(new THREE.HemisphereLight(0xe9f4ff,0x9a8060,2.3));
const sun=new THREE.DirectionalLight(0xffefd3,3);sun.position.set(-2,4,3);sun.castShadow=true;
sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-2;sun.shadow.camera.right=2;sun.shadow.camera.top=2;sun.shadow.camera.bottom=-2;scene.add(sun);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshStandardMaterial({color:0xeee7d8,roughness:1}));
floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
const actor=new THREE.Group();scene.add(actor);
const visual=createHeroVisual(actor);
const handPoint=new THREE.Group();actor.add(handPoint);
let held=null, gender="female",mode="idle",clock=new THREE.Clock();
for(const button of document.querySelectorAll("[data-prop]")) button.onclick=()=>{
 if(held) {
  actor.remove(held.root);handPoint.remove(held.root);
  held.root.traverse(o=>{o.geometry?.dispose();if(o.material?.userData.toyOwned)o.material.dispose();});
 }
 held=button.dataset.prop ? makeToy(button.dataset.prop) : null;
 if(held) {held.root.scale.setScalar(button.dataset.prop==="rattle" ? .62 : .85);handPoint.add(held.root);}
 document.querySelectorAll("[data-prop]").forEach(b=>b.setAttribute("aria-pressed",String(b===button)));
};
for(const button of document.querySelectorAll("[data-gender]")) button.onclick=()=>{
 gender=button.dataset.gender;document.querySelectorAll("[data-gender]").forEach(b=>b.setAttribute("aria-pressed",String(b===button)));
};
for(const button of document.querySelectorAll("[data-mode]")) button.onclick=()=>{
 mode=button.dataset.mode;document.querySelectorAll("[data-mode]").forEach(b=>b.setAttribute("aria-pressed",String(b===button)));
};
document.querySelector("#back").onclick=()=>{camera.position.set(0,1.1,-2.8);controls.update();};
document.querySelector("#front").onclick=()=>{camera.position.set(0,1.1,2.8);controls.update();};
document.querySelector("#side").onclick=()=>{camera.position.set(2.8,1.1,0);controls.update();};
Object.defineProperty(window,"__characterPreview",{get:()=>({gender,mode,held:held?.root.name,grip:{position:handPoint.position.toArray(),rotation:handPoint.quaternion.toArray()},...visual.status})});
function draw(){requestAnimationFrame(draw);const dt=Math.min(clock.getDelta(),.1);visual.update(dt,gender,{walking:mode!=="idle",running:mode==="run",holdingToy:!!held},handPoint);held?.update(clock.elapsedTime,false);controls.update();renderer.render(scene,camera);}
draw();
addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
