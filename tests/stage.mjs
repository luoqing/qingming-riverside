import {build} from 'esbuild';
import {writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const root=new URL('../',import.meta.url);
const result=await build({entryPoints:[new URL('human-stage.js',import.meta.url).pathname],bundle:true,write:false,minify:true,format:'iife'});
await writeFile(new URL('human-stage.html',import.meta.url),`<!doctype html><html><meta charset="utf-8"><body><script>${result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')}</script></body></html>`);
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{const page=await browser.newPage({viewport:{width:1200,height:850}});page.on('pageerror',e=>console.log(e.message));await page.goto(new URL('human-stage.html',import.meta.url).href);await page.waitForFunction(()=>window.stageReady);await page.screenshot({path:new URL('human-detail.png',root).pathname});}finally{await browser.close();}
