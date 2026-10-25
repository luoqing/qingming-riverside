import {chromium} from "playwright";
import assert from "node:assert/strict";
import {mkdir,writeFile} from "node:fs/promises";
const root=new URL("../",import.meta.url),out=new URL("recordings/",root);
await mkdir(new URL("raw/",out),{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,
 ignoreDefaultArgs:["--disable-dev-shm-usage"],args:["--no-sandbox","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
const report={checks:[],errors:[],chapters:[],audio:false,kind:"native browser overview and game crowd recording"};
const context=await browser.newContext({viewport:{width:960,height:640},deviceScaleFactor:.6,
 recordVideo:{dir:new URL("raw/",out).pathname,size:{width:960,height:640}}});
const page=await context.newPage(),video=page.video(),started=Date.now();
page.setDefaultTimeout(240000);page.on("pageerror",e=>report.errors.push(e.message));
page.on("console",m=>{if(m.type()==="error")report.errors.push(m.text());});
const click=name=>page.getByRole("button",{name,exact:true}).click({force:true});
const state=()=>page.evaluate(()=>({...window.__qingming,hidden:document.hidden}));
const mark=title=>{report.chapters.push({title,seconds:(Date.now()-started)/1000});console.log("CHAPTER",title);};
async function sample(label,seconds=6){
 const before=await state(),wall=Date.now();
 console.log("BASELINE",label,JSON.stringify({frames:before.frames,crowdUpdateMs:before.crowdUpdateMs,calls:before.calls,triangles:before.triangles,paused:before.paused}));
 assert.equal(before.pedestrians.length,106);
 assert.equal(before.pedestrians.filter(a=>a.hasPath).length,103);
 for(const type of ["bridge","bank","market","rear"]){
  const local=before.pedestrians.filter(a=>a.type===type);
  assert.ok(local.length>0,`${type}: crowd remains distributed here`);
  for(const age of ["child","adult","elder"])
   for(const gender of ["male","female"])
    assert.ok(local.some(a=>a.age===age&&a.gender===gender),`${type}: lacks ${age}-${gender}`);
 }
 await page.waitForFunction(({start,count})=>window.__qingming.elapsed>=start+count,
  {start:before.elapsed,count:seconds},{timeout:240000});
 const after=await state();
 const walkers=after.pedestrians.map((a,i)=>({a,b:before.pedestrians[i]})).filter(({a})=>a.hasPath);
 const moved=walkers.filter(({a,b})=>Math.hypot(a.x-b.x,a.z-b.z)>.35);
 console.log("MOTION",label,JSON.stringify({moved:moved.length,total:walkers.length,
  seconds:after.elapsed-before.elapsed,frames:after.frames-before.frames,hidden:after.hidden,paused:after.paused}));
 report.lastWorld=after;
 report.lastMotion={label,moving:moved.length,total:walkers.length};
 assert.ok(moved.length/walkers.length>.75,`${label}: actual crowd should move across the scene`);
 assert.ok(moved.every(({a,b})=>a.walkClock>b.walkClock),"Leg gait must advance with actual displacement");
 for(let i=0;i<after.pedestrians.length;i++)for(let j=0;j<i;j++){
  const a=after.pedestrians[i],b=after.pedestrians[j];if(Math.abs(a.y-b.y)>1)continue;
  assert.ok(Math.hypot(a.x-b.x,a.z-b.z)-a.radius-b.radius>=-1e-6,"Actual crowd body overlap");
 }
 const result={label,moving:moved.length,total:walkers.length,simulationSeconds:after.elapsed-before.elapsed,
  wallSeconds:(Date.now()-wall)/1000,frames:after.frames-before.frames,calls:after.calls,triangles:after.triangles};
 report.checks.push(result);console.log("PASS",JSON.stringify(result));
 await page.screenshot({path:new URL(`crowd-${label}.png`,root).pathname,timeout:180000});
}
try{
 await page.goto(new URL("index.html",root).href,{waitUntil:"domcontentloaded",timeout:240000});
 await page.waitForFunction(()=>window.__qingming?.frames>1 && window.__journey?.heroModel.loaded.length===2,null,{timeout:240000});
 await click("先看全卷");mark("全卷：街巷与桥上都有行人");
 await sample("overview");
 await click("虹桥");mark("观景模式：近看桥上行走与避让");
 await sample("bridge");
 await click("暂停场景动画");
 const frozen=await state();
 await page.waitForFunction(f=>window.__qingming.frames>f+1,frozen.frames,{timeout:120000});
 assert.equal((await state()).elapsed,frozen.elapsed);
 assert.deepEqual((await state()).people,frozen.people);
 await click("继续场景动画");
 await click("走进画里 · 开始春游");mark("游戏：周围的人继续逛街");
 await sample("game");
 await click("旅行菜单");await click("回看全卷");mark("回到全卷：人群继续活动");
 assert.equal(await page.evaluate(()=>window.__journey.active),false);
 await sample("returned-overview",4);
 mark("结束");report.end=(Date.now()-started)/1000;
 assert.deepEqual(report.errors,[]);
}catch(e){report.failure=String(e.stack);await page.screenshot({path:new URL("crowd-browser-failure.png",root).pathname,timeout:180000}).catch(()=>{});throw e;}
finally{
 report.wallSeconds=(Date.now()-started)/1000;
 await context.close();await video.saveAs(new URL("crowd-overview-game-raw.webm",out).pathname);
 await browser.close();await writeFile(new URL("crowd-browser.json",out),JSON.stringify(report,null,2));
}
