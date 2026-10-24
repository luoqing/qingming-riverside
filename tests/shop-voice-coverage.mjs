import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {VENDORS} from "../src/travel-data.js";
import {newJourney,talk,buy,priceFor} from "../src/travel-state.js";
const library=JSON.parse(readFileSync(new URL("../src/voice-library.json",import.meta.url)));
let checked=0;
for(const vendor of VENDORS)for(const item of vendor.items){
 const voice=["tea","toys","books","buns","fruit"].includes(vendor.id)?"zh-CN-YunxiNeural":"zh-CN-XiaoxiaoNeural";
 for(const discounted of [false,true]){
  const state=newJourney();if(discounted)state.bargained.push(vendor.id);
  const money=state.money,quote=talk(state,vendor.id,"这件多少钱？",item.id);
  assert.equal(state.money,money,"Asking never charges money");
  assert.ok(quote.text.includes(item.name) && quote.text.includes(`${priceFor(state,vendor,item)}文`));
  assert.ok(library[voice+"|"+quote.text],`Missing real quote audio: ${vendor.id}/${item.id}/${discounted}`);
  const receipt=buy(state,vendor.id,item.id,1);
  assert.ok(receipt.ok && library[voice+"|"+receipt.text],`Missing purchase receipt audio: ${vendor.id}/${item.id}/${discounted}`);
  state.money=0;
  const declined=buy(state,vendor.id,item.id,1);
  assert.ok(!declined.ok && library[voice+"|"+declined.text],`Missing insufficient-money reply: ${vendor.id}/${item.id}/${discounted}`);
  checked+=3;
 }
 for(const voice of ["zh-CN-XiaoyiNeural","zh-CN-YunxiaNeural"]){
  assert.ok(library[voice+"|"+`${item.name}多少钱呀？`],`Missing selected-item question audio: ${voice}/${item.id}`);checked++;
 }
 assert.ok(library[voice+"|"+item.description],`Missing browse audio: ${item.id}`);checked++;
 const bargainState=newJourney();
 for(let attempt=0;attempt<2;attempt++){
  const reply=talk(bargainState,vendor.id,"便宜一点可以吗？",item.id);
  assert.ok(library[voice+"|"+reply.text],`Missing bargain audio: ${item.id}/${attempt}`);checked++;
 }
}
console.log(`PASS: ${checked} selected-item questions, quotes and purchase receipts have real audio across all stalls and prices`);
