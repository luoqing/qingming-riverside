import {chromium} from "playwright";
import assert from "node:assert/strict";
import {readFile,writeFile} from "node:fs/promises";
const url="https://bytedance.feishu.link/app/app_17geaupaa8v";
const root=new URL("../",import.meta.url),report={url,anonymous:true,errors:[],failedRequests:[],assets:[]};
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,
 args:["--no-sandbox","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
const context=await browser.newContext({viewport:{width:960,height:640},deviceScaleFactor:.6});
const page=await context.newPage();page.setDefaultTimeout(240000);
page.on("pageerror",e=>report.errors.push(e.message));
page.on("requestfailed",r=>report.failedRequests.push({url:r.url().split("?")[0],error:r.failure()?.errorText}));
page.on("response",r=>{
 let request=r.request();while(request.redirectedFrom())request=request.redirectedFrom();
 if(request.url().includes("/storage/object/"))report.assets.push({url:request.url().split("?")[0],
  status:r.status(),finalUrl:r.url().split("?")[0],type:r.headers()["content-type"]});
});
try{
 const response=await page.goto(url,{waitUntil:"domcontentloaded",timeout:120000});
 report.status=response?.status();report.finalUrl=page.url();
 console.log("Loaded",report.status,report.finalUrl);
 await page.waitForFunction(()=>window.__qingming?.frames>1 && window.__journey?.heroModel.loaded.length===2,null,{timeout:240000});
 report.initial=await page.evaluate(()=>({world:window.__qingming.frames,hero:window.__journey.heroModel}));
 await page.getByRole("button",{name:"先看全卷",exact:true}).click({force:true});
 const before=await page.evaluate(()=>({elapsed:window.__qingming.elapsed,people:window.__qingming.pedestrians}));
 await page.waitForFunction(t=>window.__qingming.elapsed>=t+2.5,before.elapsed,{timeout:240000});
 const after=await page.evaluate(()=>window.__qingming.pedestrians);
 report.moved=after.filter((a,i)=>a.hasPath && Math.hypot(a.x-before.people[i].x,a.z-before.people[i].z)>.1).length;
 assert.ok(report.moved>100,"Live anonymous crowd must move");
 await page.screenshot({path:new URL("deployment/miaoda-overview.png",root).pathname,timeout:180000});
 await page.getByRole("button",{name:"走进画里 · 开始春游",exact:true}).click({force:true});
 await page.waitForFunction(()=>window.__journey.active,null,{timeout:120000});
 report.active=await page.evaluate(()=>window.__journey.active);
 await page.screenshot({path:new URL("deployment/miaoda-game.png",root).pathname,timeout:180000});
 // A new context has no account cookies. Verify hosted voice bytes separately
 // without claiming the clip was played through a conversation.
 const manifest=JSON.parse(await readFile(new URL("deployment/miaoda-assets.json",root),"utf8"));
 const voice=Object.entries(manifest.files).find(([key])=>key.endsWith(".mp3"))[1];
 const audio=await context.request.get(new URL(voice.url,url).href,{timeout:60000});
 report.voice={status:audio.status(),type:audio.headers()["content-type"],bytes:(await audio.body()).length};
 assert.ok(audio.ok() && report.voice.bytes>1000 && !report.voice.type?.includes("text/html"),"Anonymous voice asset must return audio bytes");
 assert.equal(report.errors.length,0);
 assert.ok(report.assets.filter(a=>a.status===200).length>=3,"Atlas and both models must load anonymously");
 console.log("PASS",JSON.stringify({moved:report.moved,active:report.active,assets:report.assets,voice:report.voice}));
}catch(e){report.failure=String(e.stack);await page.screenshot({path:new URL("deployment/miaoda-failure.png",root).pathname,timeout:60000}).catch(()=>{});throw e;}
finally{await browser.close();await writeFile(new URL("deployment/miaoda-online.json",root),JSON.stringify(report,null,2));}
