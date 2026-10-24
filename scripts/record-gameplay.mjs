import { chromium } from "playwright";
import { mkdir,writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const root=new URL("../",import.meta.url),out=new URL("recordings/",root);
await mkdir(new URL("raw/",out),{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,
 ignoreDefaultArgs:["--disable-dev-shm-usage"],args:["--no-sandbox","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
const report={kind:"real browser gameplay recording",audio:false,errors:[],chapters:[],checks:[]};
let context,page,start,video;
const mark=(title)=>{const seconds=(Date.now()-start)/1000;report.chapters.push({title,seconds});console.log("CHAPTER",seconds.toFixed(1),title);};
const click=async name=>{
 for(let i=0;i<3 && !await page.getByRole("button",{name,exact:true}).count();i++) {
  const more=page.getByRole("button",{name:"查看其他回答",exact:true});
  if(!await more.isVisible())break;
  await more.click({force:true});
 }
 return page.getByRole("button",{name,exact:true}).click({force:true});
};
const snapshot=()=>page.evaluate(()=>window.__journey);
async function reveal(){await click("显示完整字幕或继续");await page.keyboard.press("KeyE");}
async function travel(id){
 await page.keyboard.press("KeyM");
 await page.getByRole("combobox",{name:"在导览图上找地点",exact:true}).selectOption(id);
 await click("辅助带我走");
 await page.waitForFunction(id=>!window.__journey.route.length && window.__journey.near===id,id,{timeout:600000});
}
try {
 context=await browser.newContext({viewport:{width:960,height:600},deviceScaleFactor:0.7,
  recordVideo:{dir:new URL("raw/",out).pathname,size:{width:960,height:600}}});
 page=await context.newPage();video=page.video();start=Date.now();page.setDefaultTimeout(240000);
 page.on("pageerror",e=>report.errors.push(e.message));
 page.on("console",m=>{if(m.type()==="error")report.errors.push(m.text());});
 await page.goto(new URL("index.html",root).href,{waitUntil:"domcontentloaded",timeout:240000});
 await page.waitForFunction(()=>window.__qingming?.frames>1 && window.__journey?.heroModel.loaded.length===2,null,{timeout:300000});
 mark("选择主角，走进汴京");
 await page.locator(".j-intro").getByRole("button",{name:"小男孩",exact:true}).click({force:true});
 await click("带上120文，出发");
 const before=await snapshot();
 mark("键盘小跑，观察屈膝和人群避让");
 await page.keyboard.down("ShiftLeft");await page.keyboard.down("KeyD");
 try{await page.waitForFunction(p=>Math.hypot(window.__journey.position.x-p.x,window.__journey.position.z-p.z)>2,pick(before.position),{timeout:60000});}
 finally{await page.keyboard.up("KeyD");await page.keyboard.up("ShiftLeft");}
 const after=await snapshot();assert.ok(Math.hypot(after.position.x-before.position.x,after.position.z-before.position.z)>.2);
 report.checks.push("Native keyboard running moves the actual player");
 mark("地图找阿芽，沿街走回去");await travel("aya");
 mark("和阿芽交谈，帮忙解开纸鸢线");
 await page.keyboard.press("KeyE");await reveal();await click("我来帮你绕开线");
 await page.waitForFunction(()=>window.__journey.story.includes("invited"));
 await reveal();await click("我想自己探索");
 await page.waitForFunction(()=>!window.__journey.dialogue,null,{timeout:60000});
 assert.ok((await snapshot()).story.includes("invited"));report.checks.push("Proximity conversation and kite activity actually complete");
 mark("地图找玩具摊，走近掌柜");await travel("toys");
 mark("问价、还价、确认购买拨浪鼓");
 await page.keyboard.press("KeyE");await page.getByRole("region",{name:"与周货郎交谈",exact:true}).waitFor();await reveal();
 await click("看看摊上的货");await reveal();
 await click("问问这件多少钱");await page.waitForFunction(()=>!window.__journey.audio.speaking,null,{timeout:60000});
 await click("显示完整字幕或继续");await click("便宜一点可以吗");
 await page.waitForFunction(()=>!window.__journey.audio.speaking,null,{timeout:60000});
 await click("显示完整字幕或继续");
 await page.getByRole("button",{name:"确认购买",exact:true}).waitFor({state:"visible"});
 const money=(await snapshot()).money;await click("确认购买");
 assert.ok((await snapshot()).inventory.rattle>0);assert.ok((await snapshot()).money<money);
 report.checks.push("Asking prices never purchases; explicit confirmation buys a real inventory item");
 mark("拿起拨浪鼓，在街上把玩");await click("结束交谈");
 await page.keyboard.press("Space");await page.waitForFunction(()=>window.__journey.drumBeats>0,null,{timeout:60000});
 await page.mouse.move(480,270);await page.mouse.down();await page.mouse.move(600,285,{steps:18});await page.mouse.up();
 await page.waitForTimeout(1800);
 report.checks.push("Toy interaction changes the actual held toy state");
 mark("结束");report.final=await snapshot();assert.deepEqual(report.errors,[]);
} catch(error){report.failure=String(error.stack);if(page)await page.screenshot({path:new URL("recording-failure.png",out).pathname,timeout:180000}).catch(()=>{});throw error;}
finally{
 if(context)await context.close();
 if(video){await video.saveAs(new URL("gameplay-raw.webm",out).pathname);report.video="gameplay-raw.webm";}
 await writeFile(new URL("gameplay-session.json",out),JSON.stringify(report,null,2));await browser.close();
}
function pick(p){return {x:p.x,z:p.z};}
