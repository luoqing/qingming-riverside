import {has,storyReady} from "./story.js";
import {HARBOR} from "./travel-data.js";
export function beginnerRoute(state) {
  return [
    {id:"meet",title:"认识阿芽",text:"走近虹桥南岸的小伙伴，按 E 交谈，帮她绕开纸鸢线。",done:has(state,"invited"),stops:[["aya","找阿芽"]]},
    {id:"drum",title:"和豆豆合奏",text:"背包里有拨浪鼓，可以直接和豆豆合奏；没有也没关系，豆豆会借你一面练习鼓。",done:has(state,"drum"),stops:[["doudou","找豆豆合奏"]]},
    {id:"flowers",title:"花娘 → 给花婆婆送花",text:"聊聊婆婆托的花，选淡粉海棠，带到北岸城门旁。花娘送的花不收钱。",done:has(state,"gift"),stops:[["flowers","找花娘"],["granny","找花婆婆"]]},
    {id:"bridge",title:"上虹桥，找一阵春风",text:"走上桥心，观察风向、试着放线。转不准时，可以请阿芽帮忙。",done:has(state,"ribbon"),stops:[["bridge","去虹桥看风"]]},
    {id:"boat",title:"汴河渡口 → 坐船吟诗",text:`找沈船娘上船，点“吟诗 / 记见闻”留下一句话，再回渡口。船费 ${HARBOR.fare} 文；钱不够可用见闻换船费。`,done:state.rides>0&&state.poems.length>0,stops:[["harbor","去汴河渡口"]]},
    {id:"finale",title:"春日游会 · 放飞纸鸢",text:storyReady(state)&&state.rides>0&&state.poems.length>0?"约定都做好啦！回渡口找船娘，和朋友一起把纸鸢放上天空。":"完成朋友的约定、乘船留下见闻，回渡口就能迎来最后的游会。",done:has(state,"finale"),stops:[["harbor","回渡口会合"]]},
  ];
}
