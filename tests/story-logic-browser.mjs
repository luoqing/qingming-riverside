import {chromium} from "playwright";
import assert from "node:assert/strict";

const root=new URL("../",import.meta.url);
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,
  ignoreDefaultArgs:["--disable-dev-shm-usage"],args:["--no-sandbox","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
const errors=[];
const selectedCase=process.env.STORY_CASE||"all";
const seed=(position,money=120)=>({version:1,money,inventory:{},bargained:[],visited:[],journal:[],purchases:0,poems:[],rides:0,played:[],met:[],story:["invited"],avatar:"male",flowerChoice:"begonia",position,completed:false,learnedMovement:true});
async function open(saved){
  const page=await browser.newPage({viewport:{width:1000,height:760}});
  page.setDefaultTimeout(180000);
  page.on("pageerror",e=>errors.push(e.message));
  page.on("console",m=>{if(m.type()==="error")errors.push(m.text());});
  await page.addInitScript(value=>{
    localStorage.setItem("bianhe-spring-journey-v1",JSON.stringify(value));
    localStorage.setItem("bianhe-audio-v1",JSON.stringify({music:false,effects:false,voice:false,heroVoice:"auto"}));
  },saved);
  await page.goto(new URL("index.html",root).href,{waitUntil:"domcontentloaded",timeout:240000});
  await page.waitForFunction(()=>window.__qingming?.frames>1&&window.__journey?.heroModel.loaded.length===2,null,{timeout:240000});
  await page.getByRole("button",{name:"继续我的春游",exact:true}).click();
  return page;
}
async function reveal(page){for(let i=0;i<4;i++)await page.getByRole("button",{name:"显示完整字幕或继续",exact:true}).click({force:true});}

try{
  if(selectedCase==="all"||selectedCase==="doudou"){
    const page=await open(seed({x:2.2,z:13.5}));
    await page.keyboard.press("KeyE");await reveal(page);
    assert.equal(await page.getByRole("button",{name:"我和你一起摇",exact:true}).count(),0);
    await page.getByRole("button",{name:"借我一面鼓试试",exact:true}).click();
    await reveal(page);
    assert.equal((await page.evaluate(()=>window.__journey)).inventory.rattle,1);
    await page.getByRole("button",{name:"接过鼓，一起摇",exact:true}).click();
    assert.equal((await page.evaluate(()=>window.__journey)).held,"rattle");
    await page.screenshot({path:new URL("story-doudou-grip.png",root).pathname});
    await page.close();
  }

  if(selectedCase==="all"||selectedCase==="granny"){
    const page=await open(seed({x:11.8,z:-6.6}));
    await page.keyboard.press("KeyE");await reveal(page);
    assert.equal(await page.getByRole("button",{name:"把带来的花交给婆婆",exact:true}).count(),0);
    assert.equal(await page.getByRole("button",{name:"问问婆婆喜欢什么花",exact:true}).count(),1);
    await page.close();
  }

  if(selectedCase==="all"||selectedCase==="shop"){
    const page=await open(seed({x:.1,z:11.65},3));
    await page.keyboard.press("KeyE");await reveal(page);
    await page.getByRole("button",{name:"看看摊上的货",exact:true}).click();await reveal(page);
    await page.getByRole("button",{name:"问问这件多少钱",exact:true}).click();await reveal(page);
    const shortage=page.getByRole("button",{name:"铜钱不够，还差9文",exact:true});
    assert.equal(await shortage.isDisabled(),true);
    assert.match(await page.locator(".j-brand").innerText(),/铜钱 3 文/);
    assert.equal(await page.locator(".j-brand").isVisible(),true);
    await page.close();
  }

  assert.deepEqual(errors,[]);
  console.log("PASS: inventory-gated flower/drum story, Doudou lending, disabled unaffordable purchase and visible balance work in the real browser");
}finally{await browser.close();}
