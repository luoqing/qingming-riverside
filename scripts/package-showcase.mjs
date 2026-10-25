import { readFile, writeFile, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const root = new URL("../", import.meta.url);
const source = new URL("recordings/showcase/", root);
const output = new URL("docs/media/", root);
const work = new URL("recordings/showcase/edit/", root);
await mkdir(output, { recursive: true });
await mkdir(work, { recursive: true });
const ffmpeg = args => new Promise((resolve, reject) => {
  const child = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });
  child.on("error", reject);
  child.on("exit", code => code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)));
});
const ffprobe = file => new Promise((resolve, reject) => {
  let text = "";
  const child = spawn("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file]);
  child.stdout.on("data", chunk => text += chunk);
  child.on("error", reject);
  child.on("exit", code => code === 0 ? resolve(Number(text.trim())) : reject(new Error(`ffprobe exited ${code}`)));
});
const panorama = [
  ["panorama-raw.webm", 68, 27, 3, "汴河全卷 · 一城春色"],
  ["panorama-raw.webm", 110, 34, 4, "虹桥 · 桥上行人，桥下行船"],
  ["panorama-raw.webm", 153, 42, 5, "河埠 · 沿岸街市与篷船"],
  ["panorama-raw.webm", 205, 33, 4, "城阙 · 城门与古塔"],
  ["panorama-raw.webm", 244, 22, 3, "回望全卷 · 汴河仍在流动"],
];
const game = [
  ["game-raw.webm", 153, 30, 3, "出发 · 与阿芽约好春日游会"],
  ["game-raw.webm", 345, 40, 4, "集市 · 阿杏的糕饼铺"],
  ["game-raw.webm", 800, 50, 4, "玩具摊 · 看货、问价、还价"],
  ["game-raw.webm", 878, 44, 4, "确认购买 · 把拨浪鼓带在身边"],
  ["game-raw.webm", 1020, 83, 5, "豆豆 · 一起摇响小鼓"],
  ["game-raw.webm", 1275, 63, 4, "鲜花摊 · 为花婆婆挑一枝海棠"],
  ["game-raw.webm", 1460, 46, 4, "虹桥 · 上桥看风与汴河"],
  ["game-raw.webm", 1770, 53, 4, "花婆婆 · 把春花送给她"],
  ["game-tail-raw.webm", 1160, 65, 5, "下桥到渡口 · 向沈船娘买船票"],
  ["game-tail-raw.webm", 1230, 82, 5, "乘船 · 从虹桥下穿过"],
  ["game-tail-raw.webm", 1320, 79, 5, "吟诗 · 记下今天的见闻"],
  ["game-tail-raw.webm", 1445, 14, 2, "归岸 · 与阿芽一起回到渡口"],
  ["game-finale-raw.webm", 1350, 11, 1, "结尾 · 放飞纸鸢，完成春日游会"],
];
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1120, height: 48 }, deviceScaleFactor: 1 });
async function caption(title, width, path, speed) {
  await page.setViewportSize({ width, height: 48 });
  await page.setContent(`<html lang="zh-CN"><meta charset="utf-8"><style>body{box-sizing:border-box;margin:0;height:48px;display:flex;align-items:center;justify-content:space-between;padding:0 22px;background:#27251e;color:#fff5dc;font:20px "Noto Sans CJK SC",sans-serif;letter-spacing:.04em}small{font:13px "Noto Sans CJK SC",sans-serif;color:#d9c5a2}</style><span>${title}</span><small>实机录制 · ${speed} 倍速</small></html>`);
  await page.screenshot({ path });
}
function music(duration, file) {
  const sampleRate = 24000, count = Math.ceil(duration * sampleRate);
  const wav = Buffer.alloc(44 + count * 2);
  wav.write("RIFF", 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(count * 2, 40);
  const melody = [293.66, 0, 349.23, 392, 0, 523.25, 440, 0, 392, 349.23, 0, 293.66, 261.63, 0, 293.66, 0];
  for (let i = 0; i < count; i++) {
    const time = i / sampleRate;
    let value = 0;
    for (let back = 0; back < 3; back++) {
      const n = Math.floor(time / 0.85) - back, frequency = melody[((n % melody.length) + melody.length) % melody.length];
      const age = time - n * 0.85;
      if (!frequency || n < 0 || age > 2.1) continue;
      const envelope = (1 - Math.exp(-age * 75)) * Math.exp(-age * 2.7);
      value += envelope * (Math.sin(2 * Math.PI * frequency * age) + 0.18 * Math.sin(4 * Math.PI * frequency * age)) * 0.17;
    }
    const fade = Math.min(1, time / 1.5, (duration - time) / 2);
    wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, value * fade)) * 32767), 44 + i * 2);
  }
  return writeFile(file, wav);
}
async function make(name, clips, width, height) {
  const files = [];
  for (let i = 0; i < clips.length; i++) {
    const [sourceName, start, length, speed, title] = clips[i];
    const titleFile = new URL(`${name}-${i}.png`, work).pathname;
    const segment = new URL(`${name}-${i}.mp4`, work).pathname;
    await caption(title, width, titleFile, speed);
    await ffmpeg(["-ss", String(start), "-t", String(length), "-i", new URL(sourceName, source).pathname,
      "-loop", "1", "-i", titleFile,
      "-filter_complex", `[0:v]setpts=(PTS-STARTPTS)/${speed},fps=24,pad=iw:ih+48:0:48:color=0x27251e[v];[v][1:v]overlay=0:0:shortest=1[out]`,
      "-map", "[out]", "-t", String(length / speed), "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-pix_fmt", "yuv420p", "-threads", "3", segment]);
    files.push(segment);
    console.log(`${name} ${i + 1}/${clips.length}: ${title}`);
  }
  const list = new URL(`${name}-concat.txt`, work).pathname;
  await writeFile(list, files.map(file => `file '${file}'`).join("\n"));
  const silent = new URL(`${name}-silent.mp4`, work).pathname;
  await ffmpeg(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", silent]);
  const duration = await ffprobe(silent);
  const wav = new URL(`${name}-music.wav`, work).pathname;
  await music(duration, wav);
  const final = new URL(`${name}-showcase.mp4`, output).pathname;
  await ffmpeg(["-i", silent, "-i", wav, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "96k", "-shortest", "-movflags", "+faststart", final]);
  const preview = new URL(`${name}-showcase.gif`, output).pathname;
  await ffmpeg(["-ss", name === "panorama" ? "9" : "22", "-t", "6", "-i", final,
    "-filter_complex", "[0:v]fps=8,scale=480:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=4[v]",
    "-map", "[v]", "-loop", "0", preview]);
  console.log(`${name} done: ${duration.toFixed(1)}s`);
}
try {
  if ((process.argv[2] || "all") !== "game") await make("panorama", panorama, 960, 620);
  if ((process.argv[2] || "all") !== "panorama") await make("journey", game, 1120, 720);
} finally {
  await browser.close();
}
