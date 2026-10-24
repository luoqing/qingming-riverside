import {readFile,writeFile} from "node:fs/promises";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {chromium} from "playwright";
const exec=promisify(execFile),folder=new URL("../recordings/",import.meta.url);
const report=JSON.parse(await readFile(new URL("crowd-browser.json",folder),"utf8"));
if(report.failure || report.checks.length!==4)throw new Error("Only package a completed four-mode browser check");
const source=new URL("crowd-overview-game-raw.webm",folder).pathname;
const {stdout}=await exec("ffprobe",["-v","error","-show_entries","format=duration","-of","json",source]);
const duration=Number(JSON.parse(stdout).format.duration),offset=duration-report.wallSeconds;
const start=Math.max(0,report.chapters[0].seconds+offset-1);
const end=Math.min(duration,report.end+offset);
const speed=4,caption=new URL("crowd-caption.png",folder).pathname;
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:["--no-sandbox"]});
try{
 const page=await browser.newPage({viewport:{width:960,height:40}});
 await page.setContent('<html lang="zh-CN"><style>body{margin:0;background:#282820;color:#fff2d5;font:18px "Noto Serif CJK SC",serif;padding:8px 16px;white-space:nowrap}</style>全卷 → 虹桥 → 游戏 → 回全卷　·　4 倍速　·　无声实录</html>');
 await page.screenshot({path:caption});
}finally{await browser.close();}
const output=new URL("crowd-overview-game.mp4",folder).pathname;
await exec("ffmpeg",["-nostdin","-n","-ss",String(start),"-i",source,"-loop","1","-i",caption,
 "-t",String((end-start)/speed),"-filter_complex",`[0:v]setpts=(PTS-STARTPTS)/${speed},fps=25,pad=iw:ih+40:0:40:color=0x282820[v];[v][1:v]overlay=0:0:shortest=1[out]`,
 "-map","[out]","-an","-c:v","libx264","-preset","fast","-crf","22","-profile:v","baseline","-level","3.1",
 "-pix_fmt","yuv420p","-threads","2","-movflags","+faststart",output],{maxBuffer:2*1024*1024});
await writeFile(new URL("crowd-video-manifest.json",folder),JSON.stringify({source,start,end,speed,audio:false,
 kind:"actual native browser recording, no generated gameplay",output,chapters:report.chapters},null,2));
console.log("Saved",output);
