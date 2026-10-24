import {chromium} from "playwright";
import assert from "node:assert/strict";
import {writeFile} from "node:fs/promises";
const root=new URL("../",import.meta.url),report={checks:[],errors:[],collisionSamples:0,minimumCamelGap:Infinity};
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,
 ignoreDefaultArgs:["--disable-dev-shm-usage"],args:["--no-sandbox","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
const context=await browser.newContext({viewport:{width:1100,height:780},deviceScaleFactor:.65});
const page=await context.newPage();page.setDefaultTimeout(180000);
page.on("pageerror",e=>report.errors.push(e.message));
page.on("console",m=>{if(m.type()==="error")report.errors.push(m.text());});
const click=name=>page.getByRole("button",{name,exact:true}).click({force:true});
const state=()=>page.evaluate(()=>window.__journey);
async function inspect(){
 const world=await page.evaluate(()=>window.__qingming);
 for(const p of world.pedestrians)for(const c of world.camels)for(const b of c.bodies){
  if(Math.abs(p.y-b.y)>1.5)continue;
  const gap=Math.hypot(p.x-b.x,p.z-b.z)-p.radius-b.radius;
  report.minimumCamelGap=Math.min(report.minimumCamelGap,gap);
  assert.ok(gap>=-1e-6,"Actual town pedestrian enters a camel body");
 }
 report.collisionSamples++;return world;
}
async function pass(label){await inspect();report.checks.push(label);console.log("PASS",label);}
async function reveal(){await click("显示完整字幕或继续");}
async function go(id){
 await page.keyboard.press("KeyM");
 await page.getByRole("combobox",{name:"在导览图上找地点",exact:true}).selectOption(id);
 await click("辅助带我走");
 await page.waitForFunction(id=>!window.__journey.route.length && window.__journey.near===id,id,{timeout:480000});
 await inspect();
}
async function voices(texts){
 await page.waitForFunction(expected=>expected.every(({text,voice})=>window.__journey.audio.recent.some(r=>r.text===text && (!voice||r.voice===voice))),texts,{timeout:120000});
 assert.equal((await state()).audio.lastSource,"embedded-neural-tts");
}
async function buyTea(id,name,price,voice){
 await page.keyboard.press("KeyE");await reveal();await click("看看摊上的货");await reveal();
 await click(`挑选${name}`);await reveal();
 const money=(await state()).money;
 await click("问问这件多少钱");
 const quote=`${name}，${price}文一份。`;
 await voices([{text:`${name}多少钱呀？`,voice},{text:quote,voice:"zh-CN-YunxiNeural"}]);
 assert.equal((await state()).money,money,"Asking a price cannot charge money");
 await reveal();await page.screenshot({path:new URL(`deployment/shop-quote-${id}.png`,root).pathname,timeout:180000});
 await click("确认购买");
 await page.waitForFunction(id=>window.__journey.inventory[id]===1,id,{timeout:120000});
 const receipt=`好嘞，${name}，收你${price}文。已经放进背包了，客官慢走！`;
 await voices([{text:receipt,voice:"zh-CN-YunxiNeural"}]);
 assert.equal((await state()).money,money-price);
 await pass(`${name}: selected-item question and priced NPC reply actually play, purchase charges once and NPC receipt plays`);
 await reveal();
 if(id==="osmanthus-tea"){
  await click("再看看");await reveal();
  assert.equal((await state()).dialogue.id,"tea");assert.equal((await state()).dismissedVendor,null);
  await click("结束交谈");
 }else await click("谢谢，再见");
 await page.waitForFunction(()=>!window.__journey.dialogue && window.__journey.dismissedVendor==="tea",null,{timeout:120000});
}
try{
 await page.goto(process.env.TEST_URL||new URL("index.html",root).href,{waitUntil:"domcontentloaded",timeout:240000});
 await page.waitForFunction(()=>window.__qingming?.frames>1 && window.__journey?.heroModel.loaded.length===2,null,{timeout:240000});
 await click("小男孩");await click("带上120文，出发");
 await click("旅行菜单");await click("新手玩法路线");
 assert.equal(await page.locator(".j-route-stop").count(),6);
 assert.equal((await state()).paused,true);
 assert.ok(await page.getByRole("dialog",{name:"新手玩法路线",exact:true}).isVisible());
 const frozen=await inspect();
 await page.waitForFunction(f=>window.__qingming.frames>f+1,frozen.frames,{timeout:120000});
 assert.equal((await inspect()).elapsed,frozen.elapsed,"Guide pauses the town while reading");
 await page.screenshot({path:new URL("deployment/beginner-route-pc.png",root).pathname,timeout:180000});
 await click("找阿芽");
 assert.equal((await state()).paused,false);assert.equal((await state()).guidance.id,"aya");assert.equal((await state()).route.length,0);
 await pass("On-demand six-step story flow opens from menu, pauses reading and sets manual navigation without teleporting");
 await go("tea");await buyTea("osmanthus-tea","花香茶",12,"zh-CN-YunxiaNeural");
 const gone=(await state()).position;
 const time=(await inspect()).elapsed;
 await page.waitForFunction(t=>window.__qingming.elapsed>t+1,time,{timeout:120000});
 assert.notEqual((await state()).near,"tea");
 assert.equal(await page.getByRole("button",{name:"和掌柜交谈 · E",exact:true}).isVisible(),false);
 await pass("Browsing remains in conversation; saying goodbye hides both dialogue and the same stall's nearby talk prompt");
 await page.keyboard.down("KeyA");
 try{await page.waitForFunction(p=>Math.hypot(window.__journey.position.x-p.x,window.__journey.position.z-p.z)>3.1,gone,{timeout:180000});}
 finally{await page.keyboard.up("KeyA");}
 await page.waitForFunction(()=>window.__journey.dismissedVendor===null,null,{timeout:90000});
 await click("旅行菜单");await page.getByRole("combobox",{name:"主角音色",exact:true}).selectOption("female");await click("继续春游");
 await go("tea");await buyTea("spring-tea","清明春茶",8,"zh-CN-XiaoyiNeural");
 await pass("Walking out rearms the stall; returning with girl voice plays the new selected item and price");
 await click("旅行菜单");await click("对白语音：开");await click("继续春游");
 await go("tea");
 const played=(await state()).audio.played;
 await page.keyboard.press("KeyE");await reveal();await click("看看摊上的货");await reveal();await click("问问这件多少钱");await reveal();
 assert.equal((await state()).audio.played,played);
 await click("结束交谈");await pass("Disabling voice still suppresses all shopping playback");
 await page.setViewportSize({width:390,height:844});await click("旅行菜单");await click("新手玩法路线");
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 const box=await page.getByRole("dialog",{name:"新手玩法路线",exact:true}).boundingBox();
 assert.ok(box.x>=0 && box.x+box.width<=391);
 await page.screenshot({path:new URL("deployment/beginner-route-mobile.png",root).pathname,timeout:180000});
 await click("收起路线，继续春游");
 await pass("Route flow fits a narrow screen, closes and resumes play");
 report.final=await state();assert.deepEqual(report.errors,[]);
}catch(e){report.failure=String(e.stack);await page.screenshot({path:new URL("deployment/shop-revision-failure.png",root).pathname,timeout:180000}).catch(()=>{});throw e;}
finally{await context.close();await browser.close();await writeFile(new URL("deployment/shop-revision-results.json",root),JSON.stringify(report,null,2));}
