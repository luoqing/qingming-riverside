import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const root=new URL("../",import.meta.url),report={checks:[],errors:[],consoleErrors:[]};
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,
 ignoreDefaultArgs:["--disable-dev-shm-usage"],args:["--no-sandbox","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
const pass=text=>{report.checks.push(text);console.log("PASS",text);};
function monitor(page){page.setDefaultTimeout(180000);page.on("pageerror",e=>report.errors.push(e.message));page.on("console",m=>{if(m.type()==="error")report.consoleErrors.push(m.text());});}
try {
 let page=await browser.newPage({viewport:{width:900,height:800}});monitor(page);
 const click=async name=>{
  for(let i=0;i<3 && !await page.getByRole("button",{name,exact:true}).count();i++) {
   const more=page.getByRole("button",{name:"查看其他回答",exact:true});
   if(!await more.isVisible())break;
   await more.click({force:true});
  }
  return page.getByRole("button",{name,exact:true}).click({force:true});
 };
 await page.goto(new URL("characters.html",root).href,{waitUntil:"domcontentloaded",timeout:180000});
 await page.waitForFunction(()=>window.__characterPreview?.loaded.length===2,null,{timeout:180000});
 const first=await page.evaluate(()=>window.__characterPreview);
 assert.deepEqual(first.errors,[]);
 for(const j of first.joints)assert.ok([...j.arms,...j.legs].every(Boolean),"Both arms and both hips must be identified for each unique rig");
 await page.screenshot({path:new URL("character-girl-front.png",root).pathname,timeout:180000});
 await click("行走");
 await page.waitForFunction(r=>JSON.stringify(window.__characterPreview.joints)!==JSON.stringify(r),first.joints,{timeout:180000});
 await page.screenshot({path:new URL("character-girl-walk.png",root).pathname,timeout:180000});
 await click("看看背面");
 await page.screenshot({path:new URL("character-girl-back.png",root).pathname,timeout:180000});
 await click("小男孩");await click("小跑");
 await page.screenshot({path:new URL("character-boy-run-back.png",root).pathname,timeout:180000});
 await click("看看正面");
 await page.screenshot({path:new URL("character-boy-run-front.png",root).pathname,timeout:180000});
 await click("看看侧面");
 await page.screenshot({path:new URL("character-boy-run-side.png",root).pathname,timeout:180000});
 pass("Both actual Tripo GLBs render, all four limbs identified, native character/action/back-view controls work");
 await page.close();
 if(!process.env.GALLERY_ONLY) {
 page=await browser.newPage({viewport:{width:1100,height:760}});monitor(page);
 await page.goto(new URL("index.html",root).href,{waitUntil:"domcontentloaded",timeout:180000});
 await page.waitForFunction(()=>window.__qingming?.frames>1 && window.__journey?.heroModel.loaded.length===2,null,{timeout:180000});
 await page.locator(".j-intro").getByRole("button",{name:"小男孩",exact:true}).click();
 await click("带上120文，出发");
 const actual=await page.evaluate(()=>({trip:window.__journey,world:window.__qingming}));
 assert.equal(actual.trip.avatar,"male");
 assert.ok(Math.abs(actual.world.camera[1]-actual.world.target[1])<2);
 assert.deepEqual(actual.trip.heroModel.errors,[]);
 pass("Detailed male hero integrated; default camera lowered to person-level third-person view");
 function checkPeople(people){let minimum=Infinity;for(let i=0;i<people.length;i++)for(let j=0;j<i;j++){
  const a=people[i],b=people[j];if(Math.abs(a.y-b.y)>1)continue;
  const gap=Math.hypot(a.x-b.x,a.z-b.z)-a.radius-b.radius;minimum=Math.min(minimum,gap);
  assert.ok(gap>=-0.00001,`Actual crowd overlap ${i}/${j}: ${gap}`);
 }return minimum;}
 checkPeople(actual.world.pedestrians);
 await page.keyboard.press("KeyE");
 await page.waitForFunction(()=>window.__journey.audio.played>0,null,{timeout:180000});
 assert.equal(await page.evaluate(()=>window.__journey.audio.lastSource),"embedded-neural-tts");
 await click("显示完整字幕或继续");
 await click("我来帮你绕开线");
 await page.waitForFunction(()=>window.__journey.story.includes("invited"));
 await page.waitForFunction(()=>window.__journey.audio.recent.some(line=>line.text==="我来帮你绕开线"&&line.voice==="zh-CN-YunxiaNeural"));
 await page.waitForFunction(()=>window.__journey.audio.recent.some(line=>line.text.startsWith("线理顺啦")&&line.voice==="zh-CN-XiaoyiNeural"));
 await click("显示完整字幕或继续");
 await click("我想自己探索");
 await page.waitForFunction(()=>!window.__journey.dialogue,null,{timeout:180000});
 pass("NPC neural audio actually plays; selected answer uses boy voice; story progresses after speech without duplicate actions");
 checkPeople(await page.evaluate(()=>window.__qingming.pedestrians));
 pass("All 133 actual pedestrians remain non-overlapping at initial and later street samples");
 await click("旅行菜单");
 for(const label of ["背景音乐","音效","对白语音"]){await click(label+"：开");assert.equal(await page.getByRole("button",{name:label+"：关",exact:true}).getAttribute("aria-pressed"),"false");}
 await click("继续春游");
 const off=await page.evaluate(()=>window.__journey.audio);
 assert.equal(off.music,false);assert.equal(off.effects,false);assert.equal(off.voice,false);assert.equal(off.speaking,false);
 await page.reload({waitUntil:"domcontentloaded",timeout:180000});
 await page.waitForFunction(()=>window.__journey?.audio.embeddedClips>=62,null,{timeout:180000});
 const restored=await page.evaluate(()=>window.__journey.audio);
 assert.equal(restored.music,false);assert.equal(restored.effects,false);assert.equal(restored.voice,false);
 pass("Music, effects and voice independently switch off and persist across reload");
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.consoleErrors,[]);
 await writeFile(new URL(process.env.GALLERY_ONLY ? "gallery-test-results.json":"characters-audio-test-results.json",root),JSON.stringify(report,null,2));
} catch(error){report.failure=String(error.stack);await writeFile(new URL("characters-audio-test-results.json",root),JSON.stringify(report,null,2));throw error;}
finally{await browser.close();}
