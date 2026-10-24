import {chromium} from "playwright";
import {mkdir,writeFile} from "node:fs/promises";
import assert from "node:assert/strict";
const root=new URL("../",import.meta.url),out=new URL("recordings/",root);
await mkdir(new URL("raw/",out),{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,
 ignoreDefaultArgs:["--disable-dev-shm-usage"],args:["--no-sandbox","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
const context=await browser.newContext({viewport:{width:960,height:600},recordVideo:{dir:new URL("raw/",out).pathname,size:{width:960,height:600}}});
const page=await context.newPage(),video=page.video(),started=Date.now(),report={errors:[],checks:[]};
page.setDefaultTimeout(180000);page.on("pageerror",e=>report.errors.push(e.message));
page.on("console",m=>{if(m.type()==="error")report.errors.push(m.text());});
const click=name=>page.getByRole("button",{name,exact:true}).click({force:true});
try {
 await page.goto(new URL("characters.html",root).href,{waitUntil:"domcontentloaded",timeout:180000});
 await page.waitForFunction(()=>window.__characterPreview?.loaded.length===2,null,{timeout:180000});
 report.start=(Date.now()-started)/1000;
 await click("小男孩");await click("看看侧面");await click("小跑");
 for(const gender of ["male","female"]) {
  if(gender==="female")await click("小女孩");
  await page.waitForFunction(gender=>{
   const knees=window.__characterPreview.joints.find(j=>j.gender===gender)?.kneeBendDegrees;
   return knees && Math.max(...knees)>65;
  },gender,{timeout:60000});
  await page.screenshot({path:new URL(`running-${gender}-side.png`,out).pathname,timeout:180000});
  const peaks=[0,0],until=Date.now()+6500;let samples=0;
  while(Date.now()<until){
    const values=await page.evaluate(g=>window.__characterPreview.joints.find(j=>j.gender===g).kneeBendDegrees,gender);
    values.forEach((v,i)=>peaks[i]=Math.max(peaks[i],v));samples++;
    await page.waitForTimeout(140);
  }
  assert.ok(peaks.every(v=>v>65 && v<100),"Both actual knees should visibly flex during the cycle");
  report.checks.push({gender,peakBendDegrees:peaks,samples});
 }
 report.end=(Date.now()-started)/1000;
 assert.deepEqual(report.errors,[]);console.log(JSON.stringify(report));
}finally{await context.close();await video.saveAs(new URL("running-raw.webm",out).pathname);await browser.close();await writeFile(new URL("running-session.json",out),JSON.stringify(report,null,2));}
