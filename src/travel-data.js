import {riverCenter,riverWidth} from './paths.js';

export const VENDORS = [
 {id:'tea',name:'陆翁茶摊',owner:'陆翁',category:'茶饮',kind:'tea',x:-12,z:9.5,w:3.3,d:2,color:'#9b805b',greeting:'客官走累了吧？新煎的春茶，坐一坐，歇歇脚。',items:[
  {id:'spring-tea',name:'清明春茶',price:8,type:'food',energy:28,description:'一盏清茶，回甘生津，恢复28点体力。'},
  {id:'osmanthus-tea',name:'花香茶',price:12,type:'food',energy:42,description:'茶汤温热，花香清浅，恢复42点体力。'},
  {id:'tea-cup',name:'青瓷茶盏',price:20,type:'souvenir',description:'把这盏汴京的茶色带回家。'},
 ]},
 {id:'cakes',name:'阿杏糕饼铺',owner:'阿杏',category:'糕饼',kind:'cakes',x:-16.2,z:9.8,w:3.2,d:2,color:'#b39970',greeting:'刚出炉的芝麻饼，还有软糯枣糕。先闻一闻，是不是很香？',items:[
  {id:'sesame-cake',name:'芝麻饼',price:4,type:'food',energy:20,description:'边缘酥脆，满口芝麻香，恢复20点体力。'},
  {id:'date-cake',name:'枣糕',price:6,type:'food',energy:32,description:'甜糯绵软，适合边走边吃，恢复32点体力。'},
  {id:'candied-fruit',name:'蜜饯',price:5,type:'food',energy:24,description:'小纸包里藏着酸甜滋味，恢复24点体力。'},
 ]},
 {id:'flowers',name:'花娘鲜花摊',owner:'花娘',category:'鲜花',kind:'flowers',x:-11.1,z:13.4,w:3,d:1.9,color:'#aa7f79',greeting:'春日的花只开这一阵。客官喜欢海棠，还是想挑一枝牡丹？',items:[
  {id:'begonia',name:'海棠花',price:12,type:'flower',color:'#dd8192',description:'淡粉海棠，可以拿在手里游览。'},
  {id:'peony',name:'牡丹花',price:18,type:'flower',color:'#b74d71',description:'一枝浓艳春色，可以手持赏玩。'},
  {id:'willow-sprig',name:'柳枝',price:3,type:'flower',color:'#7e9d59',description:'一把新绿，拂过衣袖，也是一份春日纪念。'},
 ]},
 {id:'toys',name:'周货郎玩具摊',owner:'周货郎',category:'小玩具',kind:'toys',x:.1,z:10,w:3.1,d:2.1,color:'#9d5945',greeting:'拨浪鼓、竹蜻蜓、小纸鸢！买了还能把玩，大人也不妨开心一回。',items:[
  {id:'rattle',name:'拨浪鼓',price:12,type:'toy',toy:'rattle',description:'拿在手里，点“摇一摇”，小球会敲响鼓面。'},
  {id:'dragonfly',name:'竹蜻蜓',price:8,type:'toy',toy:'dragonfly',description:'搓一搓竹柄，看它旋转着飞起来。'},
  {id:'kite',name:'纸鸢',price:18,type:'toy',toy:'kite',description:'迎风放一只小纸鸢，走到哪里，春风就跟到哪里。'},
 ]},
 {id:'books',name:'墨客书画摊',owner:'林书生',category:'书画',kind:'books',x:4.5,z:10,w:3.2,d:2.1,color:'#7b8271',greeting:'一张小画，收尽汴京烟火。若有诗兴，也可带几张诗笺上船。',items:[
  {id:'poem-paper',name:'诗笺',price:6,type:'souvenir',description:'留白待君题，可以带上船写进游记。'},
  {id:'river-painting',name:'汴河小画',price:20,type:'souvenir',description:'桥与舟都在画中，展开便想起这趟旅行。'},
  {id:'travel-map',name:'汴京游览图',price:10,type:'map',description:'随时打开地图，给想去的摊位或景点做个记号。'},
 ]},
 {id:'scents',name:'芸娘香草摊',owner:'芸娘',category:'香草手作',kind:'scents',x:8.7,z:-6.2,w:2.7,d:1.7,color:'#76826a',greeting:'艾草清香，香囊都是我亲手缝的。走一日路，也把好心情带在身边。',items:[
  {id:'sachet',name:'艾草香囊',price:10,type:'souvenir',description:'一针一线的手作，淡淡艾香留在背包里。'},
  {id:'bamboo-fan',name:'竹扇',price:8,type:'souvenir',description:'轻巧竹扇，收下一阵汴河清风。'},
  {id:'herb-bundle',name:'香草小束',price:5,type:'souvenir',description:'麻绳扎起的香草，是一份朴素心意。'},
 ]},
 {id:'buns',name:'王记蒸食摊',owner:'王掌柜',category:'热食',kind:'buns',x:20.2,z:-6.5,w:2.6,d:1.6,color:'#a08a66',greeting:'热包子出笼喽！逛到城门前，总该好好吃一顿。',items:[
  {id:'meat-bun',name:'肉包',price:5,type:'food',energy:30,description:'热气腾腾，饱满多汁，恢复30点体力。'},
  {id:'vegetable-bun',name:'菜包',price:3,type:'food',energy:18,description:'清鲜不腻，恢复18点体力。'},
  {id:'bean-soup',name:'绿豆汤',price:7,type:'food',energy:38,description:'一碗清甜，恢复38点体力。'},
 ]},
 {id:'fruit',name:'赵伯果蔬摊',owner:'赵伯',category:'果蔬',kind:'fruit',x:-27,z:-8.2,w:2.7,d:.9,color:'#918a56',greeting:'桃子、杏子，都是今晨挑来的。挑几个带上路吧。',items:[
  {id:'peach',name:'桃子',price:4,type:'food',energy:20,description:'果香清甜，恢复20点体力。'},
  {id:'apricot',name:'杏子',price:5,type:'food',energy:26,description:'酸甜适口，恢复26点体力。'},
  {id:'water-chestnut',name:'菱角',price:6,type:'food',energy:30,description:'一小袋水乡滋味，恢复30点体力。'},
 ]},
];
export const ITEM_CATALOG=Object.fromEntries(VENDORS.flatMap(v=>v.items.map(item=>[item.id,{...item,vendorId:v.id}])));
export const vendorVoice=id=>["tea","toys","books","buns","fruit"].includes(id)?"zh-CN-YunxiNeural":"zh-CN-XiaoxiaoNeural";
const SPEAKER_ROLE_IDS={...Object.fromEntries(VENDORS.map(v=>[v.owner,v.id])),阿芽:"aya",豆豆:"doudou",花婆婆:"granny",沈船娘:"harbor"};
export function voiceForRole(role={}, heroVoice="auto") {
 const heroGender=heroVoice==="auto" ? role.gender : heroVoice;
 if(role.player)return heroGender==="male"?"zh-CN-YunxiaNeural":"zh-CN-XiaoyiNeural";
 const id=role.id||SPEAKER_ROLE_IDS[role.speaker];
 if(id==="doudou")return "zh-CN-YunxiaNeural";
 if(id==="aya")return "zh-CN-XiaoyiNeural";
 return vendorVoice(id);
}
export const roleIdForSpeaker=(speaker,fallback)=>SPEAKER_ROLE_IDS[speaker]||fallback;
export const HARBOR={id:'harbor',name:'汴河渡口',x:-25,z:riverCenter(-25)+riverWidth(-25)+1.15,fare:12};
export const SIGHTS=[
 {id:'bridge',name:'虹桥',x:-5,z:0,radius:2.1,text:'木拱层层相扣，桥上是赶路的人，桥下是缓行的舟。站在桥心，汴京的烟火尽收眼底。'},
 {id:'gate',name:'汴京城阙',x:14,z:-9.3,radius:2.3,text:'城门里外，南来北往。穿过门洞，背街的院落又是一重风景。'},
 {id:'pagoda',name:'古塔',x:30.6,z:-15.1,radius:2.7,text:'层檐向上，风过塔尖。逛过热闹街市，再在古塔旁安静片刻。'},
];
export const POEMS=[
 {title:'虹桥春行',lines:'一桥春色连烟火，满载清风过汴河。'},
 {title:'舟中偶题',lines:'船摇一水天光碎，柳拂两堤市语轻。'},
 {title:'汴京小记',lines:'买得春花簪客袖，又随舟楫入城来。'},
];
