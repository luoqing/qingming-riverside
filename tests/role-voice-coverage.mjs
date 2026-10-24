import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {VENDORS,roleIdForSpeaker,voiceForRole} from "../src/travel-data.js";

const library=JSON.parse(readFileSync(new URL("../src/voice-library.json",import.meta.url)));
const roles={
  aya:{id:"aya",voice:"zh-CN-XiaoyiNeural",lines:[
    "哎，线又绕住啦！你能帮我拿一下线轴吗？先靠近一点，咱们一起把它绕开。",
    "豆豆想练鼓，花婆婆想看看春花。先逛哪边，你来挑！",
    "线理顺啦！我想把今天的汴京画在纸鸢上。你陪我去找找，好不好？",
    "纸鸢上已经有小鼓、春花、虹桥和汴河。今天走过的地方，都在上面啦！",
    "豆豆的鼓、婆婆的花、虹桥和汴河都画上去了。这次由你牵线，好不好？",
    "我想让今天的游会热闹一点！豆豆想摇鼓，花婆婆想看春花。你去虹桥找找风的方向，我去准备纸鸢。做哪件都行，我等你！",
  ]},
  doudou:{id:"doudou",voice:"zh-CN-YunxiaNeural",lines:[
    "我在家摇得可响了。一有人看，手就不听话。你愿意陪我练一小段吗？",
    "你来啦！我又学了一拍。游会时，你还站我旁边好不好？",
    "咚咚、咚咚！原来我也能跟上呀！游会的时候，你愿意站在我旁边吗？我送你一条红彩带，系在阿芽的纸鸢上！",
    "我带了两面练习鼓，这面先借给你！握住木柄，轻轻摇，我们一人一面。",
  ]},
  granny:{id:"granny",voice:"zh-CN-XiaoxiaoNeural",lines:[
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
  ]},
  flowers:{id:"flowers",voice:"zh-CN-XiaoxiaoNeural",lines:[
    "花没带到也不要紧，我再替你补一枝。",
    "婆婆想看淡粉的小花。这枝不收钱，你愿意替我送去吗？",
    "这枝淡粉海棠送给你，替我带给城门旁的花婆婆。送花不用赶时间。",
    "你选的这一枝也漂亮。婆婆说不定很喜欢，带去给她看看吧。",
    "婆婆已经收到你的心意啦，快去玩吧。",
    "没关系，再拿一枝海棠去吧。心意带到就好。",
  ]},
  toys:{id:"toys",voice:"zh-CN-YunxiNeural",lines:[
    "这面鼓借给你陪豆豆练练。握住木柄，轻轻转动，让两边的小球敲鼓面。想买别的小玩意，摊上随你挑！",
  ]},
  harbor:{id:"harbor",voice:"zh-CN-XiaoxiaoNeural",lines:[
    "桥上逛过了？要不要从桥底下再看一回？一圈约一分钟，船费十二文。没有船费也没关系，帮我记一句沿岸见闻就好。",
  ]},
  aboard:{id:"aboard",voice:"zh-CN-XiaoxiaoNeural",lines:[
    "今天最想记住什么？挑一句讲给我听吧。",
    "你把豆豆的鼓声也带上船啦。",
    "从桥上走过，又从桥下看过，这句话有你今天的脚步。",
    "这句是你的见闻，我替你收好。",
  ]},
};

for(const [name,role] of Object.entries(roles)){
  assert.equal(voiceForRole(role),role.voice,`${name} has the wrong character voice`);
  const missing=role.lines.filter(line=>!library[`${role.voice}|${line}`]);
  assert.deepEqual(missing,[],`${name} would fall back to device TTS: ${missing.join(" / ")}`);
}
assert.equal(voiceForRole({player:true,gender:"female"}),"zh-CN-XiaoyiNeural");
assert.equal(voiceForRole({player:true,gender:"male"}),"zh-CN-YunxiaNeural");
assert.equal(voiceForRole({player:true,gender:"female"},"male"),"zh-CN-YunxiaNeural");
assert.equal(voiceForRole({player:true,gender:"male"},"female"),"zh-CN-XiaoyiNeural");
assert.equal(roleIdForSpeaker("豆豆"),"doudou");
assert.equal(voiceForRole({id:roleIdForSpeaker("豆豆")}),"zh-CN-YunxiaNeural");
assert.equal(voiceForRole({speaker:"豆豆"}),"zh-CN-YunxiaNeural");
assert.equal(roleIdForSpeaker("花婆婆"),"granny");
assert.equal(roleIdForSpeaker("周货郎"),"toys");
for(const vendor of VENDORS){
  const expected=["tea","toys","books","buns","fruit"].includes(vendor.id)?"zh-CN-YunxiNeural":"zh-CN-XiaoxiaoNeural";
  assert.equal(voiceForRole({speaker:vendor.owner}),expected,`${vendor.owner} gender voice mismatch`);
  assert.ok(library[`${expected}|${vendor.greeting}`],`${vendor.owner} greeting would use device TTS`);
}

console.log("PASS: child, adult and elder character roles use matching embedded neural voices");
