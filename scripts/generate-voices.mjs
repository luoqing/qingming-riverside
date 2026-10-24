import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { VENDORS, vendorVoice } from "../src/travel-data.js";
import {newJourney,talk,buy,itemQuestion} from "../src/travel-state.js";
const root=new URL("../",import.meta.url), folder=new URL("src/voice-assets/",root);
await mkdir(folder,{recursive:true});
const jobs=[];
const spokenChoices={"我来帮你绕开线":"好呀！我来帮你绕开线。","我想自己探索":"嗯，我想先自己逛一逛！","我去找玩具摊":"哇，我想去找玩具摊！","先去闻闻点心香":"咦，好香呀！先去闻闻点心香。","我和你一起摇":"好呀！我和你一起摇。","便宜一点可以吗":"嗯……便宜一点，可以吗？","问问这件多少钱":"请问，这件多少钱呀？"};
const add=(text,voice="zh-CN-XiaoxiaoNeural",pitch="+0Hz",rate="+0%")=>jobs.push({text,voice,pitch,rate,spoken:spokenChoices[text]});
for (const v of VENDORS) add(v.greeting,["cakes","flowers","scents"].includes(v.id)?"zh-CN-XiaoxiaoNeural":"zh-CN-YunxiNeural");
for (const text of [
 "哎，线又绕住啦！你能帮我拿一下线轴吗？先靠近一点，咱们一起把它绕开。",
 "豆豆想练鼓，花婆婆想看看春花。先逛哪边，你来挑！",
 "线理顺啦！我想把今天的汴京画在纸鸢上。你陪我去找找，好不好？",
 "纸鸢上已经有小鼓、春花、虹桥和汴河。今天走过的地方，都在上面啦！",
 "豆豆的鼓、婆婆的花、虹桥和汴河都画上去了。这次由你牵线，好不好？",
 "我想让今天的游会热闹一点！豆豆想摇鼓，花婆婆想看春花。你去虹桥找找风的方向，我去准备纸鸢。做哪件都行，我等你！",
]) add(text,"zh-CN-XiaoyiNeural","+12Hz","+3%");
for (const text of [
 "我在家摇得可响了。一有人看，手就不听话。你愿意陪我练一小段吗？",
 "你来啦！我又学了一拍。游会时，你还站我旁边好不好？",
 "咚咚、咚咚！原来我也能跟上呀！游会的时候，你愿意站在我旁边吗？我送你一条红彩带，系在阿芽的纸鸢上！",
 "我带了两面练习鼓，这面先借给你！握住木柄，轻轻摇，我们一人一面。",
]) add(text,"zh-CN-YunxiaNeural","+5Hz","-3%");
for (const text of [
 "今天的风真好。花娘是不是托你捎了什么？",
 "花还好好开着。你们玩得开心，我坐在这里也跟着开心。",
 "我小时候也常把线绕成一团。别着急，慢慢放，总能飞起来。",
 "我和哥哥小时候，谁也不肯先放手。后来一个牵线，一个举纸鸢，才飞得稳。你和阿芽也要商量好。",
 "今日日头暖，坐下来陪我看看街上的人吧。",
 "我喜欢淡粉海棠。花娘在虹桥南岸，她若知道是给我看的，准会替你挑一枝。",
 "花娘托你带花了吗？去听听她的花谜吧，她会送你一枝。已经用掉也没关系，告诉花娘，她会帮忙。",
 "这海棠和我小时候院子里的一个颜色。这条布带以前系在我的纸鸢上，给它找个新地方吧。再拿20文买点心，玩累了就歇歇。",
 "这牡丹让我也神气一回！这条布带以前系在我的纸鸢上，给它找个新地方吧。再拿20文买点心，玩累了就歇歇。",
 "这柳枝嫩得像我小时候放纸鸢的那个春天。这条布带以前系在我的纸鸢上，给它找个新地方吧。再拿20文买点心，玩累了就歇歇。",
])
 add(text,"zh-CN-XiaoxiaoNeural","-8Hz","-12%");
