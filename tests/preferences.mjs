import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const root=new URL("../",import.meta.url),report={checks:[],errors:[]};
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,
 ignoreDefaultArgs:["--disable-dev-shm-usage"],args:["--no-sandbox","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
let page;
try {
 page=await browser.newPage({viewport:{width:960,height:720}});page.setDefaultTimeout(180000);
 page.on("pageerror",e=>report.errors.push(e.message));
 page.on("console",m=>{if(m.type()==="error")report.errors.push(m.text());});
 const click=name=>page.getByRole("button",{name,exact:true}).click();
 await page.goto(new URL("index.html",root).href,{waitUntil:"domcontentloaded",timeout:180000});
 await page.waitForFunction(()=>window.__qingming?.frames>1,null,{timeout:300000});
 await click("带上120文，出发");await click("旅行菜单");
 for(const label of ["背景音乐","音效","对白语音"])await click(label+"：开");
 await page.getByRole("combobox",{name:"主角音色",exact:true}).selectOption("female");
 await click("继续春游");
 let audio=await page.evaluate(()=>window.__journey.audio);
 assert.equal(audio.voice,false);assert.equal(audio.effects,false);assert.equal(audio.music,false);assert.equal(audio.heroVoice,"female");
 report.checks.push("Three independent sound switches and manual voice selection apply");console.log("PASS",report.checks.at(-1));
 await page.reload({waitUntil:"domcontentloaded",timeout:180000});
 await page.waitForFunction(()=>window.__journey?.audio.embeddedClips>=62,null,{timeout:300000});
 audio=await page.evaluate(()=>window.__journey.audio);
 assert.equal(audio.voice,false);assert.equal(audio.effects,false);assert.equal(audio.music,false);assert.equal(audio.heroVoice,"female");
 report.checks.push("Actual game reload restores all four sound preferences");console.log("PASS",report.checks.at(-1));
 await click("带上120文，出发");await click("旅行菜单");await click("对白语音：关");await click("继续春游");
 await page.keyboard.press("KeyE");await click("显示完整字幕或继续");await click("我来帮你绕开线");
 await page.waitForFunction(()=>window.__journey.story.includes("invited"));
 assert.equal(await page.evaluate(()=>window.__journey.audio.lastVoice),"zh-CN-XiaoyiNeural");
 assert.ok(await page.evaluate(()=>window.__journey.audio.played)>=2);
 report.checks.push("Selected girl voice actually plays the answer before interaction");console.log("PASS",report.checks.at(-1));
 assert.deepEqual(report.errors,[]);
} catch(e){report.failure=String(e.stack);report.page=await page?.evaluate(()=>({title:document.title,text:document.body.innerText.slice(0,1200),frames:window.__qingming?.frames,journey:window.__journey?.audio})).catch(()=>null);throw e;}
finally{await writeFile(new URL("preferences-test-results.json",root),JSON.stringify(report,null,2));await browser.close();}
