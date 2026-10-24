import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1100,height:760}});page.setDefaultTimeout(120000);page.on('pageerror',e=>{errors.push(e.message);console.log('ERROR',e.message);});
 await page.goto(new URL('index.html',root).href,{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForFunction(()=>window.__qingming?.frames>=2,null,{timeout:180000});
 console.log('ready',await page.evaluate(()=>({game:window.__journey,demographics:window.__qingming.demographics,calls:window.__qingming.calls,triangles:window.__qingming.triangles})));
 await writeFile(new URL('tests/world-obstacles.json',root),JSON.stringify(await page.evaluate(()=>window.__qingming.obstacles)));
 await page.getByRole('button',{name:'带上120文，出发',exact:true}).click();
 await page.keyboard.press('KeyE');
 await page.getByRole('button',{name:'显示完整字幕或继续',exact:true}).click();
 await page.getByRole('button',{name:'我来帮你绕开线',exact:true}).click();
 await page.getByRole('button',{name:'显示完整字幕或继续',exact:true}).click();
 await page.getByRole('button',{name:'先去玩具摊',exact:true}).click();
 await page.waitForFunction(()=>!window.__journey.route.length,null,{timeout:180000});
 console.log('at toys',await page.evaluate(()=>window.__journey));
 await page.screenshot({path:new URL('journey-preview.png',root).pathname,timeout:120000});
 await page.keyboard.press('KeyE');
 console.log('dialog',await page.getByRole('dialog').textContent());
 console.log('errors',errors);
}finally{await browser.close();}
