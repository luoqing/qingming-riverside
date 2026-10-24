import {chromium} from "playwright";
import assert from "node:assert/strict";
import {writeFile} from "node:fs/promises";
const root=new URL("../",import.meta.url),report={checks:[],errors:[]};
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,
 ignoreDefaultArgs:["--disable-dev-shm-usage"],args:["--no-sandbox","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
try {
 const page=await browser.newPage({viewport:{width:960,height:800}});page.setDefaultTimeout(180000);
 page.on("pageerror",e=>report.errors.push(e.message));
 const click=name=>page.getByRole("button",{name,exact:true}).click({force:true});
 await page.goto(new URL("characters.html",root).href,{waitUntil:"domcontentloaded",timeout:180000});
 await page.waitForFunction(()=>window.__characterPreview?.loaded.length===2,null,{timeout:180000});
 for(const [gender,label] of [["female","小女孩"],["male","小男孩"]]) {
  await click(label);await click("站立");await click("看看正面");
  for(const [prop,label] of [["rattle","拿拨浪鼓"],["peony","拿花束"]]) {
   await click(label);
   await page.waitForFunction(p=>window.__characterPreview.held===p && Math.abs(window.__characterPreview.grip.rotation[3])>.99,prop);
   const status=await page.evaluate(()=>window.__characterPreview);
   const joint=status.joints.find(j=>j.gender===gender);
   assert.ok(joint.gripOffset.every(Number.isFinite));
   assert.ok(Math.hypot(...joint.gripOffset)>0,"Palm center must not equal the wrist origin");
   assert.ok(status.grip.position.every(Number.isFinite));
   assert.ok(Math.abs(status.grip.rotation[3])>.99,"Neutral carry handle should be upright");
   await page.screenshot({path:new URL(`holding-${gender}-${prop}.png`,root).pathname,timeout:180000});
   if(prop==="rattle") {
    await click("看看侧面");await click("小跑");
    const previous=status.grip.position;
    await page.waitForFunction(p=>window.__characterPreview.grip.position.some((v,i)=>Math.abs(v-p[i])>.001),previous);
    await page.screenshot({path:new URL(`holding-${gender}-run-side.png`,root).pathname,timeout:180000});
    await click("站立");await click("看看正面");
   }
   report.checks.push({gender,prop,palmOffset:joint.gripOffset,fingerBones:joint.fingerBones});
  }
 }
 assert.deepEqual(report.errors,[]);console.log("PASS: both real skinned models carry rattle/flowers at palm socket; upright rest carry and moving socket verified; screenshots saved");
}finally{await browser.close();await writeFile(new URL("holding-preview-results.json",root),JSON.stringify(report,null,2));}
