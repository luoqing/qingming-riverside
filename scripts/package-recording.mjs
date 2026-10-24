import {readFile,writeFile,mkdir} from "node:fs/promises";
import {spawn,execFile} from "node:child_process";
import {chromium} from "playwright";
const folder=new URL("../recordings/",import.meta.url);
const run=args=>new Promise((resolve,reject)=>{
 const child=spawn("ffmpeg",["-hide_banner","-loglevel","warning",...args],{stdio:["ignore","inherit","inherit"]});
 child.on("error",reject);child.on("exit",code=>code===0?resolve():reject(new Error("ffmpeg exited "+code)));
});
const decorate=(speed=1)=>`[0:v]setpts=(PTS-STARTPTS)/${speed},fps=25,pad=iw:ih+40:0:40:color=0x282820[v];[v][1:v]overlay=0:0:shortest=1[out]`;
const validVideo=file=>new Promise(resolve=>execFile("ffprobe",["-v","error","-show_entries","format=duration","-of","json",file],(error,stdout)=>{
 try{resolve(!error && Number(JSON.parse(stdout).format.duration)>.2);}catch{resolve(false);}
}));
const encode=["-an","-c:v","libx264","-preset","fast","-crf","22","-pix_fmt","yuv420p","-threads","2","-movflags","+faststart"];
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:["--no-sandbox"]});
const page=await browser.newPage({viewport:{width:960,height:40},deviceScaleFactor:1});
async function caption(text,file) {
 const escaped=text.replaceAll("&","&amp;").replaceAll("<","&lt;");
 await page.setContent(`<html lang="zh-CN"><style>body{margin:0;background:#282820;color:#fff2d5;font:18px 'Noto Serif CJK SC',serif;padding:8px 16px;white-space:nowrap}</style>${escaped}</html>`);
 await page.screenshot({path:file});
}
try {
const running=JSON.parse(await readFile(new URL("running-session.json",folder),"utf8"));
const runCaption=new URL("running-caption.png",folder).pathname;
await caption("屈膝跑步 · 男女主角侧面检查 · 原速无声录屏",runCaption);
await run(["-y","-ss",String(running.start),"-i",new URL("running-raw.webm",folder).pathname,
 "-loop","1","-i",runCaption,"-t",String(running.end-running.start),"-filter_complex",decorate(),"-map","[out]",...encode,new URL("running.mp4",folder).pathname]);
if(process.argv.includes("--running-only")){await browser.close();process.exit(0);}
const report=JSON.parse(await readFile(new URL("gameplay-session.json",folder),"utf8"));
if(report.failure)throw new Error("Incomplete gameplay recording: "+report.failure);
await mkdir(new URL("segments/",folder),{recursive:true});
const manifest=[];
for(let i=0;i<report.chapters.length-1;i++){
 const chapter=report.chapters[i],end=report.chapters[i+1].seconds,duration=end-chapter.seconds;
 if(duration<.2)continue;
 const speed=duration>36 ? 3 : duration>20 ? 2 : 1;
 const file=new URL(`segments/${String(i).padStart(2,"0")}.mp4`,folder);
 const labelFile=new URL(`segments/${String(i).padStart(2,"0")}.png`,folder).pathname;
 const label=`${chapter.title} · ${speed===1 ? "原速" : speed+"倍速"} · 无声实录`;
 await caption(label,labelFile);
 if(!process.argv.includes("--resume") || !await validVideo(file.pathname)) await run(["-y","-ss",String(chapter.seconds),"-i",new URL("gameplay-raw.webm",folder).pathname,
  "-loop","1","-i",labelFile,"-t",String(duration/speed),"-filter_complex",decorate(speed),"-map","[out]",...encode,file.pathname]);
 manifest.push({title:chapter.title,sourceStart:chapter.seconds,sourceEnd:end,speed,file:file.pathname});
}
const list=new URL("segments/concat.txt",folder);
await writeFile(list,manifest.map(s=>`file '${s.file}'`).join("\n"));
await run(["-y","-f","concat","-safe","0","-i",list.pathname,"-c","copy","-movflags","+faststart",new URL("gameplay.mp4",folder).pathname]);
await writeFile(new URL("video-manifest.json",folder),JSON.stringify({source:"Actual Playwright browser screen recording; no generated frames or synthetic gameplay",audio:false,chapters:manifest},null,2));
console.log("Saved gameplay.mp4 and running.mp4");
} finally {await browser.close();}
