import {chromium} from "playwright";
import assert from "node:assert/strict";
import {writeFile} from "node:fs/promises";
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:["--no-sandbox"]});
const report=[];
try{
 const page=await browser.newPage({viewport:{width:960,height:640}});
 for(const name of ["gameplay","running","gameplay-full","crowd-overview-game"]){
  await page.goto(`http://127.0.0.1:8767/recordings/${name}.mp4`,{waitUntil:"domcontentloaded",timeout:60000});
  await page.waitForFunction(()=>document.querySelector("video")?.readyState>=2,null,{timeout:60000});
  if(await page.evaluate(()=>document.querySelector("video").paused)) await page.locator("video").click({position:{x:100,y:100}});
  await page.waitForFunction(()=>document.querySelector("video").currentTime>.1 && !document.querySelector("video").paused,null,{timeout:15000});
  const state=await page.evaluate(()=>{const v=document.querySelector("video");return {duration:v.duration,width:v.videoWidth,height:v.videoHeight,time:v.currentTime,error:v.error?.message||null};});
  assert.equal(state.error,null);assert.equal(state.width,960);assert.ok(state.duration>10);report.push({name,...state});
 }
 console.log("PASS: MP4 recordings decode and actually play in Chromium",JSON.stringify(report));
 await writeFile(new URL("../recordings/playback-check.json",import.meta.url),JSON.stringify(report,null,2));
}finally{await browser.close();}
