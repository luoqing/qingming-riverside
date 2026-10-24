import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,ignoreDefaultArgs:['--disable-dev-shm-usage'],args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800},ignoreHTTPSErrors:true});page.setDefaultTimeout(120000);
 await page.goto('https://littleprince.dev/',{waitUntil:'domcontentloaded',timeout:120000});
 console.log('START TEXT',await page.locator('body').innerText());await page.screenshot({path:new URL('../reference-start.png',import.meta.url).pathname,timeout:120000});
 const start=page.getByText(/点击.*开始旅程/);if(await start.count())await start.first().click();
 console.log('AFTER START',await page.locator('body').innerText());await page.screenshot({path:new URL('../reference-guide.png',import.meta.url).pathname,timeout:120000});
 console.log('INTERACTIVE',await page.locator('button,input').evaluateAll(es=>es.map(e=>({tag:e.tagName,text:e.textContent,placeholder:e.getAttribute('placeholder')}))));
}finally{await browser.close();}
