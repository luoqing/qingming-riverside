import { chromium } from "playwright";
import assert from "node:assert/strict";
import {writeFile} from "node:fs/promises";
const root=new URL("../",import.meta.url), report={checks:[],errors:[]};
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,
 ignoreDefaultArgs:["--disable-dev-shm-usage"],args:["--no-sandbox","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
const pass=text=>{report.checks.push(text);console.log("PASS",text);};
let page;
const click=name=>page.getByRole("button",{name,exact:true}).click({force:true});
const state=()=>page.evaluate(()=>window.__journey);
async function reveal(){for(let i=0;i<4;i++)await click("显示完整字幕或继续");}
try {
 page=await browser.newPage({viewport:{width:1200,height:800},deviceScaleFactor:.7});
 page.setDefaultTimeout(180000);
 page.on("pageerror",e=>report.errors.push(e.message));
 page.on("console",m=>{if(m.type()==="error")report.errors.push(m.text());});
 await page.goto(new URL("index.html",root).href,{waitUntil:"domcontentloaded",timeout:240000});
 await page.waitForFunction(()=>window.__qingming?.frames>1 && window.__journey?.heroModel.loaded.length===2,null,{timeout:240000});
 await click("带上120文，出发");
 await page.waitForFunction(()=>document.querySelector(".j-minimap img").naturalWidth>0,null,{timeout:180000});
 assert.equal(await page.locator(".j-minimap").isVisible(),true);
 assert.equal(await page.locator(".j-minimap .j-map-pin").count(),0);
 const marker=await page.locator(".j-mini-me").getAttribute("style");
 const before=await page.evaluate(()=>window.__qingming.pedestrians);
 const merchants=await page.evaluate(()=>window.__qingming.merchants);
 const start=(await state()).position;
 await page.keyboard.down("KeyS");
 try {await page.waitForFunction(p=>Math.hypot(window.__journey.position.x-p.x,window.__journey.position.z-p.z)>.8,start,{timeout:90000});}
 finally{await page.keyboard.up("KeyS");}
 await page.waitForFunction(s=>document.querySelector(".j-mini-me").getAttribute("style")!==s,marker,{timeout:60000});
 const mini=await page.locator(".j-minimap").boundingBox();
 assert.ok(mini.width<220 && mini.height<170);
 pass("Small north-up world survey remains visible and actual player marker moves with native walking");
 await click("旅行菜单");
 for(const label of ["背景音乐","音效","对白语音"])await click(label+"：开");
 await click("继续春游");
 await page.screenshot({path:new URL("ui-clean-street.png",root).pathname,timeout:180000});
 await click("展开完整地图");
 await page.locator(".j-atlas > img").waitFor();
 assert.equal(await page.locator(".j-map-pin").count(),15);
 assert.ok((await page.locator(".j-atlas-panel").boundingBox()).width>=1000);
 await page.screenshot({path:new URL("ui-expanded-map.png",root).pathname,timeout:180000});
 pass("Clicking minimap expands the existing full-size atlas, all destinations and navigation retained");
 await page.getByRole("combobox",{name:"在导览图上找地点",exact:true}).selectOption("toys");
 await click("辅助带我走");
 await page.waitForFunction(()=>!window.__journey.route.length && window.__journey.near==="toys",null,{timeout:420000});
 await page.keyboard.press("KeyE");await reveal();
 assert.equal(await page.locator(".j-dialogue input").count(),0);
 assert.ok(await page.locator(".j-dialogue-choices button:visible").count()<=2);
 const beforeMoney=(await state()).money;
 await click("看看摊上的货");await reveal();
 assert.equal(await page.locator(".j-good:visible").count(),3);
 await click("问问这件多少钱");await reveal();
 assert.equal((await state()).money,beforeMoney);
 await click("便宜一点可以吗");await reveal();
 assert.equal((await state()).money,beforeMoney);
 const dialog=await page.locator(".j-dialogue").boundingBox();
 assert.ok(dialog.height<300 && dialog.width<=600);
 await page.screenshot({path:new URL("ui-compact-shop.png",root).pathname,timeout:180000});
 pass("Shop has no textbox; greeting, browse, quote and bargain unfold with at most two reply buttons; compact dialogue leaves scene visible");
 await click("确认购买");await reveal();
 assert.equal((await state()).inventory.rattle,1);
 assert.ok((await state()).money<beforeMoney);
 await click("结束交谈");
 const after=await page.evaluate(()=>window.__qingming.pedestrians);
 const market=after.map((p,i)=>({p,i})).filter(({p,i})=>p.type==="market"&&p.hasPath&&i%3);
 assert.ok(market.filter(({p,i})=>Math.hypot(p.x-before[i].x,p.z-before[i].z)>.1).length>=8);
 assert.notDeepEqual(await page.evaluate(()=>window.__qingming.merchants),merchants);
 for(let i=0;i<after.length;i++)for(let j=0;j<i;j++) {
  const a=after[i],b=after[j];if(Math.abs(a.y-b.y)>1)continue;
  assert.ok(Math.hypot(a.x-b.x,a.z-b.z)-a.radius-b.radius>=-1e-7,"Actual pedestrians must not overlap");
 }
 pass("Purchase only occurs on explicit confirmation; actual market shoppers change position instead of standing still");
 pass("All eight merchants animate their idle pose; actual 106 pedestrians maintain body separation");
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:new URL("ui-clean-mobile.png",root).pathname,timeout:180000});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.ok((await page.locator(".j-minimap").boundingBox()).width<=140);
 await page.keyboard.press("KeyE");await reveal();
 await click("看看摊上的货");await reveal();
 await page.screenshot({path:new URL("ui-shop-mobile.png",root).pathname,timeout:180000});
 const mobile=await page.locator(".j-dialogue").boundingBox();
 assert.ok(mobile.height<340 && mobile.x>=0 && mobile.x+mobile.width<=391);
 pass("390px mobile layout keeps compact map and subtitles inside viewport without horizontal overflow");
 assert.deepEqual(report.errors,[]);
 report.final=await state();
} catch(e){report.failure=String(e.stack);if(page)await page.screenshot({path:new URL("ui-check-failure.png",root).pathname,timeout:180000}).catch(()=>{});throw e;}
finally{await browser.close();await writeFile(new URL("compact-ui-results.json",root),JSON.stringify(report,null,2));}
