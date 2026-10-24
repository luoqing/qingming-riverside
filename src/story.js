// Fictional spring outing, inspired by the painting. No timers, punishment or paid gates.
export const FRIENDS = [
  {
    id: "aya",
    name: "阿芽",
    x: -6.6,
    z: 12.8,
    gender: "female",
    age: "child",
    color: "#a95e58",
    role: "带着风筝的小伙伴",
  },
  {
    id: "doudou",
    name: "豆豆",
    x: 2.2,
    z: 12.6,
    gender: "male",
    age: "child",
    color: "#b88b41",
    role: "想学摇鼓的小弟弟",
  },
  {
    id: "granny",
    name: "花婆婆",
    x: 11.8,
    z: -7.5,
    gender: "female",
    age: "elder",
    color: "#767c95",
    role: "等着看游会的老街坊",
  },
];
export const has = (s, id) => s.story.includes(id);
export const hasRattle = (s) => s.inventory.rattle > 0;
export const flowerInBag = (s) =>
  [s.flowerChoice, "begonia", "peony", "willow-sprig"].find(
    (id) => s.inventory[id] > 0,
  );
export function mark(s, id, text) {
  if (has(s, id)) return false;
  s.story.push(id);
  if (text) s.journal.push(text);
  return true;
}
export function storyGoals(s) {
  return [
    { id: "invited", name: "认识阿芽", done: has(s, "invited"), target: "aya" },
    {
      id: "drum",
      name: "陪豆豆摇一次鼓",
      done: has(s, "drum"),
      target: "doudou",
    },
    {
      id: "ribbon",
      name: "到虹桥找风的线索",
      done: has(s, "ribbon"),
      target: "bridge",
    },
    {
      id: "gift",
      name: "给花婆婆送一枝春天",
      done: has(s, "gift"),
      target: has(s, "flower") ? "granny" : "flowers",
    },
    {
      id: "finale",
      name: "坐船写诗，放飞春日纸鸢",
      done: has(s, "finale"),
      target: "harbor",
    },
  ];
}
export function storyReady(s) {
  return ["invited", "drum", "ribbon", "gift"].every((id) => has(s, id));
}
export function storyAction(s, action) {
  if (action === "invite") {
    mark(s, "invited", "阿芽邀请我一起筹备春日游会。");
    return {
      text: "阿芽：我想让今天的游会热闹一点！豆豆想摇鼓，花婆婆想看春花。你去虹桥找找风的方向，我去准备纸鸢。做哪件都行，我等你！",
    };
  }
  if (["flower", "peony", "willow-sprig"].includes(action)) {
    const id = action === "flower" ? "begonia" : action;
    if (!has(s, "flower")) {
      s.inventory[id] = (s.inventory[id] || 0) + 1;
      s.flowerChoice = id;
      mark(s, "flower", "花娘送我一枝春花，请我带给花婆婆。");
    }
    return {
      text:
        action === "flower"
          ? "花娘：这枝淡粉海棠送给你，替我带给城门旁的花婆婆。送花不用赶时间。"
          : "花娘：你选的这一枝也漂亮。婆婆说不定很喜欢，带去给她看看吧。",
    };
  }
  if (action === "loan") {
    if (!has(s, "loan")) {
      if (!(s.inventory.rattle > 0)) s.inventory.rattle = 1;
      mark(s, "loan", "周货郎借我一面拨浪鼓，陪豆豆练习。");
    }
    return {
      text: "周货郎：这面鼓借给你陪豆豆练练。握住木柄，轻轻转动，让两边的小球敲鼓面。想买别的小玩意，摊上随你挑！",
      equip: "rattle",
    };
  }
  if (action === "doudou-loan") {
    if (!hasRattle(s)) s.inventory.rattle = 1;
    mark(s, "loan", "豆豆借我一面练习鼓，让我和他一起试着摇一摇。");
    return {
      text: "豆豆：我带了两面练习鼓，这面先借给你！握住木柄，轻轻摇，我们一人一面。",
      equip: "rattle",
    };
  }
  if (action === "drum") {
    if (!hasRattle(s)) return { text: "先请豆豆借你一面练习鼓吧。" };
    mark(s, "drum", "我摇起拨浪鼓，豆豆也跟着拍手。他说自己不紧张了。");
    return {
      text: "豆豆：咚咚、咚咚！原来我也能跟上呀！游会的时候，你愿意站在我旁边吗？我送你一条红彩带，系在阿芽的纸鸢上！",
    };
  }
  if (action === "ribbon") {
    mark(s, "ribbon", "站在虹桥上，看见桥下行船，知道纸鸢要迎着风放。");
    return {
      text: "阿芽的纸条：看！旗子和柳梢都在动。放纸鸢要迎着风，跑几步，再慢慢松线。你找到这条蓝彩带啦！",
    };
  }
  if (action === "gift") {
    if (has(s, "gift"))
      return {
        text: "花婆婆：海棠还好好开着呢。你们玩得开心，我坐在这里也跟着开心。",
      };
    const flower = flowerInBag(s);
    if (!flower)
      return {
        text: "花婆婆：花娘托你带花了吗？去听听她的花谜吧，她会送你一枝。已经用掉也没关系，告诉花娘，她会帮忙。",
      };
    s.inventory[flower]--;
    if (!s.inventory[flower]) delete s.inventory[flower];
    s.money += 20;
    s.flowerChoice = flower;
    mark(s, "gift", "把春花交给花婆婆，她送我20文路上买点心。");
    return {
      text: `花婆婆：${flower === "begonia" ? "这海棠和我小时候院子里的一个颜色。" : flower === "peony" ? "这牡丹让我也神气一回！" : "这柳枝嫩得像我小时候放纸鸢的那个春天。"}这条布带以前系在我的纸鸢上，给它找个新地方吧。再拿20文买点心，玩累了就歇歇。`,
    };
  }
  if (action === "replacement") {
    if (has(s, "gift"))
      return { text: "花娘：婆婆已经收到你的心意啦，快去玩吧。" };
    if (!["begonia", "peony", "willow-sprig"].some((id) => s.inventory[id] > 0))
      s.inventory.begonia = 1;
    mark(s, "flower");
    return { text: "花娘：没关系，再拿一枝海棠去吧。心意带到就好。" };
  }
  return { text: "先到街上逛一逛吧。" };
}
export function finishStory(s) {
  if (!storyReady(s) || s.rides < 1 || !s.poems.length) return false;
  return mark(
    s,
    "finale",
    "春日游会开始了：豆豆摇鼓，婆婆赏花，我和阿芽在汴河上放飞纸鸢。",
  );
}