for (const text of [
 "花没带到也不要紧，我再替你补一枝。",
 "婆婆想看淡粉的小花。这枝不收钱，你愿意替我送去吗？",
 "这枝淡粉海棠送给你，替我带给城门旁的花婆婆。送花不用赶时间。",
 "你选的这一枝也漂亮。婆婆说不定很喜欢，带去给她看看吧。",
 "婆婆已经收到你的心意啦，快去玩吧。",
 "没关系，再拿一枝海棠去吧。心意带到就好。",
]) add(text,"zh-CN-XiaoxiaoNeural");
add("这面鼓借给你陪豆豆练练。握住木柄，轻轻转动，让两边的小球敲鼓面。想买别的小玩意，摊上随你挑！","zh-CN-YunxiNeural");
for (const text of [
 "桥上逛过了？要不要从桥底下再看一回？一圈约一分钟，船费十二文。没有船费也没关系，帮我记一句沿岸见闻就好。",
 "今天最想记住什么？挑一句讲给我听吧。",
 "你把豆豆的鼓声也带上船啦。",
 "从桥上走过，又从桥下看过，这句话有你今天的脚步。",
 "这句是你的见闻，我替你收好。",
]) add(text,"zh-CN-XiaoxiaoNeural");
for (const text of ["先聊聊也好。想问什么？","挑一件看看，想买再确认。也可以先试一试小玩具。"])
 for (const voice of ["zh-CN-XiaoxiaoNeural","zh-CN-YunxiNeural"]) add(text,voice);
const source=await readFile(new URL("src/journey.js",root),"utf8");
// Most replies are literal labels. The remaining ones are built from runtime
// state (ternaries or arrays), so keep their possible spoken values here too.
const dynamicChoiceLines=[
 "接着逛","记住啦","给我指下一站","一起看看纸鸢",
 "付12文，坐船游览","用见闻换这一趟船费",
 "我在虹桥看见大船。","我和豆豆把小鼓摇响了。","汴河的春风吹过我的衣袖。",
];
const labels=[...new Set([
 ...source.matchAll(/label:\s*"([^"\n]+)"/g),
].map(m=>m[1]).concat(dynamicChoiceLines))];
for (const text of labels) for (const voice of ["zh-CN-XiaoyiNeural","zh-CN-YunxiaNeural"])
 add(text,voice,"+5Hz","+2%");
// Generate from the same templates and prices as gameplay. No dependence on
// the visitor's installed speech voices for shopping or selected-item questions.
for(const vendor of VENDORS)for(const item of vendor.items){
 const voice=vendorVoice(vendor.id);
 add(item.description,voice);
 for(const discounted of [false,true]){
  const state=newJourney();if(discounted)state.bargained.push(vendor.id);
  add(talk(state,vendor.id,"这件多少钱？",item.id).text,voice);
  add(buy(state,vendor.id,item.id,1).text,voice);
  state.money=0;
  add(buy(state,vendor.id,item.id,1).text,voice);
 }
 const state=newJourney();
 add(talk(state,vendor.id,"便宜一点可以吗？",item.id).text,voice);
 add(talk(state,vendor.id,"便宜一点可以吗？",item.id).text,voice);
 for(const voice of ["zh-CN-XiaoyiNeural","zh-CN-YunxiaNeural"])
  add(itemQuestion(item),voice,"+5Hz","+2%");
}
for(const voice of ["zh-CN-XiaoyiNeural","zh-CN-YunxiaNeural"])
 add("谢谢，再见",voice,"+5Hz","+2%");
const library={};
let index=0;
async function worker() {
 while (index<jobs.length) {
  const job=jobs[index++], id=createHash("sha1").update(job.voice+job.text+(job.spoken||"")).digest("hex").slice(0,16), file=new URL(id+".mp3",folder);
  let bytes;
  try {bytes=await readFile(file);if(bytes.length<100)throw new Error("Incomplete cached clip");} catch {
   for(let attempt=0;attempt<2;attempt++){
   await new Promise((resolve,reject)=>{
    const p=spawn("uvx",["edge-tts","--text",job.spoken||job.text,"--voice",job.voice,"--pitch="+job.pitch,"--rate="+job.rate,"--write-media",file.pathname],{stdio:["ignore","ignore","pipe"],timeout:90000});
    let error="";p.stderr.on("data",x=>error+=x);p.on("error",reject);p.on("exit",code=>code===0?resolve():reject(new Error(error.slice(-300))));
   }); bytes=await readFile(file);
   if(bytes.length>=100)break;
   }
  }
  if (bytes.length<100) throw new Error(`Empty voice clip: ${job.voice} / ${job.text}`);
  library[job.voice+"|"+job.text]="data:audio/mpeg;base64,"+bytes.toString("base64");
  console.log("voice",Object.keys(library).length,"/",jobs.length,job.voice);
 }
}
await Promise.all([worker(),worker(),worker()]);
await writeFile(new URL("src/voice-library.json",root),JSON.stringify(library));
console.log("Embedded",Object.keys(library).length,"neural voice clips; dynamic replies use device TTS when available.");
