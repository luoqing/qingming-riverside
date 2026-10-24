import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const root=new URL("../",import.meta.url);
const source=readFileSync(new URL("src/journey.js",root),"utf8");
const library=JSON.parse(readFileSync(new URL("src/voice-library.json",root),"utf8"));
const dynamicChoiceLines=[
  "接着逛","记住啦","给我指下一站","一起看看纸鸢",
  "付12文，坐船游览","用见闻换这一趟船费",
  "我在虹桥看见大船。","我和豆豆把小鼓摇响了。","汴河的春风吹过我的衣袖。",
];
const lines=[...new Set([
  ...[...source.matchAll(/label:\s*"([^"\n]+)"/g)].map(match=>match[1]),
  ...dynamicChoiceLines,
])];

for(const voice of ["zh-CN-XiaoyiNeural","zh-CN-YunxiaNeural"]){
  const missing=lines.filter(line=>!library[`${voice}|${line}`]);
  assert.deepEqual(missing,[],`${voice} is missing player lines: ${missing.join(" / ")}`);
}

console.log(`PASS: ${lines.length} player replies have both girl and boy neural voice clips`);
