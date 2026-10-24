import { VENDORS, ITEM_CATALOG, SIGHTS } from "./travel-data.js";

export function newJourney() {
  return {
    version: 1,
    money: 120,
    inventory: {},
    bargained: [],
    visited: [],
    journal: [],
    purchases: 0,
    poems: [],
    rides: 0,
    played: [],
    met: [],
    story: [],
    avatar: "female",
    flowerChoice: "begonia",
    position: { x: -6.7, z: 11.7 },
    completed: false,
    learnedMovement: false,
  };
}
export function restoreJourney(value) {
  const state = newJourney();
  if (!value || value.version !== 1) return state;
  if (Number.isInteger(value.money) && value.money >= 0 && value.money < 100000)
    state.money = value.money;
  for (const [id, count] of Object.entries(value.inventory || {}))
    if (
      Object.hasOwn(ITEM_CATALOG, id) &&
      Number.isInteger(count) &&
      count > 0 &&
      count < 1000
    )
      state.inventory[id] = count;
  for (const key of ["bargained", "visited", "played"])
    state[key] = Array.isArray(value[key])
      ? value[key].filter((v) => typeof v === "string").slice(0, 50)
      : [];
  state.story = Array.isArray(value.story)
    ? value.story.filter((v) =>
        [
          "invited",
          "flower",
          "loan",
          "drum",
          "ribbon",
          "gift",
          "finale",
        ].includes(v),
      )
    : [];
  state.journal = Array.isArray(value.journal)
    ? value.journal
        .filter((v) => typeof v === "string")
        .map((v) => v.slice(0, 180))
        .slice(-80)
    : [];
  state.poems = Array.isArray(value.poems)
    ? value.poems
        .filter((v) => typeof v === "string")
        .map((v) => v.slice(0, 100))
        .slice(-20)
    : [];
  for (const key of ["purchases", "rides"])
    if (Number.isInteger(value[key]) && value[key] >= 0)
      state[key] = Math.min(value[key], 10000);
  if (
    Number.isFinite(value.position?.x) &&
    Number.isFinite(value.position?.z) &&
    Math.abs(value.position.x) < 39 &&
    Math.abs(value.position.z) < 19
  )
    state.position = { x: value.position.x, z: value.position.z };
  state.completed = Boolean(value.completed);
  state.met = Array.isArray(value.met)
    ? value.met.filter((id) => VENDORS.some((v) => v.id === id))
    : [];
  state.avatar = value.avatar === "male" ? "male" : "female";
  state.learnedMovement = value.learnedMovement === true || state.story.length > 0 || state.met.length > 0;
  if (["begonia", "peony", "willow-sprig"].includes(value.flowerChoice))
    state.flowerChoice = value.flowerChoice;
  return state;
}
export function priceFor(state, vendor, item) {
  return Math.max(
    1,
    Math.round(item.price * (state.bargained.includes(vendor.id) ? 0.85 : 1)),
  );
}
export const itemQuestion = item => `${item.name}多少钱呀？`;
export function buy(state, vendorId, itemId, count = 1) {
  const vendor = VENDORS.find((v) => v.id === vendorId),
    item = vendor?.items.find((v) => v.id === itemId);
  if (!item || !Number.isInteger(count) || count < 1 || count > 5)
    return { ok: false, text: "先挑一件摊上的货物吧。" };
  const total = priceFor(state, vendor, item) * count;
  if (state.money < total)
    return {
      ok: false,
      text: `${item.name}要${total}文，铜钱还不够呢。先看看别的，也欢迎再来。`,
    };
  state.money -= total;
  state.inventory[item.id] = (state.inventory[item.id] || 0) + count;
  state.purchases += count;
  state.journal.push(
    `在${vendor.name}花${total}文买下${item.name}${count > 1 ? `×${count}` : ""}。`,
  );
  return {
    ok: true,
    item,
    total,
    text: `好嘞，${item.name}${count > 1 ? `，一共${count}份` : ""}，收你${total}文。已经放进背包了，客官慢走！`,
  };
}
export function talk(state, vendorId, input, selectedId) {
  const vendor = VENDORS.find((v) => v.id === vendorId);
  if (!vendor) return { text: "不远处还有许多摊位，过去瞧瞧吧。" };
  const text = String(input).trim().slice(0, 140);
  const item =
    vendor.items.find(
      (i) =>
        text.includes(i.name) ||
        text.includes(i.name.replace(/[花子盏笺]$/, "")),
    ) ||
    vendor.items.find((i) => i.id === selectedId) ||
    vendor.items[0];
  if (/便宜|还价|少点|打折|优惠|贵了|讲价/.test(text)) {
    if (state.bargained.includes(vendor.id))
      return {
        text: `已经是给你的实在价啦。${item.name}${priceFor(state, vendor, item)}文，再少可要亏本了。`,
      };
    state.bargained.push(vendor.id);
    return {
      text: `看你一路风尘，就给你让一让。摊上都算个熟客价，${item.name}现在${priceFor(state, vendor, item)}文。`,
      changed: true,
    };
  }
  if (/多少|价格|几文|价钱|怎么卖|多少钱/.test(text))
    return {
      text: `${item.name}，${priceFor(state, vendor, item)}文一份。`,
    };
  if (/不买|不想买|不要|不需要|算了/.test(text))
    return { text: "没关系，先看看。想试小玩具也可以叫我。" };
  if (
    /买|来[一二两三四五1-5]|要[一二两三四五1-5]|给我|带[一二两三四五1-5]|包[一二两三四五1-5]/.test(
      text,
    )
  ) {
    const requested = text.match(
      /([1-5一二两三四五])(?:份|个|件|面|枝|把|盏|只|包)/,
    )?.[1];
    const quantity =
      Number(requested) ||
      { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5 }[requested] ||
      1;
    return {
      text: `${item.name}，${priceFor(state, vendor, item)}文一份。先看清数量和价钱，点“确认购买”才收钱。`,
      offer: item.id,
      quantity,
    };
  }
  if (/婆婆|阿芽|豆豆/.test(text))
    return {
      text: text.includes("婆婆")
        ? "花婆婆在虹桥北岸的城门旁晒太阳。花娘可以托你捎一枝花，地图也能带路。"
        : text.includes("豆豆")
          ? "豆豆在南岸玩具摊旁边。想陪他摇鼓，可以向周货郎借一面练习鼓。"
          : "阿芽在虹桥南岸，正准备春日游会。地图上选“找阿芽”，就能找到她。",
    };
  if (/推荐|好吃|好玩|哪件|特色|有什么|卖什么|卖啥/.test(text))
    return {
      text: `我这里有${vendor.items.map((i) => `${i.name}${priceFor(state, vendor, i)}文`).join("、")}。${item.description}`,
    };
  if (/桥|城门|古塔|去哪|景点|问路|渡口|船/.test(text))
    return {
      text: "先去虹桥中央看一看，再沿北岸往东走到城门。穿过门洞后，古塔在东边。想乘船，就去虹桥西侧南岸的汴河渡口。地图上也能做记号。",
    };
  if (/你好|您好|掌柜|老板|名字|是谁/.test(text))
    return { text: `我叫${vendor.owner}。${vendor.greeting}` };
  if (/谢|再见|告辞/.test(text))
    return { text: "客官慢走，愿你今日逛得尽兴。路过再来坐坐。" };
  return {
    text: `${vendor.greeting} 你可以问我“${item.name}多少钱”，也可以聊聊这里的货物和游览去处。`,
  };
}
export function visit(state, id) {
  const sight = SIGHTS.find((s) => s.id === id);
  if (!sight || state.visited.includes(id)) return false;
  state.visited.push(id);
  state.journal.push(`游至${sight.name}：${sight.text}`);
  return true;
}
export function milestones(state) {
  return [
    { id: "purchase", name: "逛摊买一件心仪之物", done: state.purchases > 0 },
    ...SIGHTS.map((s) => ({
      id: s.id,
      name: `游览${s.name}`,
      done: state.visited.includes(s.id),
    })),
    { id: "ride", name: "坐一回汴河篷船", done: state.rides > 0 },
    { id: "poem", name: "在船上留下一首诗", done: state.poems.length > 0 },
  ];
}
export function useFood(state, itemId) {
  const item = ITEM_CATALOG[itemId];
  if (item?.type !== "food" || !(state.inventory[itemId] > 0)) return null;
  state.inventory[itemId]--;
  if (!state.inventory[itemId]) delete state.inventory[itemId];
  return item;
}
