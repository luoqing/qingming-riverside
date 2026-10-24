import {chromium} from "playwright";
import assert from "node:assert/strict";
import {writeFile} from "node:fs/promises";
const root=new URL("../",import.meta.url),report={anonymous:true,checks:[],errors:[],audioResponses:[]};
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,
 args:["--no-sandbox","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
const context=await browser.newContext({viewport:{width:1000,height:760},deviceScaleFactor:.6});
const page=await context.newPage();page.setDefaultTimeout(180000);
page.on("pageerror",e=>report.errors.push(e.message));
page.on("response",response=>{
 let request=response.request();while(request.redirectedFrom())request=request.redirectedFrom();
 if(request.url().includes("/storage/object/")&&request.url().split("?")[0].endsWith(".mp3"))
  report.audioResponses.push({status:response.status(),type:response.headers()["content-type"]});
});
const click=name=>page.getByRole("button",{name,exact:true}).click({force:true});
const reveal=()=>click("显示完整字幕或继续");
const state=()=>page.evaluate(()=>window.__journey);
const waitSpoken=text=>page.waitForFunction(text=>window.__journey.audio.recent.some(line=>line.text===text),text,{timeout:120000});
try{
 await page.goto("https://bytedance.feishu.link/app/app_17geaupaa8v?revision=20261021",{waitUntil:"domcontentloaded",timeout:120000});
 await page.waitForFunction(()=>window.__journey?.audio.embeddedClips>=384&&window.__journey.heroModel.loaded.length===2,null,{timeout:240000});
 console.log("STEP anonymous new release loaded");
 await click("小女孩");await click("带上120文，出发");
 await click("旅行菜单");await click("新手玩法路线");
 assert.equal(await page.locator(".j-route-stop").count(),6);
 await page.screenshot({path:new URL("deployment/miaoda-route-20261021.png",root).pathname,timeout:180000});
 await click("收起路线，继续春游");
 await page.keyboard.press("KeyM");
 await page.getByRole("combobox",{name:"在导览图上找地点",exact:true}).selectOption("tea");
 await click("辅助带我走");
 await page.waitForFunction(()=>!window.__journey.route.length&&window.__journey.near==="tea",null,{timeout:480000});
 console.log("STEP arrived at tea stall without teleporting");
 await page.keyboard.press("KeyE");await reveal();await click("看看摊上的货");await reveal();
 await click("挑选花香茶");await reveal();
 await click("问问这件多少钱");
 await waitSpoken("花香茶，12文一份。");
 assert.ok((await state()).audio.recent.some(line=>line.text==="花香茶多少钱呀？"&&line.voice==="zh-CN-XiaoyiNeural"));
 assert.equal((await state()).money,120);
 console.log("STEP selected item question and quote actually started playback");
 await reveal();await click("确认购买");
 await waitSpoken("好嘞，花香茶，收你12文。已经放进背包了，客官慢走！");
 assert.equal((await state()).money,108);assert.equal((await state()).inventory["osmanthus-tea"],1);
 await reveal();await click("谢谢，再见");
 await page.waitForFunction(()=>!window.__journey.dialogue&&window.__journey.dismissedVendor==="tea",null,{timeout:120000});
 const time=await page.evaluate(()=>window.__qingming.elapsed);
 await page.waitForFunction(t=>window.__qingming.elapsed>t+.8,time,{timeout:120000});
 assert.notEqual((await state()).near,"tea");
 assert.equal(await page.getByRole("button",{name:"和掌柜交谈 · E",exact:true}).isVisible(),false);
 const world=await page.evaluate(()=>window.__qingming);let minimum=Infinity;
 for(const p of world.pedestrians)for(const c of world.camels)for(const b of c.bodies){
  if(Math.abs(p.y-b.y)>1.5)continue;
  const gap=Math.hypot(p.x-b.x,p.z-b.z)-p.radius-b.radius;minimum=Math.min(minimum,gap);assert.ok(gap>=-1e-6);
 }
 report.minimumCamelGap=minimum;report.final=await state();
 // HTMLMediaElement requests byte ranges; successful audio may be HTTP 206.
 assert.ok(report.audioResponses.filter(r=>r.status>=200&&r.status<300&&r.type?.includes("audio")).length>=4);
 assert.deepEqual(report.errors,[]);
 report.checks=["Anonymous current release and all six guide steps load", "Named-item girl question and correct-price NPC quote play from hosted MP3", "Purchase charges once and hosted NPC receipt plays", "Explicit goodbye suppresses nearby stall prompt", "Actual pedestrians do not overlap live camels"];
 console.log("PASS",JSON.stringify({checks:report.checks,audioResponses:report.audioResponses.length,minimum}));
 await page.screenshot({path:new URL("deployment/miaoda-shop-20261021.png",root).pathname,timeout:180000});
}catch(e){report.failure=String(e.stack);await page.screenshot({path:new URL("deployment/miaoda-shop-failure.png",root).pathname,timeout:180000}).catch(()=>{});throw e;}
finally{await context.close();await browser.close();await writeFile(new URL("deployment/miaoda-shop-results.json",root),JSON.stringify(report,null,2));}
