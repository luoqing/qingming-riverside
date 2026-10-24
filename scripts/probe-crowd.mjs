// Diagnostic build only. Does not change src/app.js or the delivered index.html.
import {build} from "esbuild";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {chromium} from "playwright";
import {createCrowdMotion,makeWalkPath} from "../src/crowd.js";
const root=new URL("../",import.meta.url),out=new URL("diagnostics/",root);
await mkdir(out,{recursive:true});
const source=await readFile(new URL("src/app.js",root),"utf8");
const marker='  Object.defineProperty(window, "__qingming", {';
if(!source.includes(marker))throw new Error("Diagnostic insertion point missing");
const probe='  Object.defineProperty(window,"__crowdProbe",{get:()=>({obstacles,fixed:friendBodies,actors:people.map(a=>({x:a.x,y:a.y,z:a.z,yaw:a.yaw,scale:a.scale,speed:a.speed,t:a.t,side:a.side,phase:a.phase,progress:a.progress,walkClock:a.walkClock,type:a.type,age:a.age,gender:a.gender,path:a.path ? {points:a.path.points,length:a.path.length}:null}))})});\n';
const bundle=await build({stdin:{contents:source.replace(marker,probe+marker),resolveDir:new URL("src/",root).pathname,sourcefile:"crowd-probe.js",loader:"js"},bundle:true,minify:true,format:"iife",target:"es2020",loader:{".png":"dataurl",".css":"text",".glb":"dataurl"},write:false});
const shell=await readFile(new URL("src/shell.html",root),"utf8");
await writeFile(new URL("crowd-probe-current.html",out),shell.replace("/* BUNDLED_APP */",()=>bundle.outputFiles[0].text.replace(/<\/script/gi,"<\\/script")));
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,
 ignoreDefaultArgs:["--disable-dev-shm-usage"],args:["--no-sandbox","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
let state;
try{
 const page=await browser.newPage({viewport:{width:640,height:400},deviceScaleFactor:.5});
 await page.goto(new URL("crowd-probe-current.html",out).href,{waitUntil:"domcontentloaded",timeout:240000});
 await page.waitForFunction(()=>window.__crowdProbe?.actors.length===133,null,{timeout:240000});
 state=await page.evaluate(()=>window.__crowdProbe);
 await writeFile(new URL("crowd-input-current.json",out),JSON.stringify(state));
}finally{await browser.close();}
if(process.argv.includes("--capture-only"))process.exit(0);
const corridors=[...state.obstacles,...state.fixed.map(p=>({...p,kind:"circle"}))]
 .map(o=>o.kind==="circle"?{...o,radius:o.radius+.12}:{...o,w:o.w+.24,d:o.d+.24});
const paths=new Map();
function hydrate(data){return data.map(raw=>{
 let path=null;
 if(raw.path){const key=JSON.stringify(raw.path.points);if(!paths.has(key)){
  const p=makeWalkPath(raw.path.points[0],raw.path.points.at(-1),corridors);
  if(!p || JSON.stringify(p.points)!==key)throw new Error("Replay path differs from actual path");
  paths.set(key,p);
 }path=paths.get(key);}
 return {...raw,path};
});}
function run(mode){
 const actors=hydrate(state.actors), before=actors.map(a=>({...a}));
 let advances;
 if(mode==="isolated")advances=actors.map(a=>createCrowdMotion([a],state.obstacles,state.fixed));
 else advances=[createCrowdMotion(actors,state.obstacles,state.fixed)];
 actors.forEach((a,i)=>Object.assign(a,{...before[i],radius:.26*a.scale,moving:false}));
 const measures=actors.map(()=>({travel:0,turns:0,walking:0,previous:null}));
 const seconds=30,dt=.05;
 for(let frame=0;frame<seconds/dt;frame++){
  const prev=actors.map(a=>({x:a.x,z:a.z}));
  for(const advance of advances)advance(dt);
  actors.forEach((a,i)=>{
   const m=measures[i],dx=a.x-prev[i].x,dz=a.z-prev[i].z,d=Math.hypot(dx,dz);
   m.travel+=d;if(a.moving)m.walking++;
   if(d>.0001 && m.previous && (dx*m.previous.x+dz*m.previous.z)/d/m.previous.d<-.5)m.turns++;
   if(d>.0001)m.previous={x:dx,z:dz,d};
  });
 }
 const results=actors.map((a,i)=>{
  const m=measures[i],expected=Math.abs(a.speed)*32*seconds;
  return {i,type:a.type,path:!!a.path,travel:m.travel,net:Math.hypot(a.x-before[i].x,a.z-before[i].z),
   progress:a.progress-before[i].progress,expected,progressRatio:m.travel/expected,
   walking:m.walking/600,reversals:m.turns};
 });
 const groups={};for(const name of ["bridge","bank","market","rear"]){
  const group=results.filter(a=>a.type===name&&a.path);
  groups[name]={walkers:group.length,stalled:group.filter(a=>a.progressRatio<.1).length,
   jitter:group.filter(a=>a.reversals>20).length,
   meanProgressRatio:group.reduce((s,a)=>s+a.progressRatio,0)/group.length,
   meanNet:group.reduce((s,a)=>s+a.net,0)/group.length,
   meanTravel:group.reduce((s,a)=>s+a.travel,0)/group.length};
 }
 console.log(mode,JSON.stringify(groups));return {mode,seconds,groups,actors:results};
}
const results=[run("crowded"),run("isolated")];
await writeFile(new URL("crowd-replay-current.json",out),JSON.stringify(results,null,2));
