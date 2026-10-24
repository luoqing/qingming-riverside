import {chromium} from "playwright";
import {writeFile} from "node:fs/promises";
const root=new URL("../",import.meta.url), report={kind:"read-only real crowd diagnosis",errors:[],runs:[]};
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,
 ignoreDefaultArgs:["--disable-dev-shm-usage"],args:["--no-sandbox","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
const read=page=>page.evaluate(()=>({time:window.__qingming.elapsed,frames:window.__qingming.frames,
 actors:window.__qingming.pedestrians,active:window.__journey.active}));
function summarize(samples){
 const seconds=samples.at(-1).time-samples[0].time;
 const actors=samples[0].actors.map((first,i)=>{
  let travel=0,reversals=0,previous=null,moving=0;
  for(let j=1;j<samples.length;j++){
   const a=samples[j-1].actors[i],b=samples[j].actors[i],dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz);
   travel+=d;if(b.moving)moving++;
   if(d>.001 && previous && (dx*previous.x+dz*previous.z)/d/previous.length<-.5)reversals++;
   if(d>.001)previous={x:dx,z:dz,length:d};
  }
  const last=samples.at(-1).actors[i],net=Math.hypot(last.x-first.x,last.z-first.z);
  return {i,group:first.type,net,travel,
   speed:travel/seconds,reversals,movingFraction:moving/(samples.length-1),start:first,end:last};
 });
 const groups={};for(const group of ["bridge","bank","market","rear"]){
  const members=actors.filter(a=>a.group===group);
  groups[group]={count:members.length,stationary:members.filter(a=>a.travel<.05).length,
   verySlow:members.filter(a=>a.speed<.05).length,jitter:members.filter(a=>a.travel>.1 && a.net<a.travel*.2).length,
   overOneMeter:members.filter(a=>a.net>1).length,meanTravel:members.reduce((s,a)=>s+a.travel,0)/members.length,
   meanNet:members.reduce((s,a)=>s+a.net,0)/members.length,
   meanSpeed:members.reduce((s,a)=>s+a.speed,0)/members.length};
 }
 return {seconds,frames:samples.at(-1).frames-samples[0].frames,groups,actors};
}
try{
 const page=await browser.newPage({viewport:{width:960,height:600},deviceScaleFactor:.6});page.setDefaultTimeout(180000);
 page.on("pageerror",e=>report.errors.push(e.message));
 await page.goto(new URL("index.html",root).href,{waitUntil:"domcontentloaded",timeout:240000});
 await page.waitForFunction(()=>window.__qingming?.frames>1 && window.__journey?.heroModel.loaded.length===2,null,{timeout:240000});
 for(const mode of ["overview","game"]){
  if(mode==="game")await page.getByRole("button",{name:"带上120文，出发",exact:true}).click({force:true});
  const samples=[await read(page)];
  while(samples.at(-1).time-samples[0].time<20){await page.waitForTimeout(150);samples.push(await read(page));}
  const result=summarize(samples);report.runs.push({mode,...result,samples});
  console.log(mode,JSON.stringify({seconds:result.seconds,frames:result.frames,groups:result.groups}));
  await page.screenshot({path:new URL(`crowd-diagnosis-${mode}.png`,root).pathname,timeout:180000});
 }
}finally{
 await browser.close();await writeFile(new URL("crowd-diagnosis.json",root),JSON.stringify(report,null,2));
}
