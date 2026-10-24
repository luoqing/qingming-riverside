import { chromium } from "playwright";
import assert from "node:assert/strict";
const root=new URL("../",import.meta.url);
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,
  ignoreDefaultArgs:["--disable-dev-shm-usage"],args:["--no-sandbox","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
try {
 const page=await browser.newPage({viewport:{width:1100,height:760}});
 page.setDefaultTimeout(180000);
 const errors=[]; page.on("pageerror",e=>errors.push(e.message));
 await page.goto(new URL("index.html",root).href,{waitUntil:"domcontentloaded",timeout:180000});
 await page.waitForFunction(()=>window.__qingming?.frames>1,null,{timeout:180000});
 await page.getByRole("button",{name:"带上120文，出发",exact:true}).click();
 assert.equal(await page.locator(".j-context").isVisible(),false);
 assert.equal(await page.locator(".j-tools button:visible").count(),1);
 assert.equal(await page.locator(".j-toast").isVisible(),false);
 assert.equal(await page.locator(".j-help").count(),0);
 assert.equal(await page.getByRole("button",{name:/用 WASD 或方向键走一走/}).isVisible(),true);
 await page.screenshot({path:new URL("journey-guided-start.png",root).pathname,timeout:180000});
 await page.keyboard.down("KeyS");
 await page.waitForFunction(()=>window.__journey.learnedMovement,null,{timeout:180000});
 await page.keyboard.up("KeyS");
 assert.equal(await page.locator(".j-help").count(),0);
 await page.getByRole("button",{name:"旅行菜单",exact:true}).click();
 assert.equal(await page.getByRole("button",{name:"地图",exact:true}).isVisible(),true);
 await page.getByRole("button",{name:"地图",exact:true}).click();
 await page.locator(".j-atlas .j-navigation-layers").waitFor();
 assert.ok(await page.locator("[data-layer=buildings] rect").count()>15);
 await page.getByRole("button",{name:"关闭窗口",exact:true}).click();
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:new URL("journey-guided-mobile.png",root).pathname,timeout:180000});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);
 console.log("PASS: clean start, real movement advances one hint, menu retains map, roads/buildings intact, narrow-screen layout, no JS errors");
} finally {await browser.close();}
