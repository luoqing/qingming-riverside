import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[];
async function open(viewport,phone=false){const p=await browser.newPage({viewport,deviceScaleFactor:1,isMobile:phone,hasTouch:phone});p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await p.goto(new URL('index.html',root).href,{waitUntil:'domcontentloaded',timeout:180000});await p.waitForFunction(()=>window.__qingming?.frames>2&&getComputedStyle(document.querySelector('#loading')).opacity==='0',null,{timeout:180000});return p;}
try{
 if(!process.argv.includes('--phone-only')){
 const p=await open({width:1440,height:960});
 await p.mouse.move(430,450);await p.mouse.down();await p.mouse.move(950,450,{steps:8});await p.mouse.up();
 await p.waitForFunction(()=>window.__qingming.camera[2]<-45,null,{timeout:180000});
 await p.screenshot({path:new URL('rear-preview.png',root).pathname,timeout:120000});console.log('PASS actual rear camera:',await p.evaluate(()=>window.__qingming.camera));
 await p.close();
 }
 const phone=await open({width:390,height:844},true);
 await phone.screenshot({path:new URL('mobile-preview.png',root).pathname,timeout:120000});
 await phone.getByRole('button',{name:'虹桥',exact:true}).click();
 await phone.waitForFunction(()=>Math.abs(window.__qingming.camera[0]-9)<.1,null,{timeout:120000});
 const states=await phone.locator('[data-view]').evaluateAll(bs=>bs.map(b=>({view:b.dataset.view,pressed:b.getAttribute('aria-pressed'),active:b.classList.contains('active'),background:getComputedStyle(b).backgroundColor})));
 console.log('View button states:',states);assert.equal(states.find(b=>b.view==='bridge').background,'rgb(62, 57, 45)');assert.equal(states.find(b=>b.view==='overview').background,'rgba(0, 0, 0, 0)');
 await phone.screenshot({path:new URL('mobile-bridge-preview.png',root).pathname,timeout:120000});
 assert.deepEqual(errors,[]);console.log('PASS final standalone rear + mobile views; no browser errors');
}finally{await browser.close();}
