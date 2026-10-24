import * as THREE from "three";
import css from "./journey.css";
import { VENDORS, ITEM_CATALOG, HARBOR, SIGHTS, roleIdForSpeaker } from "./travel-data.js";
import {
  newJourney,
  restoreJourney,
  buy,
  talk,
  priceFor,
  itemQuestion,
  visit,
  useFood,
} from "./travel-state.js";
import {
  FRIENDS,
  has,
  hasRattle,
  flowerInBag,
  storyAction,
  storyGoals,
  storyReady,
  finishStory,
} from "./story.js";
import {
  walkSurface,
  isBlocked,
  moveOnLand,
  findRoute,
  nearestWalkable,
  clearSegment,
} from "./walk.js";
import { riverCenter } from "./paths.js";
import { makeToy } from "./toys.js";
import { createDialogue } from "./dialogue.js";
import { navigationLayers, routePath } from "./navigation-map.js";
import { createJourneyAudio } from "./journey-audio.js";
import { createHeroVisual } from "./hero-model.js";

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};
const button = (text, action, cls = "") => {
  const b = el("button", cls, text);
  b.type = "button";
  b.addEventListener("click", action);
  return b;
};
const para = (root, text, cls = "") => {
  const p = el("p", cls, text);
  root.append(p);
  return p;
};
const SAVE_KEY = "bianhe-spring-journey-v1";

// A single simulation drives world figures, hands, boat seating and the UI.
export function createJourney({
  world,
  camera,
  controls,
  canvas,
  humanModel,
  humanMaterials,
  boats,
  obstacles,
  stallCanopies,
  getCrowd,
  getMapImage,
  onStart,
  onOverview,
}) {
  const style = el("style");
  style.textContent = css;
  document.head.append(style);
  const ui = el("div", "journey-ui");
  document.body.append(ui);
  let speakingTo = null, dismissedVendor = null;
  const audio = createJourneyAudio();
  const dialogue = createDialogue(ui, reason => {
    if (speakingTo?.kind === "vendor") {
      if(reason==="goodbye") {
        dismissedVendor=speakingTo.id;
        near=null;
        context.hidden=true;
        vendorLabels.find(v=>v.vendor.id===dismissedVendor)?.label.setAttribute("hidden","");
      }
      const canopy = stallCanopies?.get(speakingTo.id);
      if (canopy) {
        canopy.material.opacity = 1;
        canopy.material.depthWrite = true;
      }
    }
    speakingTo = null;
  }, {
    speak: (text,role) => audio.speak(text,role),
    reply: text => audio.speak(text,{player:true,gender:state.avatar}),
    stop: () => audio.stopVoice(),
    effect: () => audio.effect("choice"),
  });
  let state = newJourney();
  try {
    state = restoreJourney(JSON.parse(localStorage.getItem(SAVE_KEY)));
  } catch {}
  let active = false,
    paused = false,
    modal = null,
    lastFocus = null,
    stamina = 100,
    worldTime = 0,
    moving = false;
  let runningPose = false;
  let walkedDistance = 0;
  let lastFootstep = 0;
  let guide = null;
  let routeRetryAt = 0;
  let route = [],
    routeName = "",
    near = null,
    held = null,
    playUntil = 0,
    flight = null,
    cruise = null,
    finale = null,
    ateUntil = 0;
  let toastUntil = 0,
    verseUntil = 0,
    lastSave = 0,
    lastHud = -1,
    walkTime = 0,
    drumBeats = 0,
    lastBeat = -1,
    previewToy = null;
  const keys = new Set(),
    joystick = { x: 0, y: 0, run: false };
  const position = { x: state.position.x, y: 0.5, z: state.position.z };
  const initialObstacles=[...obstacles,...(getCrowd?.()||[])
    .filter(p=>Math.abs((p.y??.5)-position.y)<1.5).map(p=>({...p,kind:"circle"}))];
  if (isBlocked(position.x, position.z, initialObstacles)) {
    const safe = nearestWalkable(position, initialObstacles) || { x: -6.7, z: 11.7 };
    position.x = safe.x;
    position.z = safe.z;
  }
  position.y = walkSurface(position.x, position.z) ?? 0.5;
  const gameWorld = new THREE.Group();
  gameWorld.visible = false;
  world.add(gameWorld);
  const guideDots = new THREE.InstancedMesh(
    new THREE.CircleGeometry(0.055, 10).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color: "#edbd64",
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    }),
    32,
  );
  guideDots.frustumCulled = false;
  guideDots.visible = false;
  gameWorld.add(guideDots);
  const guideObject = new THREE.Object3D();
  let guideRefresh = 0;
  const mats = { ...humanMaterials, cloth: humanMaterials.cloth.clone() };
  mats.cloth.color.set("#457884");
  function human(profile, materials = humanMaterials) {
    const root = new THREE.Group(),
      meshes = {};
    for (const [name, spec] of Object.entries(humanModel.specs)) {
      const m = new THREE.Mesh(spec.geometry, materials[spec.material]);
      m.matrixAutoUpdate = false;
      m.castShadow = true;
      m.receiveShadow = true;
      root.add(m);
      meshes[name] = m;
    }
    gameWorld.add(root);
    return {
      root,
      profile,
      meshes,
      pose(t, extra = {}) {
        humanModel.pose(t, { ...profile, ...extra }, (name, matrix) => {
          meshes[name].matrix.copy(matrix);
          meshes[name].visible = matrix.determinant() !== 0;
        });
      },
    };
  }
  const hero = human({ age: "child", gender: state.avatar }, mats);
  const heroVisual = createHeroVisual(hero.root);
  hero.root.scale.setScalar(0.82);
  const footRing = new THREE.Mesh(
    new THREE.RingGeometry(0.28, 0.32, 28),
    new THREE.MeshBasicMaterial({
      color: "#d6ba6b",
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    }),
  );
  footRing.rotation.x = -Math.PI / 2;
  gameWorld.add(footRing);
  const handPoint = new THREE.Group();
  hero.root.add(handPoint);
  const stringGeometry = new THREE.BufferGeometry().setFromPoints([V(), V()]);
  const kiteString = new THREE.Line(
    stringGeometry,
    new THREE.LineBasicMaterial({ color: "#e8ddbd" }),
  );
  gameWorld.add(kiteString);
  kiteString.visible = false;
  const friends = FRIENDS.map((f, i) => {
    const materials = {
      ...humanMaterials,
      cloth: humanMaterials.cloth.clone(),
    };
    materials.cloth.color.set(f.color);
    const actor = human(f, materials);
    actor.root.position.set(f.x, 0.5, f.z);
    actor.root.scale.setScalar(f.age === "child" ? 0.74 : 1.02);
    actor.root.rotation.y = [-2.8, -1.8, 0.7][i];
    const label = el("div", "j-npc-label", f.name);
    ui.append(label);
    label.hidden = true;
    return { ...f, actor, label };
  });
  const vendorLabels = VENDORS.map((v) => {
    const label = el("div", "j-vendor-label", `${v.owner} · ${v.category}`);
    label.hidden = true;
    ui.append(label);
    return { vendor: v, label };
  });
  const doudou = friends.find((f) => f.id === "doudou"),
    granny = friends.find((f) => f.id === "granny"),
    aya = friends.find((f) => f.id === "aya");
  const grannyFlower = makeToy(state.flowerChoice);
  grannyFlower.root.position.set(0.22, 0.52, 0.19);
  granny.actor.root.add(grannyFlower.root);
  grannyFlower.root.visible = has(state, "gift");
  const benchMaterial = new THREE.MeshStandardMaterial({
    color: "#88633e",
    roughness: 0.9,
  });
  function benchPiece(x, y, z, w, h, d) {
    const part = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), benchMaterial);
    part.position.set(x, y, z);
    part.castShadow = part.receiveShadow = true;
    granny.actor.root.add(part);
  }
  benchPiece(0, 0.31, 0.03, 0.6, 0.07, 0.34);
  benchPiece(0, 0.58, -0.15, 0.6, 0.12, 0.045);
  for (const x of [-0.23, 0.23])
    for (const z of [-0.09, 0.15]) benchPiece(x, 0.14, z, 0.045, 0.28, 0.045);
  const friendDrum = makeToy("rattle");
  const doudouHandPoint = new THREE.Group();
  doudou.actor.root.add(doudouHandPoint);
  friendDrum.root.scale.setScalar(0.62);
  doudouHandPoint.add(friendDrum.root);
  const ayaKite = makeToy("kite");
  ayaKite.root.position.set(-0.42, 0.85, 0.1);
  ayaKite.root.scale.setScalar(1.3);
  aya.actor.root.add(ayaKite.root);
  const ship = boats[6].g,
    dockPose = {
      position: ship.position.clone(),
      quaternion: ship.quaternion.clone(),
    };
  // Only a copy of the decorative boat is used by the player. Ambient traffic stays independent.
  const playerBoat = ship.clone(true);
  const seatMaterial = new THREE.MeshStandardMaterial({
    color: "#98744d",
    roughness: 0.9,
  });
  function boatSeat(x, y, z, w, h, d) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), seatMaterial);
    p.position.set(x, y, z);
    p.castShadow = p.receiveShadow = true;
    playerBoat.add(p);
  }
  boatSeat(-1.9, 0.408, 0, 0.6, 0.07, 0.72);
  for (const x of [-2.12, -1.68])
    for (const z of [-0.25, 0.25]) boatSeat(x, 0.27, z, 0.055, 0.22, 0.055);
  playerBoat.visible = false;
  world.add(playerBoat);
  const projected = V(),
    heroWorld = V(),
    follow = V(),
    delta = V();
  function save() {
    state.position = { x: position.x, z: position.z };
    state.journal = state.journal.slice(-80);
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch {}
  }
  function changed() {
    save();
    refreshHud();
    paintStoryKite();
  }
  function notify(text, seconds = 4) {
    toast.textContent = text;
    toast.hidden = false;
    toastUntil = worldTime + seconds;
  }
  function clearMovement() {
    keys.clear();
    joystick.x = joystick.y = 0;
    joystick.run = false;
    padKnob.style.transform = "";
  }
  const intro = el("section", "j-intro");
  intro.setAttribute("aria-label", "春游启程");
  intro.innerHTML =
    '<span class="intro-seal">走进画里玩一天</span><h2>阿芽的<br>春日游会</h2><p>汴河边，有个小伙伴在等你。</p>';
  const avatars = el("div", "j-row");
  para(avatars, "这次，你想扮成：", "small");
  const avatarButtons = ["female", "male"].map((gender, i) => {
    const b = button(i ? "小男孩" : "小女孩", () => {
      state.avatar = gender;
      hero.profile.gender = gender;
      avatarButtons.forEach((a, j) =>
        a.setAttribute("aria-pressed", String(j === i)),
      );
      save();
    });
    b.setAttribute("aria-pressed", String(state.avatar === gender));
    avatars.append(b);
    return b;
  });
  intro.append(
    avatars,
    button(
      state.story.length ? "继续我的春游" : "带上120文，出发",
      () => start(),
      "primary",
    ),
    button("先看全卷", () => {
      intro.hidden = true;
      launcher.hidden = false;
    }),
  );
  para(intro, "虚构的春日故事 · 可随时停下 · 进度保存在本机", "small");
  ui.append(intro);
  const launcher = button("走进画里 · 开始春游", () => start(), "j-launch");
  launcher.hidden = true;
  ui.append(launcher);
  const hud = el("div", "j-hud");
  hud.hidden = true;
  ui.append(hud);
  const top = el("div", "j-top"),
    brand = el("div", "j-brand");
  brand.innerHTML =
    '<strong>汴京 · 春游记</strong><div class="j-money"><span></span><div class="j-stamina" role="meter" aria-label="体力" aria-valuemin="0" aria-valuemax="100"><i></i></div></div>';
  const money = brand.querySelector("span"),
    staminaBar = brand.querySelector("i");
  const tools = el("nav", "j-tools");
  tools.setAttribute("aria-label", "旅行工具");
  const mapTool = button("地图", openMap), bagTool = button("背包", openBag);
  const menuTool = button("☰", openPause);
  menuTool.setAttribute("aria-label", "旅行菜单");
  tools.append(
    mapTool, bagTool, menuTool,
  );
  top.append(brand, tools);
  hud.append(top);
  const goal = button("", () => {
    if (!state.learnedMovement) return;
    const next = storyGoals(state).find(g => !g.done);
    if (next) goTo(next.target);
    else notify("今天的约定都完成了。沿着汴河再逛逛吧。", 5);
  }, "j-goal");
  goal.setAttribute("aria-live", "polite");
  hud.append(goal);
  const context = el("div", "j-context"),
    contextText = el("p"),
    interactButton = button(
      "交谈 · E",
      () => {
        if (route.length) {
          route = [];
          notify("停下了。");
        } else if (!getNear()) openMap();
        else interact();
      },
      "primary",
    );
  context.append(contextText, interactButton);
  context.hidden = true;
  hud.append(context);
  const heldUI = el("div", "j-held");
  heldUI.hidden = true;
  hud.append(heldUI);
  const miniMap = button("", openMap, "j-minimap");
  miniMap.setAttribute("aria-label", "展开完整地图");
  miniMap.innerHTML = '<span class="j-mini-title">汴京 <small>北 ↑</small></span><span class="j-mini-view"><img alt="汴京实景鸟瞰缩略图"><svg viewBox="-43 -21.5 86 43" preserveAspectRatio="none" aria-hidden="true"></svg><i class="j-mini-target" hidden></i><i class="j-mini-me"></i></span><span class="j-mini-caption">你在这里 · 点击展开</span>';
  const miniImage = miniMap.querySelector("img"), miniLayers = miniMap.querySelector("svg"),
    miniMe = miniMap.querySelector(".j-mini-me"), miniTarget = miniMap.querySelector(".j-mini-target");
  miniLayers.classList.add("j-navigation-layers");
  miniLayers.innerHTML = navigationLayers(obstacles);
  hud.append(miniMap);
  let mapImage = null;
  function surveyImage() {
    if (!mapImage) mapImage = getMapImage();
    return mapImage;
  }
  function updateMiniMap() {
    const p = cruise ? heroWorld : position;
    const x = ((p.x + 43) / 86) * 100, y = ((p.z + 21.5) / 43) * 100;
    miniMe.style.left = `${x}%`;
    miniMe.style.top = `${y}%`;
    miniMe.style.setProperty("--heading", `${-hero.root.rotation.y * 180 / Math.PI + 180}deg`);
    miniMap.dataset.x = String(p.x);
    miniMap.dataset.z = String(p.z);
    miniTarget.hidden = !guide;
    if (guide) {
      miniTarget.style.left = `${((guide.target.x + 43) / 86) * 100}%`;
      miniTarget.style.top = `${((guide.target.z + 21.5) / 43) * 100}%`;
    }
    const path = routePath(p, guide?.path);
    miniLayers.querySelectorAll("[data-layer=route] path").forEach(n => n.setAttribute("d", path));
    if (modal === "汴京游览图") {
      const me = body?.querySelector(".j-map-me");
      if (me) {me.style.left = `${x}%`; me.style.top = `${y}%`;}
    }
  }
  const touch = el("div", "j-touch"),
    pad = el("div", "j-pad"),
    padKnob = el("i"),
    run = button("跑", () => {}, "j-run");
  pad.setAttribute("aria-label", "拖动摇杆行走");
  pad.append(padKnob);
  touch.append(pad, run);
  hud.append(touch);
  const toast = el("div", "j-toast");
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  toast.hidden = true;
  ui.append(toast);
  const verse = el("div", "j-verse");
  verse.hidden = true;
  hud.append(verse);
  let shade = null,
    panel = null,
    body = null,
    menuCard = null;
  function openPanel(title, tag = "春日游记") {
    dialogue.hide();
    closeMenu(false);
    closePanel(false);
    lastFocus = document.activeElement;
    clearMovement();
    modal = title;
    hud.classList.add("j-busy");
    toast.hidden = true;
    shade = el("div", "j-shade");
    panel = el("section", "j-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", title);
    panel.tabIndex = -1;
    const close = button("×", () => closePanel(), "j-close");
    close.setAttribute("aria-label", "关闭窗口");
    panel.append(el("div", "tag", tag), el("h2", "", title), close);
    body = el("div");
    panel.append(body);
    shade.append(panel);
    ui.append(shade);
    close.focus();
    return body;
  }
  function closePanel(focus = true) {
    shade?.remove();
    shade = panel = body = null;
    modal = null;
    hud.classList.remove("j-busy");
    clearMovement();
    if (focus) {
      if (lastFocus?.isConnected && !lastFocus.hidden) lastFocus.focus();
      else canvas.focus({ preventScroll: true });
    }
  }
  function closeMenu(focus = true) {
    if (!menuCard) return;
    menuCard.remove();
    menuCard = null;
    paused = false;
    audio.pause(false);
    if (focus) canvas.focus({ preventScroll: true });
  }
  function refreshHud() {
    money.textContent = `铜钱 ${state.money} 文`;
    staminaBar.style.width = `${Math.round(stamina)}%`;
    staminaBar.parentElement.setAttribute(
      "aria-valuenow",
      String(Math.round(stamina)),
    );
    const goals = storyGoals(state),
      next = goals.find((g) => !g.done);
    const objective = !state.learnedMovement ? "用 WASD 或方向键走一走" :
      !has(state, "invited") ? "找阿芽，和她打声招呼" :
      guide ? `去${guide.name}，沿金色路标走` : next ? next.name : "纸鸢飞起来了，再逛一会儿吧";
    if (goal.textContent !== objective) goal.textContent = objective;
    goal.disabled = !state.learnedMovement;
    goal.hidden = !!cruise || !!finale;
    mapTool.hidden = true;
    bagTool.hidden = !Object.values(state.inventory).some(n => n > 0);
    brand.hidden = false;
    run.hidden = !state.learnedMovement;
    hud.classList.toggle("j-learning-walk",!state.learnedMovement);
  }
  function start() {
    audio.start();
    audio.pause(false);
    const walkers = (getCrowd?.() || [])
      .filter((p) => Math.abs(p.y - position.y) < 1)
      .map((p) => ({ ...p, kind: "circle" }));
    const safe = nearestWalkable(position, [...obstacles, ...walkers]);
    if (safe) {
      position.x = safe.x;
      position.z = safe.z;
      position.y = walkSurface(safe.x, safe.z) ?? 0.5;
    }
    active = true;
    paused = false;
    intro.hidden = true;
    launcher.hidden = true;
    hud.hidden = false;
    gameWorld.visible = true;
    document.body.classList.add("journey-active");
    onStart();
    controls.minDistance = 2.5;
    controls.maxDistance = 28;
    controls.enablePan = false;
    controls.maxPolarAngle = Math.PI * 0.47;
    camera.position.set(position.x + 2.3, position.y + 2.5, position.z + 4.2);
    controls.target.set(position.x, position.y + 0.85, position.z);
    controls.update();
    hero.root.position.set(position.x, position.y, position.z);
    heroWorld.copy(hero.root.position);
    refreshHud();
    updateMiniMap();
    setTimeout(() => {
      try {miniImage.src = surveyImage();} catch {miniImage.hidden = true;}
    }, 60);
    canvas.focus({ preventScroll: true });
  }
  function overview() {
    if (cruise || finale) {
      notify("先回到岸边，再看全卷吧。");
      return;
    }
    save();
    active = false;
    closePanel();
    audio.pause(true);
    gameWorld.visible = false;
    hud.hidden = true;
    launcher.hidden = false;
    friends.forEach((f) => (f.label.hidden = true));
    vendorLabels.forEach((v) => (v.label.hidden = true));
    dialogue.hide();
    document.body.classList.remove("journey-active");
    controls.minDistance = 9;
    controls.maxDistance = 210;
    controls.enablePan = true;
    onOverview();
  }
  function openPause() {
    if (menuCard) {
      closeMenu();
      return;
    }
    dialogue.hide();
    clearMovement();
    paused = true;
    audio.pause(true);
    menuCard = el("section", "j-menu-popover");
    menuCard.setAttribute("role", "dialog");
    menuCard.setAttribute("aria-label", "旅行菜单");
    const b = el("div");
    menuCard.append(el("strong", "", "旅行菜单"), button("×", () => closeMenu(), "j-menu-close"), b);
    para(b, `铜钱 ${state.money} 文 · 进度已保存`, "small");
    const travelTools = el("div", "j-row");
    travelTools.append(
      button("地图", () => openMap()),
      button("背包", () => openBag()),
    );
    b.append(travelTools);
    const goals = storyGoals(state);
    para(b, `今日约定 ${goals.filter(g => g.done).length} / ${goals.length} · ${goals.find(g => !g.done)?.name || "沿河自由游览"}`, "small");
    b.append(
      button(
        "继续春游",
        () => closeMenu(),
        "primary",
      ),
      button("回看全卷", () => {
        closeMenu(false);
        overview();
      }),
    );
    const soundSettings=el("div","j-row");
    for(const [key,label] of [["music","背景音乐"],["effects","音效"],["voice","对白语音"]]) {
      const toggle=button(`${label}：${audio.settings[key] ? "开" : "关"}`,()=>{
        audio.toggle(key);
        toggle.textContent=`${label}：${audio.settings[key] ? "开" : "关"}`;
        toggle.setAttribute("aria-pressed",String(audio.settings[key]));
      });
      toggle.setAttribute("aria-pressed",String(audio.settings[key]));soundSettings.append(toggle);
    }
    b.append(el("h3","","声音"),soundSettings);
    const voiceLabel = el("label", "j-voice-choice");
    voiceLabel.textContent = "主角音色 ";
    const voiceSelect = document.createElement("select");
    voiceSelect.setAttribute("aria-label", "主角音色");
    for (const [value, label] of [
      ["auto", "跟随角色"],
      ["female", "小女孩"],
      ["male", "小男孩"],
    ]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      option.selected = audio.settings.heroVoice === value;
      voiceSelect.append(option);
    }
    voiceSelect.addEventListener("change", () => audio.setHeroVoice(voiceSelect.value));
    voiceLabel.append(voiceSelect);
    b.append(voiceLabel);
    const restart = button("重新开始这趟春游", () => {
      if (restart.dataset.confirm !== "true") {
        restart.dataset.confirm = "true";
        restart.textContent = "再点一次，确认重新开始";
        return;
      }
      state = newJourney();
      save();
      location.reload();
    });
    b.append(restart);
    hud.append(menuCard);
    menuCard.querySelector("button")?.focus();
  }
  const destinations = [
    ...FRIENDS.map((f) => ({
      ...f,
      target: { x: f.x, z: f.z + 0.9 },
      kind: "friend",
    })),
    ...VENDORS.map((v) => ({
      ...v,
      target: { x: v.x, z: v.z + v.d / 2 + 0.6 },
      kind: "vendor",
    })),
    ...SIGHTS.map((s) => ({ ...s, target: { x: s.x, z: s.z }, kind: "sight" })),
    { ...HARBOR, target: { x: HARBOR.x, z: HARBOR.z }, kind: "harbor" },
  ];
  for (const destination of destinations)
    destination.target =
      nearestWalkable(destination.target, obstacles) || destination.target;
  function goTo(id, assisted = false) {
    if (cruise) {
      notify("正在船上，返航后再去吧。");
      return;
    }
    const dest = destinations.find((d) => d.id === id);
    if (!dest) return;
    if(dismissedVendor===id)dismissedVendor=null;
    const approach = nearestWalkable(dest.target, obstacles) || dest.target;
    const found = findRoute(position, approach, obstacles);
    if (!found?.length) {
      notify("这里的路有些窄，先走到空地再试试，也可以自己过去。");
      return;
    }
    guide = {
      id,
      name: dest.name,
      path: found,
      target: approach,
      origin: { x: position.x, z: position.z },
    };
    guideRefresh = worldTime + 1.5;
    route = assisted ? found : [];
    routeName = dest.name;
    closePanel();
    notify(
      assisted
        ? `辅助带路：去${dest.name}。方向键可随时停下。`
        : `已标记${dest.name}。沿着街上的金色路标走，走近后再交谈。`,
      5,
    );
  }
  function openMap() {
    const b = openPanel("汴京游览图", "认清街巷 · 出发去逛");
    b.classList.add("j-atlas-content");
    panel.classList.add("j-atlas-panel");
    shade.classList.add("j-atlas-shade");
    para(
      b,
      "浅金色是道路，蓝色是汴河，灰色是建筑。选一个地方，看看红色路线怎么走。",
      "small",
    );
    const map = el("div", "j-atlas"),
      image = el("img");
    image.alt = "当前汴京的街巷、河流与建筑底图";
    const loading = el("div", "j-atlas-loading", "正在展开汴京鸟瞰图…");
    map.append(image, loading);
    const overlay = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg",
    );
    overlay.setAttribute("viewBox", "-43 -21.5 86 43");
    overlay.setAttribute("preserveAspectRatio", "none");
    overlay.classList.add("j-navigation-layers");
    overlay.setAttribute("aria-label", "道路、河流、建筑与可行走导航路线");
    overlay.innerHTML = navigationLayers(obstacles);
    map.append(overlay);
    b.append(map);
    let selected =
      destinations.find((d) => d.id === guide?.id) || destinations[0];
    const label = (d) =>
      d.kind === "vendor"
        ? state.met?.includes(d.id)
          ? d.name
          : `${d.category}摊`
        : d.name;
    const detail = el("div", "j-atlas-detail"),
      title = el("strong"),
      description = el("span", "small"),
      select = el("select");
    select.setAttribute("aria-label", "在导览图上找地点");
    for (const d of destinations) {
      const option = el("option", "", label(d));
      option.value = d.id;
      select.append(option);
    }
    const pins = [];
    function choose(d) {
      selected = d;
      select.value = d.id;
      title.textContent = label(d);
      description.textContent =
        d.kind === "vendor"
          ? "到了附近，留意招牌和货物，靠近桌前按 E 交谈。"
          : d.kind === "friend"
            ? d.role
            : d.kind === "harbor"
              ? "河埠边可以和船娘交谈、乘船游河。"
              : "可以步行前往，慢慢欣赏眼前的风景。";
      const route = !cruise && findRoute(position, d.target, obstacles);
      const path = routePath(position, route);
      overlay
        .querySelectorAll("[data-layer=route] path")
        .forEach((n) => n.setAttribute("d", path));
      for (const [pin, data] of pins)
        pin.textContent =
          data.kind === "vendor" && data.id !== d.id
            ? {
                tea: "茶",
                cakes: "饼",
                flowers: "花",
                toys: "鼓",
                books: "画",
                scents: "香",
                buns: "包",
                fruit: "果",
              }[data.id]
            : label(data);
      for (const [pin, data] of pins)
        pin.classList.toggle("selected", data.id === d.id);
    }
    for (const d of destinations) {
      const pin = button(label(d), () => choose(d), `j-map-pin ${d.kind}`);
      pin.style.left = `${((d.target.x + 43) / 86) * 100}%`;
      pin.style.top = `${((d.target.z + 21.5) / 43) * 100}%`;
      pin.setAttribute("aria-label", `在图上查看${label(d)}`);
      map.append(pin);
      pins.push([pin, d]);
    }
    const me = el("span", "j-map-me", "你");
    me.style.left = `${(((cruise ? heroWorld.x : position.x) + 43) / 86) * 100}%`;
    me.style.top = `${(((cruise ? heroWorld.z : position.z) + 21.5) / 43) * 100}%`;
    map.append(me, el("span", "j-map-north", "北 ↑"));
    const legend = el("div", "j-map-legend");
    legend.innerHTML =
      '<span><i class="road"></i>道路</span><span><i class="river"></i>河流</span><span><i class="building"></i>建筑</span><span><i class="route"></i>要走的路线</span><span><i class="you"></i>你在这里</span>';
    select.addEventListener("change", () =>
      choose(destinations.find((d) => d.id === select.value)),
    );
    detail.append(title, description);
    b.append(select, detail, legend);
    const actions = el("div", "j-row");
    const markButton = button(
        "在街上给我指路",
        () => goTo(selected.id),
        "primary",
      ),
      assist = button("辅助带我走", () => goTo(selected.id, true));
    markButton.disabled = assist.disabled = !!cruise;
    actions.append(
      markButton,
      assist,
      button("收起地图，自己逛", () => closePanel()),
    );
    b.append(actions);
    choose(selected);
    para(
      b,
      "默认只标记方向，不替你走路。辅助带路可以随时用方向键或摇杆打断。",
      "small",
    );
    setTimeout(() => {
      try {
        image.src = surveyImage();
        loading.remove();
      } catch {
        loading.remove();
        image.remove();
        map.title = "实景底图暂时没能展开，已保留道路、河流、建筑和导航路线。";
      }
    }, 30);
  }
  function openBag() {
    const b = openPanel("我的小背包");
    para(b, `还剩 ${state.money} 文。买到的东西，可以拿出来用。`, "small");
    const entries = Object.entries(state.inventory).filter(([, n]) => n > 0);
    if (!entries.length)
      para(b, "背包还空着。先去逛逛摊位，或去找豆豆借面练习鼓吧。");
    for (const [id, count] of entries) {
      const item = ITEM_CATALOG[id],
        card = el("div", "j-item");
      card.append(el("b", "", `${item.name} × ${count}`));
      para(card, item.description);
      if (item.type === "food")
        card.append(
          button("打开吃一份", () => {
            const food = useFood(state, id);
            if (food) {
              stamina = Math.min(100, stamina + food.energy);
              ateUntil = worldTime + 3;
              equip(id, true);
              changed();
              closePanel();
              notify(
                `打开纸包，尝了一口${item.name}。体力恢复${food.energy}点。`,
              );
            }
          }),
        );
      else if (
        item.type === "toy" ||
        item.type === "flower" ||
        ["bamboo-fan", "sachet", "herb-bundle"].includes(id)
      )
        card.append(
          button("拿在手里", () => {
            equip(id);
            changed();
            closePanel();
            notify(`拿出了${item.name}。`);
          }),
        );
      else if (item.type === "map") card.append(button("展开地图", openMap));
      if (item.type === "food")
        card.append(
          button("和豆豆分享一份", () => {
            if (distance(position, doudou) > 2.8 || cruise) {
              notify("走到豆豆身边，就能一起分享。");
              return;
            }
            if (useFood(state, id)) {
              state.journal.push(`和豆豆分享了${item.name}。`);
              changed();
              openBag();
              notify("豆豆：给我也留了一口？好香！下回我也带点心给你。");
            }
          }),
        );
      b.append(card);
    }
    b.append(button("去玩具摊看看", () => goTo("toys")));
  }
  function resultPanel(title, result, next) {
    changed();
    const prefix = result.text.match(/^([^：]{1,10})：/),
      previous = speakingTo,
      speaker = prefix?.[1] || dialogue.speaker || "阿芽";
    sceneTalk({
      speaker,
      role: title,
      text: prefix ? result.text.slice(prefix[0].length) : result.text,
      kind: previous?.kind,
      id: roleIdForSpeaker(speaker,previous?.id),
      choices: [
        {
          label: next ? "接着逛" : "记住啦",
          action: () => {
            dialogue.hide();
            if (next) next();
          },
        },
      ],
    });
  }
  function sceneTalk(config) {
    state.learnedMovement = true;
    closePanel();
    dialogue.hide();
    toast.hidden = true;
    toastUntil = worldTime;
    clearMovement();
    route = [];
    speakingTo = { kind: config.kind, id: config.id };
    if (config.kind === "friend") {
      const friend = friends.find((f) => f.id === config.id);
      if (friend) {
        const p = friend.actor.root.position;
        hero.root.rotation.y = Math.atan2(p.x - position.x, p.z - position.z);
        if (friend.age === "child")
          friend.actor.root.rotation.y = Math.atan2(
            position.x - p.x,
            position.z - p.z,
          );
      }
    }
    if (config.kind === "vendor") {
      const vendor = VENDORS.find((v) => v.id === config.id),
        canopy = stallCanopies?.get(config.id);
      if (canopy) {
        canopy.material.opacity = 0.16;
        canopy.material.depthWrite = false;
      }
      hero.root.rotation.y = Math.atan2(
        vendor.x - position.x,
        vendor.z - position.z,
      );
      if (!state.met.includes(vendor.id)) {
        state.met.push(vendor.id);
        changed();
      }
    }
    dialogue.show(config);
  }
  function openFriend(id) {
    const friend = friends.find((f) => f.id === id);
    if (id === "aya")
      sceneTalk({
        speaker: "阿芽",
        role: friend.role,
        kind: "friend",
        id,
        text: has(state, "invited")
          ? "豆豆想练鼓，花婆婆想看看春花。先逛哪边，你来挑！"
          : "哎，线又绕住啦！你能帮我拿一下线轴吗？先靠近一点，咱们一起把它绕开。",
        choices: has(state, "invited")
          ? [
              {
                label: storyGoals(state).some(g => !g.done) ? "给我指下一站" : "一起看看纸鸢",
                action: () => {
                  const next = storyGoals(state).find(g => !g.done);
                  if (!next) {
                    dialogue.say("纸鸢上已经有小鼓、春花、虹桥和汴河。今天走过的地方，都在上面啦！");
                    return;
                  }
                  dialogue.hide();
                  goTo(next.target);
                },
                primary: true,
              },
              { label: "我先去逛逛", action: () => dialogue.hide() },
            ]
          : [
              {
                label: "我来帮你绕开线",
                action: acceptAyaQuest,
                primary: true,
              },
              { label: "我先看看附近", action: () => dialogue.hide() },
            ],
      });
    if (id === "doudou") {
      const carryingRattle = hasRattle(state);
      sceneTalk({
        speaker: "豆豆",
        role: friend.role,
        kind: "friend",
        id,
        text: has(state, "drum")
          ? "你来啦！我又学了一拍。游会时，你还站我旁边好不好？"
          : "我在家摇得可响了。一有人看，手就不听话。你愿意陪我练一小段吗？",
        choices: carryingRattle
          ? [
              {
                label: "我和你一起摇",
                action: () => startDrum(false),
                primary: true,
              },
              { label: "找安静的地方练", action: () => startDrum(true) },
              { label: "等我逛一会儿再来", action: () => dialogue.hide() },
            ]
          : [
              {
                label: "借我一面鼓试试",
                action: borrowDoudouDrum,
                primary: true,
              },
              { label: "等我逛一会儿再来", action: () => dialogue.hide() },
            ],
      });
    }
    if (id === "granny") {
      const flower = flowerInBag(state);
      sceneTalk({
        speaker: "花婆婆",
        role: friend.role,
        kind: "friend",
        id,
        text: has(state, "gift")
          ? "花还好好开着。你们玩得开心，我坐在这里也跟着开心。"
          : flower
            ? "今天的风真好。花娘是不是托你捎了什么？"
            : "今日日头暖，坐下来陪我看看街上的人吧。",
        choices: [
          ...(!has(state, "gift") && flower
            ? [
                {
                  label: "把带来的花交给婆婆",
                  primary: true,
                  action: () => {
                    const r = storyAction(state, "gift");
                    if (has(state, "gift")) {
                      grannyFlower.root.removeFromParent();
                      const flowers = makeToy(state.flowerChoice);
                      flowers.root.position.set(0.22, 0.52, 0.19);
                      granny.actor.root.add(flowers.root);
                      if (held && !(state.inventory[held.id] > 0)) unequip();
                    }
                    resultPanel("一枝春花，一条旧布带", r);
                  },
                },
              ]
            : []),
          ...(!has(state, "gift") && !flower
            ? [{
                label: "问问婆婆喜欢什么花",
                primary: true,
                action: () => dialogue.say("我喜欢淡粉海棠。花娘在虹桥南岸，她若知道是给我看的，准会替你挑一枝。"),
              }]
            : []),
          {
            label: "陪婆婆歇一会儿",
            action: () => {
              stamina = 100;
              changed();
              dialogue.say(
                "我小时候也常把线绕成一团。别着急，慢慢放，总能飞起来。",
              );
            },
          },
          {
            label: "听听旧纸鸢的故事",
            action: () =>
              dialogue.say(
                "我和哥哥小时候，谁也不肯先放手。后来一个牵线，一个举纸鸢，才飞得稳。你和阿芽也要商量好。",
              ),
          },
        ],
      });
    }
  }

  function borrowDoudouDrum() {
    const result = storyAction(state, "doudou-loan"),
      prefix = result.text.match(/^([^：]{1,10})：/);
    changed();
    equip("rattle");
    sceneTalk({
      speaker: "豆豆",
      role: "借你一面练习鼓",
      kind: "friend",
      id: "doudou",
      text: prefix ? result.text.slice(prefix[0].length) : result.text,
      choices: [
        { label: "接过鼓，一起摇", primary: true, action: () => startDrum(false) },
        { label: "先拿着，等会儿再练", action: () => dialogue.hide() },
      ],
    });
  }
  function acceptAyaQuest() {
    if (!has(state, "invited")) storyAction(state, "invite");
    changed();
    sceneTalk({
      speaker: "阿芽",
      role: "纸鸢展开了",
      kind: "friend",
      id: "aya",
      text: "线理顺啦！我想把今天的汴京画在纸鸢上。你陪我去找找，好不好？",
      choices: [
        {
          label: "先去找豆豆",
          action: () => {
            dialogue.hide();
            goTo("doudou");
          },
          primary: true,
        },
        { label: "我想自己探索", action: () => dialogue.hide() },
      ],
    });
  }
  function flowerStory() {
    if (has(state, "flower")) {
      sceneTalk({
        speaker: "花娘",
        role: "鲜花摊",
        kind: "vendor",
        id: "flowers",
        text: "花没带到也不要紧，我再替你补一枝。",
        choices: [
          {
            label: "再拿一枝海棠",
            action: () => resultPanel("花娘的心意", storyAction(state, "replacement")),
            primary: true,
          },
          { label: "先不用", action: () => dialogue.hide() },
        ],
      });
      return;
    }
    sceneTalk({
      speaker: "花娘",
      role: "替花婆婆捎一枝春天",
      kind: "vendor",
      id: "flowers",
      text: "婆婆想看淡粉的小花。这枝不收钱，你愿意替我送去吗？",
      choices: [
        {
          label: "带一枝淡粉海棠",
          action: () => resultPanel("把春天带上路", storyAction(state, "flower")),
          primary: true,
        },
        { label: "我一会儿再来", action: () => dialogue.hide() },
      ],
    });
  }
  function openShop(vendor) {
    let selected = vendor.items[0].id;
    const b = el("div", "j-trade-tray");
    b.hidden = true;
    const goods = el("div", "j-stack");
    b.append(goods);
    const total = el("span", "j-shop-purse");
    b.append(total);
    function purchase() {
      const r = buy(state, vendor.id, selected, 1);
      changed();
      if (r.ok && ["food", "flower", "toy"].includes(r.item.type)) equip(r.item.id);
      b.hidden = true;
      dialogue.setChoices([
        {label: "再看看", action: browse},
        {label: "谢谢，再见", action: () => dialogue.hide("goodbye")},
      ]);
      dialogue.say(r.text);
    }
    function quote(bargain = false) {
      const r = talk(state, vendor.id, bargain ? "便宜一点可以吗？" : "这件多少钱？", selected);
      changed();
      renderGoods();
      const item = vendor.items.find(i => i.id === selected),
        shortfall = Math.max(0, priceFor(state, vendor, item) - state.money);
      dialogue.setChoices([
        shortfall
          ? {label: `铜钱不够，还差${shortfall}文`, disabled: true, action: () => {}}
          : {label: "确认购买", primary: true, action: purchase},
        bargain ? {label: "再看看", action: browse} :
          {label: "便宜一点可以吗", action: () => quote(true)},
      ]);
      dialogue.say(r.text);
    }
    function browse() {
      b.hidden = false;
      renderGoods();
      const item = vendor.items.find(i => i.id === selected);
      dialogue.setChoices([
        {label: "问问这件多少钱", spoken:itemQuestion(item), primary: true, action: () => quote()},
        ...(item.type === "toy" ? [{label: "先试一试", action: () => {
          equip(item.id, true);
          previewToy = item.id;
          dialogue.hide();
          notify(`试试${item.name}，不收钱。`, 4);
        }}] : []),
      ]);
      dialogue.say(item.description);
    }
    function renderGoods() {
      goods.replaceChildren();
      for (const item of vendor.items) {
        const card = button("", () => {
          selected = item.id;
          browse();
        }, `j-good${selected === item.id ? " selected" : ""}`);
        card.setAttribute("aria-label", `挑选${item.name}`);
        card.setAttribute("aria-pressed", String(selected === item.id));
        card.append(
          el("b", "", item.name),
          el("span", "price", `${priceFor(state, vendor, item)}文`),
        );
        goods.append(card);
      }
      total.textContent = `钱袋 ${state.money} 文 · 每次买一份`;
    }
    sceneTalk({
      speaker: vendor.owner,
      role: vendor.name,
      kind: "vendor",
      id: vendor.id,
      text: vendor.greeting,
      extra: b,
      choices: [
        {
          label: "看看摊上的货",
          primary: true,
          action: browse,
        },
        ...(vendor.id === "flowers"
          ? [{ label: "聊聊花婆婆托的花", action: flowerStory }]
          : []),
        {label:"谢谢，再见",action:()=>dialogue.hide("goodbye")},
      ],
    });
  }
  let drumSession = null;
  function drumSound() {
    audio.effect("drum");
  }
  function startDrum(quiet) {
    if (quiet) doudou.actor.root.position.set(2.9, 0.5, 13.0);
    if (!hasRattle(state)) storyAction(state, "doudou-loan");
    equip("rattle");
    changed();
    drumSession = { count: 0 };
    dialogue.hide();
    notify(
      quiet
        ? "和豆豆站到安静处。用右下角“摇一摇”轻轻摇三次。"
        : "豆豆敲了两下。用右下角“摇一摇”回应他三次。",
      7,
    );
  }
  const windRoot = new THREE.Group();
  windRoot.position.set(-5.8, 4.95, 0.05);
  gameWorld.add(windRoot);
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.023, 0.023, 1.25, 8),
    new THREE.MeshStandardMaterial({ color: "#937049" }),
  );
  pole.position.y = 0.6;
  windRoot.add(pole);
  const windClothGeo = new THREE.PlaneGeometry(0.75, 0.18, 12, 2),
    windCloth = new THREE.Mesh(
      windClothGeo,
      new THREE.MeshStandardMaterial({
        color: "#d9b75d",
        side: THREE.DoubleSide,
        roughness: 0.9,
      }),
    );
  windCloth.position.set(0.31, 1.1, -0.22);
  windCloth.rotation.y = 0.61;
  windRoot.add(windCloth);
  function observeBridge() {
    const first = !has(state, "ribbon");
    if (first) storyAction(state, "ribbon");
    visit(state, "bridge");
    changed();
    if (first)
      notify("站在虹桥上：旗子和柳梢顺风摆动，纸鸢要朝着来风放。", 7);
  }
  function openHarbor() {
    sceneTalk({
      speaker: "沈船娘",
      role: "汴河渡口",
      kind: "harbor",
      id: "harbor",
      text: "桥上逛过了？要不要从桥底下再看一回？一圈约一分钟，船费十二文。没有船费也没关系，帮我记一句沿岸见闻就好。",
      choices: [
        {
          label:
            state.money >= HARBOR.fare
              ? "付12文，坐船游览"
              : "用见闻换这一趟船费",
          action: board,
          primary: true,
        },
        ...(storyReady(state) &&
        state.rides > 0 &&
        state.poems.length &&
        !has(state, "finale")
          ? [{ label: "朋友到齐了，开始游会", action: prepareFinale }]
          : []),
        { label: "我再逛逛", action: () => dialogue.hide() },
      ],
    });
  }
  const cruiseCurve = new THREE.CatmullRomCurve3(
    [
      V(-24, 0.25, riverCenter(-24) + 3.8),
      V(-21, 0.25, riverCenter(-21) + 0.8),
      V(-5, 0.25, 0.1),
      V(14, 0.25, riverCenter(14)),
      V(20, 0.25, riverCenter(20) - 0.6),
      V(15, 0.25, riverCenter(15) - 1.8),
      V(-5, 0.25, -1.7),
      V(-22, 0.25, riverCenter(-22) + 0.7),
      V(-24, 0.25, riverCenter(-24) + 3.8),
    ],
    false,
    "centripetal",
  );
  function board() {
    if (cruise) return;
    dialogue.hide();
    if (state.money >= HARBOR.fare) state.money -= HARBOR.fare;
    else state.journal.push("沈船娘请我用沿岸见闻换一趟船费。");
    route = [];
    closePanel();
    unequip();
    ship.visible = false;
    playerBoat.visible = true;
    playerBoat.position.copy(dockPose.position);
    playerBoat.quaternion.copy(dockPose.quaternion);
    playerBoat.add(hero.root);
    hero.root.position.set(-1.9, 0.16, 0);
    hero.root.rotation.y = -Math.PI / 2;
    cruise = {
      progress: 0,
      returning: false,
      poemShown: false,
      cameraYaw: playerBoat.rotation.y,
    };
    // A low riverside view sees the passenger and the timber arch, rather than
    // following the boat from above the opaque bridge deck.
    hero.root.getWorldPosition(heroWorld);
    controls.target.copy(heroWorld).add(V(0, 0.85, 0));
    camera.position
      .copy(controls.target)
      .add(V(-6, 2, 4).applyQuaternion(playerBoat.quaternion));
    controls.update();
    changed();
    notify("跨上船，落座。沈船娘：“坐稳啦，看看两岸。”", 5);
  }
  function disembark() {
    if (!cruise) return;
    cruise = null;
    playerBoat.visible = false;
    ship.visible = true;
    gameWorld.add(hero.root);
    position.x = HARBOR.x;
    position.z = HARBOR.z;
    position.y = walkSurface(position.x, position.z) ?? 0.5;
    hero.root.position.set(position.x, position.y, position.z);
    hero.root.rotation.y = 0;
    controls.target.copy(hero.root.position).add(V(0, 0.85, 0));
    camera.position.copy(controls.target).add(V(2.3, 1.65, 4.2));
    controls.update();
    state.rides++;
    state.journal.push("坐篷船穿过虹桥，看见了桥底层层相扣的木拱。");
    changed();
    closePanel();
    notify("篷船回到渡口，稳稳上岸。", 4);
    if (storyReady(state) && state.poems.length && !has(state, "finale"))
      prepareFinale();
  }
  function openPoem() {
    if (!cruise) {
      notify("坐上篷船，再把见闻写给船娘听。");
      return;
    }
    const samples = [
      "我在虹桥看见大船。",
      has(state, "drum")
        ? "我和豆豆把小鼓摇响了。"
        : "汴河的春风吹过我的衣袖。",
    ];
    sceneTalk({
      speaker: "沈船娘",
      role: "舟中吟一句",
      kind: "aboard",
      id: "aboard",
      text: "今天最想记住什么？挑一句讲给我听吧。",
      choices: samples.map((text, index) => ({
        label: text,
        primary: index === 0,
        action: () => recordPoem(text),
      })),
    });
  }
  function recordPoem(text) {
    state.poems.push(text);
    state.journal.push(`舟中记下：“${text}”`);
    changed();
    verse.textContent = text.replace(/[，。]/g, "\n");
    verse.hidden = false;
    verseUntil = worldTime + 8;
    const answer = /豆豆|鼓/.test(text)
      ? "你把豆豆的鼓声也带上船啦。"
      : /桥/.test(text)
        ? "从桥上走过，又从桥下看过，这句话有你今天的脚步。"
        : "这句是你的见闻，我替你收好。";
    dialogue.say(answer);
  }
  function unequip() {
    if (held) disposeToy(held.toy);
    held = null;
    if (flight) disposeToy(flight.toy);
    flight = null;
    kiteString.visible = false;
    heldUI.hidden = true;
    previewToy = null;
  }
  function equip(id, temporary = false) {
    if (!temporary && !(state.inventory[id] > 0)) return;
    unequip();
    const toy = makeToy(id);
    handPoint.add(toy.root);
    toy.root.scale.setScalar(id === "rattle" ? 0.62 : 0.85);
    held = { id, toy, temporary, expires: worldTime + 14 };
    heldUI.hidden = false;
    if (id === "sachet") {
      hero.root.add(toy.root);
      toy.root.position.set(0.14, 0.68, 0.13);
    }
    heldUI.replaceChildren(
      el("span", "", ITEM_CATALOG[id]?.name || "春日纸鸢"),
      button(
        id === "rattle"
          ? "摇一摇"
          : id === "dragonfly"
            ? "搓一搓"
            : id === "kite"
              ? "放起来"
              : id === "bamboo-fan"
                ? "扇一扇"
                : ITEM_CATALOG[id]?.type === "food"
                  ? "尝一口"
                  : "看看",
        () => playToy(),
      ),
      button("收起", () => unequip()),
    );
  }
  function playToy() {
    if (!held) return;
    const { id } = held;
    playUntil = worldTime + 4;
    if (ITEM_CATALOG[id]?.type === "food") {
      const food = useFood(state, id);
      if (food) {
        stamina = Math.min(100, stamina + food.energy);
        ateUntil = worldTime + 3;
        changed();
        notify(`尝了一口${food.name}，体力恢复${food.energy}点。`);
      }
      return;
    }
    if (!state.played.includes(id) && !held.temporary) {
      state.played.push(id);
      state.journal.push(`在汴京把玩了${ITEM_CATALOG[id]?.name || "纸鸢"}。`);
      changed();
    }
    if (id === "rattle") {
      drumSound();
      lastBeat = Math.floor(worldTime * 4);
      drumBeats++;
      if (drumSession && !has(state, "drum")) {
        drumSession.count++;
        if (drumSession.count >= 3) {
          const result = storyAction(state, "drum");
          drumSession = null;
          changed();
          resultPanel("和豆豆合上拍子", result);
        }
      }
    } else if (id === "dragonfly") {
      if (flight) {
        disposeToy(flight.toy);
        flight = null;
      }
      const toy = makeToy("dragonfly");
      gameWorld.add(toy.root);
      hero.root.getWorldPosition(heroWorld);
      flight = {
        toy,
        start: worldTime,
        origin: heroWorld.clone().add(V(0, 1, 0)),
      };
      held.toy.root.visible = false;
    } else if (id === "kite") {
      if (flight) {
        disposeToy(flight.toy);
        flight = null;
        kiteString.visible = false;
        notify("慢慢收线，把纸鸢带回手里。");
        held.toy.root.visible = true;
        return;
      }
      const toy = makeToy("kite");
      decorateKite(toy, state);
      toy.root.scale.setScalar(2.7);
      gameWorld.add(toy.root);
      flight = { toy, start: worldTime, kind: "kite" };
      held.toy.root.visible = false;
      kiteString.visible = true;
      notify("牵着线走走吧，纸鸢会跟着你。");
    } else if (ITEM_CATALOG[id]?.type === "flower")
      notify("一枝春花在手，慢慢看。想送给婆婆，可以到她身边交谈。");
  }
  function paintStoryKite() {
    decorateKite(ayaKite, state);
    if (flight?.kind === "kite") decorateKite(flight.toy, state);
  }
  function prepareFinale() {
    if (!storyReady(state) || !state.rides || !state.poems.length || cruise)
      return;
    closePanel();
    friends.forEach((f, i) => {
      f.actor.root.position.set(HARBOR.x + (i - 1) * 1.8, 0.5, HARBOR.z + 2.2);
      const destination = destinations.find((d) => d.id === f.id);
      destination.target = {
        x: f.actor.root.position.x,
        z: f.actor.root.position.z + 0.9,
      };
    });
    const bench = obstacles.find((o) => o.source === "granny-bench");
    if (bench) {
      bench.x = granny.actor.root.position.x;
      bench.z = granny.actor.root.position.z;
    }
    sceneTalk({
      speaker: "阿芽",
      role: "春日游会",
      kind: "friend",
      id: "aya",
      text: "豆豆的鼓、婆婆的花、虹桥和汴河都画上去了。这次由你牵线，好不好？",
      choices: [
        { label: "牵住线，开始放飞", action: beginFinaleFlight, primary: true },
        { label: "等我准备一下", action: () => dialogue.hide() },
      ],
    });
  }
  function beginFinaleFlight() {
    dialogue.hide();
    state.inventory.kite ??= 1;
    equip("kite");
    playToy();
    finale = { progress: 0, holding: false };
    heldUI.replaceChildren(
      el("span", "", "阿芽：慢慢放，我替你接住多余的线。"),
    );
    const release = button("按住放线", () => {}, "primary");
    release.addEventListener("pointerdown", (e) => {
      release.setPointerCapture(e.pointerId);
      if (finale) finale.holding = true;
    });
    for (const type of ["pointerup", "pointercancel"])
      release.addEventListener(type, () => {
        if (finale) finale.holding = false;
      });
    const easy = button("帮我慢慢放线", () => {
      if (finale) finale.holding = true;
    });
    heldUI.append(release, easy);
    notify("按住右下角放线，也可以牵着纸鸢沿岸走。", 7);
  }
  function finaleComplete() {
    if (!finishStory(state)) return;
    state.completed = true;
    finale = null;
    changed();
    equip("kite");
    playToy();
    const b = openPanel("今天逛过的地方，都飞起来了", "阿芽的春日游会");
    b.className = "j-finale";
    b.append(el("span", "big-seal", "春"));
    para(b, "阿芽：“你看，小鼓、春花，还有刚才走过的虹桥，都飞起来啦！”");
    const picture = document.createElement("canvas");
    picture.width = 480;
    picture.height = 560;
    picture.style.width = "100%";
    drawKite(picture, state);
    b.append(picture);
    b.append(
      button("保存我的纸鸢", () => {
        const a = document.createElement("a");
        a.download = "我的汴京春游.png";
        a.href = picture.toDataURL("image/png");
        a.click();
      }, "primary"),
      button("带着纸鸢继续逛", () => closePanel()),
    );
  }
  function getNear() {
    if (cruise) return { id: "aboard", name: "在汴河上", kind: "aboard" };
    if(dismissedVendor) {
      const target=destinations.find(v=>v.id===dismissedVendor)?.target;
      if(!target || distance(position,target)>2.75)dismissedVendor=null;
    }
    const objects = [
      ...friends.map((f) => ({
        ...f,
        kind: "friend",
        target: f.actor.root.position,
      })),
      ...destinations.filter((d) => d.kind !== "friend"),
    ];
    let best = null,
      min = Infinity;
    for (const d of objects) {
      if(d.kind==="vendor" && d.id===dismissedVendor)continue;
      const target = d.target || d,
        dist = distance(position, target),
        limit =
          d.kind === "vendor"
            ? 2.05
            : d.kind === "sight"
              ? d.id === "bridge"
                ? 1.6
                : 2.4
              : 1.9;
      const friend =
        d.kind === "friend" ? friends.find((f) => f.id === d.id) : null;
      const approach = friend
        ? {
            x: target.x + Math.sin(friend.actor.root.rotation.y) * 0.8,
            z: target.z + Math.cos(friend.actor.root.rotation.y) * 0.8,
          }
        : target;
      if (
        dist < limit &&
        dist < min &&
        Math.abs((walkSurface(target.x, target.z) ?? 0.5) - position.y) < 1.1 &&
        clearSegment(position, approach, obstacles)
      ) {
        best = d;
        min = dist;
      }
    }
    return best;
  }
  function interact() {
    if (!active || paused || modal) return;
    if (dialogue.active) {
      dialogue.advance();
      return;
    }
    near = getNear();
    if (!near) {
      notify("走近人、摊位或渡口，就能打声招呼。");
      return;
    }
    if (near.kind === "friend") openFriend(near.id);
    else if (near.kind === "vendor")
      openShop(VENDORS.find((v) => v.id === near.id));
    else if (near.kind === "harbor") openHarbor();
    else if (near.kind === "aboard") openPoem();
    else if (near.id === "bridge") observeBridge();
    else {
      const firstVisit = visit(state, near.id);
      changed();
      if (firstVisit) notify(`${near.name}：${SIGHTS.find((s) => s.id === near.id).text}`, 7);
    }
  }
  function updateContext() {
    near = getNear();
    context.hidden =
      !!modal ||
      !!finale ||
      dialogue.active ||
      (!near && !route.length && !guide);
    if (!state.learnedMovement && !route.length && !cruise) context.hidden = true;
    if (route.length) {
      context.hidden = false;
      contextText.textContent = `正去${routeName} · 随时可自己走`;
      interactButton.textContent = "停下来看看";
    } else {
      contextText.textContent = cruise
        ? `篷船游河 · ${Math.round(cruise.progress * 100)}%`
        : near
          ? near.name
          : "沿汴河走走，找找今天的朋友";
      interactButton.textContent = cruise
        ? "吟诗 / 记见闻"
        : near
          ? near.kind === "vendor"
            ? "和掌柜交谈 · E"
            : near.kind === "harbor"
              ? "问问船娘 · E"
              : near.kind === "sight"
                ? "停下看看 · E"
                : "打声招呼 · E"
          : "看看地图";
    }
    if (cruise && !context.querySelector("[data-return]")) {
      const back = button("提前返航", () => {
        cruise.returning = true;
        notify("船娘调转船头，沿航线回渡口。");
      });
      back.dataset.return = "true";
      context.append(back);
    }
    if (!cruise) context.querySelector("[data-return]")?.remove();
  }
  // Capture only gameplay keys. Text fields keep normal editing and IME behavior.
  window.addEventListener(
    "keydown",
    (e) => {
      if (!active) return;
      if (e.key === "Tab" && panel) {
        const list = [
            ...panel.querySelectorAll("button,input,textarea,select"),
          ].filter((n) => !n.disabled && n.offsetParent !== null),
          a = list[0],
          b = list.at(-1);
        if (e.shiftKey && document.activeElement === a) {
          b?.focus();
          e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === b) {
          a?.focus();
          e.preventDefault();
        }
        return;
      }
      if (e.key === "Escape") {
        if (dialogue.active) {
          dialogue.hide();
          e.preventDefault();
          return;
        }
        if (menuCard) closeMenu();
        else if (modal) {
          if (paused) paused = false;
          closePanel();
        } else openPause();
        e.preventDefault();
        return;
      }
      if (
        /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) ||
        e.target.isContentEditable
      )
        return;
      if (modal || menuCard || paused) return;
      const movement = [
        "KeyW",
        "KeyA",
        "KeyS",
        "KeyD",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "ShiftLeft",
        "ShiftRight",
      ];
      if (movement.includes(e.code)) {
        dialogue.hide();
        keys.add(e.code);
        route = [];
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      if (e.repeat) return;
      if (e.code === "KeyE") interact();
      if (e.code === "KeyB") openBag();
      if (e.code === "KeyM") openMap();
      if (e.code === "Space") {
        playToy();
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true,
  );
  window.addEventListener("keyup", (e) => keys.delete(e.code), true);
  window.addEventListener("blur", clearMovement);
  document.addEventListener("visibilitychange", () => {
    clearMovement();
    audio.pause(document.hidden || paused || !active);
    save();
  });
  window.addEventListener("pagehide", save);
  let padPointer = null;
  pad.addEventListener("pointerdown", (e) => {
    padPointer = e.pointerId;
    pad.setPointerCapture(e.pointerId);
    updatePad(e);
  });
  pad.addEventListener("pointermove", (e) => {
    if (e.pointerId === padPointer) updatePad(e);
  });
  function updatePad(e) {
    if (modal || !active) return;
    dialogue.hide();
    route = [];
    const r = pad.getBoundingClientRect(),
      x = (e.clientX - r.left - r.width / 2) / 38,
      y = (e.clientY - r.top - r.height / 2) / 38,
      scale = Math.max(1, Math.hypot(x, y));
    joystick.x = x / scale;
    joystick.y = y / scale;
    padKnob.style.transform = `translate(${joystick.x * 30}px,${joystick.y * 30}px)`;
  }
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
    pad.addEventListener(type, () => {
      padPointer = null;
      joystick.x = joystick.y = 0;
      padKnob.style.transform = "";
    });
  run.addEventListener("pointerdown", (e) => {
    run.setPointerCapture(e.pointerId);
    joystick.run = true;
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
    run.addEventListener(type, () => (joystick.run = false));
  function update(dt) {
    if (!active) return;
    const step = Math.min(dt, 0.7);
    if (!paused && !document.hidden) worldTime += step;
    const time = worldTime;
    dialogue.update(step);
    if (!paused && !document.hidden) {
      moving = false;
      runningPose = false;
      if (cruise) {
        if (!modal) {
          cruise.progress = THREE.MathUtils.clamp(
            cruise.progress + step * (cruise.returning ? -0.065 : 1 / 65),
            0,
            1,
          );
        }
        const p = cruiseCurve.getPointAt(cruise.progress),
          tangent = cruiseCurve.getTangentAt(
            Math.min(0.99999, cruise.progress),
          );
        playerBoat.position.copy(p);
        playerBoat.rotation.set(
          0,
          Math.atan2(-tangent.z, tangent.x) + (cruise.returning ? Math.PI : 0),
          Math.sin(time * 0.7) * 0.006,
        );
        camera.position
          .sub(controls.target)
          .applyAxisAngle(V(0, 1, 0), playerBoat.rotation.y - cruise.cameraYaw)
          .add(controls.target);
        cruise.cameraYaw = playerBoat.rotation.y;
        hero.pose(time, { seated: true, holdingToy: !!held });
        hero.root.getWorldPosition(heroWorld);
        if (cruise.progress > 0.18 && !cruise.poemShown) {
          cruise.poemShown = true;
          notify("船正从虹桥下经过。点“吟诗 / 记见闻”，写下一句今天。", 7);
        }
        if (cruise.progress >= 1 || (cruise.returning && cruise.progress <= 0))
          disembark();
      } else {
        let dx = 0,
          dz = 0;
        if (!modal) {
          const walkers = [
            ...(getCrowd?.() || []),
            ...friends.map((f) => ({
              x: f.actor.root.position.x,
              y: f.actor.root.position.y,
              z: f.actor.root.position.z,
              radius: 0.18,
            })),
          ].filter(
            (p) =>
              Math.abs(p.y - position.y) < 1 &&
              distance(position, p) < 4,
          );
          const movementObstacles = [
            ...obstacles,
            ...walkers.map((p) => ({ ...p, kind: "circle", source: "person" })),
          ];
          const horizontal =
            (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) -
            (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0) +
            joystick.x;
          const vertical =
            (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) -
            (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0) -
            joystick.y;
          if (horizontal || vertical) {
            const forward = V().subVectors(controls.target, camera.position);
            forward.y = 0;
            forward.normalize();
            const right = V(-forward.z, 0, forward.x);
            delta
              .copy(forward)
              .multiplyScalar(vertical)
              .addScaledVector(right, horizontal);
            delta.clampLength(0, 1);
            dx = delta.x;
            dz = delta.z;
          }
          const running =
            (keys.has("ShiftLeft") || keys.has("ShiftRight") || joystick.run) &&
            stamina > 5;
          runningPose = running;
          // Match ground travel to the child's gait cycle so the planted foot
          // reads as a step instead of the model sliding across the street.
          const speed = running ? 2.75 : route.length ? 1.35 : 1.25;
          let remaining = step * speed;
          const oldX = position.x,
            oldZ = position.z;
          if (route.length) {
            while (route.length && remaining > 0) {
              const p = route[0],
                d = distance(position, p);
              if (d < 0.06) {
                route.shift();
                continue;
              }
              const amount = Math.min(remaining, d),
                blocked = moveOnLand(
                  position,
                  ((p.x - position.x) / d) * amount,
                  ((p.z - position.z) / d) * amount,
                  movementObstacles,
                );
              remaining -= amount;
              if (blocked && distance(position, p) > 0.08) {
                // Wait for a passer-by, or route around them; never walk through them.
                if (worldTime >= routeRetryAt) {
                  const goal = nearestWalkable(
                    guide?.target || route.at(-1),
                    movementObstacles,
                  );
                  const detour =
                    goal && findRoute(position, goal, movementObstacles);
                  if (detour?.length) route = detour;
                  routeRetryAt = worldTime + 1.5;
                }
                break;
              }
              if (distance(position, p) < 0.06) route.shift();
            }
            if (!route.length)
              notify(`到${routeName}附近了，走近一点就能互动。`, 3);
          } else if (dx || dz)
            moveOnLand(
              position,
              dx * remaining,
              dz * remaining,
              movementObstacles,
            );
          moving = Math.hypot(position.x - oldX, position.z - oldZ) > 0.001;
          if (moving) {
            if (!state.learnedMovement && (horizontal || vertical)) {
              walkedDistance += Math.hypot(position.x - oldX, position.z - oldZ);
              if (walkedDistance > 1.2) {
                state.learnedMovement = true;
                changed();
              }
            }
            hero.root.rotation.y = Math.atan2(
              position.x - oldX,
              position.z - oldZ,
            );
            walkTime += step * (running ? 1.6 : 1);
            if(walkTime-lastFootstep>(running ? 0.31 : 0.5)) {audio.effect("step");lastFootstep=walkTime;}
          }
          stamina = THREE.MathUtils.clamp(
            stamina + (moving && running ? -9 : 8) * step,
            0,
            100,
          );
        }
        hero.root.position.set(position.x, position.y, position.z);
        hero.pose(moving ? walkTime : time, {
          walking: moving,
          running: moving && runningPose,
          holdingToy: !!held || ateUntil > time,
          eating: ateUntil > time,
        });
        heroWorld.copy(hero.root.position);
        for (const sight of SIGHTS)
          if (
            distance(position, sight) < sight.radius &&
            visit(state, sight.id)
          ) {
            changed();
          }
      }
      hero.meshes.handR.matrix.decompose(
        handPoint.position,
        handPoint.quaternion,
        handPoint.scale,
      );
      handPoint.quaternion.identity();
      const detailedHero=heroVisual.update(paused ? 0 : step,state.avatar,{
        walking:moving, running:moving && runningPose, seated:!!cruise,
        holdingToy:!!held || ateUntil>time,
        playing: !!held && time < playUntil,
      },handPoint);
      if(detailedHero) for(const mesh of Object.values(hero.meshes)) mesh.visible=false;
      if (held) {
        held.toy.update(time, time < playUntil);
        if (
          held.id === "rattle" &&
          time < playUntil &&
          Math.floor(time * 4) !== lastBeat
        ) {
          lastBeat = Math.floor(time * 4);
          drumSound();
        }
        if (held.id === "bamboo-fan")
          held.toy.root.rotation.y =
            time < playUntil ? Math.sin(time * 8) * 0.6 : 0;
        if (held.temporary && previewToy && time > held.expires) {
          unequip();
        }
      }
      if (ateUntil && time > ateUntil) {
        ateUntil = 0;
        if (held && ITEM_CATALOG[held.id]?.type === "food") unequip();
      }
      if (flight) {
        const age = time - flight.start;
        if (flight.kind === "kite") {
          const rise = finale
            ? 1.5 + Math.min(1, finale.progress / 2.7) * 4
            : 5.5;
          flight.toy.root.position
            .copy(heroWorld)
            .add(V(1.3 + Math.sin(time * 0.6) * 0.3, rise, -1.5));
          flight.toy.update(time, true);
          handPoint.getWorldPosition(projected);
          const a = stringGeometry.attributes.position;
          a.setXYZ(0, projected.x, projected.y, projected.z);
          a.setXYZ(
            1,
            flight.toy.root.position.x,
            flight.toy.root.position.y,
            flight.toy.root.position.z,
          );
          a.needsUpdate = true;
          stringGeometry.computeBoundingSphere();
        } else {
          const t = Math.min(1, age / 5);
          flight.toy.root.position
            .copy(flight.origin)
            .add(
              V(
                Math.sin(t * Math.PI) * 1.5,
                Math.sin(t * Math.PI) * 2.8,
                t * 0.6,
              ),
            );
          flight.toy.update(time, true);
          if (t >= 1) {
            disposeToy(flight.toy);
            flight = null;
            if (held) held.toy.root.visible = true;
          }
        }
      }
      if (finale?.holding) {
        finale.progress += step;
        if (finale.progress >= 2.7 && !has(state, "finale")) {
          finale.holding = false;
          finaleComplete();
        }
      }
      for (const f of friends) {
        const extra = {
          holdingToy: f.id === "doudou" || f.id === "granny",
          seated: f.id === "granny",
        };
        f.actor.pose(time, extra);
        if (f.id === "doudou") {
          f.actor.meshes.handR.matrix.decompose(
            doudouHandPoint.position,
            doudouHandPoint.quaternion,
            doudouHandPoint.scale,
          );
          doudouHandPoint.quaternion.identity();
          doudouHandPoint.scale.set(1, 1, 1);
          f.actor.root.rotation.z = has(state, "drum")
            ? Math.sin(time * 3) * 0.025
            : 0;
          friendDrum.update(time, has(state, "drum") || !!drumSession);
        }
      }
      const p = windClothGeo.attributes.position;
      for (let i = 0; i < p.count; i++)
        p.setZ(
          i,
          Math.sin(time * 4 + p.getX(i) * 9) * 0.04 * (p.getX(i) + 0.4),
        );
      p.needsUpdate = true;
      windClothGeo.computeVertexNormals();
      if (lastSave + 3 < time) {
        save();
        lastSave = time;
      }
    }
    follow.copy(heroWorld).add(V(0, 0.85, 0));
    if (flight?.kind === "kite") {
      follow.y += 1.8;
      const offset = V().subVectors(camera.position, controls.target),
        length = offset.length();
      if (worldTime - flight.start < 3 && length < 13.5)
        camera.position.addScaledVector(
          offset,
          (1 - Math.exp(-Math.min(dt, 0.7) * 2)) *
            (13.5 / Math.max(length, 0.01) - 1),
        );
    }
    if (modal && innerWidth > 700)
      follow.addScaledVector(
        V(1, 0, 0).applyQuaternion(camera.quaternion),
        2.0,
      );
    delta
      .copy(follow)
      .sub(controls.target)
      .multiplyScalar(1 - Math.exp(-Math.min(dt, 0.7) * 7));
    controls.target.add(delta);
    camera.position.add(delta);
    footRing.position.set(position.x, position.y + 0.018, position.z);
    footRing.visible = !cruise;
    guideDots.visible = !!guide && !cruise && !modal;
    if (guide && !cruise) {
      if (distance(position, guide.target) < 1.0) {
        guide = null;
        guideDots.visible = false;
        notify("就在附近了。看看招牌和货物，走近掌柜打个招呼。", 5);
      } else {
        if (
          worldTime > guideRefresh &&
          distance(position, guide.origin) > 0.3
        ) {
          const updated = findRoute(position, guide.target, obstacles);
          if (updated) guide.path = updated;
          guide.origin = { x: position.x, z: position.z };
          guideRefresh = worldTime + 1.5;
        }
        let count = 0,
          carry = 0.22,
          from = position;
        for (const to of guide.path) {
          const length = distance(from, to);
          if (length > 0.001) {
            for (; carry < length && count < 32; carry += 0.4) {
              const t = carry / length,
                x = from.x + (to.x - from.x) * t,
                z = from.z + (to.z - from.z) * t;
              guideObject.position.set(
                x,
                (walkSurface(x, z) ?? 0.5) + 0.025,
                z,
              );
              guideObject.updateMatrix();
              guideDots.setMatrixAt(count++, guideObject.matrix);
            }
            carry -= length;
          }
          from = to;
          if (count >= 32) break;
        }
        guideDots.count = count;
        guideDots.instanceMatrix.needsUpdate = true;
      }
    }
    const current = Math.floor(time * 4);
    if (current !== lastHud) {
      lastHud = current;
      refreshHud();
      updateMiniMap();
      updateContext();
    }
    for (const f of friends) {
      const p = f.actor.root.position;
      projected
        .set(p.x, p.y + (f.age === "child" ? 1.15 : 1.55), p.z)
        .project(camera);
      const close = distance(heroWorld, p) < 5;
      f.label.hidden = !close || !state.learnedMovement || !!modal || dialogue.active || projected.z > 1 ||
        (!has(state, "invited") && f.id !== "aya") || (near && near.id !== f.id);
      f.label.style.transform = `translate(${(projected.x * 0.5 + 0.5) * innerWidth}px,${(-projected.y * 0.5 + 0.5) * innerHeight}px) translate(-50%,-100%)`;
    }
    for (const { vendor, label } of vendorLabels) {
      projected.set(vendor.x, 2.7, vendor.z + 0.3).project(camera);
      const target = destinations.find((d) => d.id === vendor.id).target;
      label.hidden =
        !!modal ||
        !state.learnedMovement || !has(state, "invited") ||
        near?.id !== vendor.id || distance(position, vendor) > 5 ||
        projected.z > 1 ||
        !clearSegment(position, target, obstacles) ||
        (dialogue.active && speakingTo?.id !== vendor.id);
      label.style.transform = `translate(${(projected.x * 0.5 + 0.5) * innerWidth}px,${(-projected.y * 0.5 + 0.5) * innerHeight}px) translate(-50%,-100%)`;
    }
    if (toastUntil < time) toast.hidden = true;
    if (verseUntil < time) verse.hidden = true;
  }
  paintStoryKite();
  refreshHud();
  return {
    update,
    get active() {
      return active;
    },
    get paused() {
      return paused;
    },
    get focus() {
      return heroWorld;
    },
    get crowdBodies() {
      return friends.map(f=>{
        const p=f.actor.root.getWorldPosition(new THREE.Vector3());
        return {x:p.x,y:p.y,z:p.z,radius:f.age==="child" ? 0.22 : 0.3};
      });
    },
    snapshot: () => ({
      active,
      paused,
      modal,
      position: { ...position },
      money: state.money,
      inventory: { ...state.inventory },
      story: [...state.story],
      visited: [...state.visited],
      poems: [...state.poems],
      rides: state.rides,
      avatar: state.avatar,
      heroModel: heroVisual.status,
      learnedMovement: state.learnedMovement,
      audio: { ...audio.settings, ...audio.status },
      flowerChoice: state.flowerChoice,
      stamina,
      route: route.map((p) => ({ ...p })),
      routeName,
      near: near?.id,
      dismissedVendor,
      held: held?.id,
      temporary: held?.temporary,
      drumBeats,
      drumCount: drumSession?.count,
      wind: null,
      cruise: cruise
        ? {
            ...cruise,
            position: playerBoat.position.toArray(),
            passenger: heroWorld.toArray(),
          }
        : null,
      finale: finale ? { ...finale } : null,
      completed: state.completed,
      dialogue: dialogue.active
        ? { speaker: dialogue.speaker, id: speakingTo?.id }
        : null,
      guidance: guide ? { id: guide.id, name: guide.name } : null,
      toyPlaying: worldTime < playUntil,
      flight: flight
        ? {
            kind: flight.kind || "dragonfly",
            position: flight.toy.root.position.toArray(),
          }
        : null,
      friends: friends.map((f) => ({
        id: f.id,
        gender: f.gender,
        age: f.age,
        position: f.actor.root.position.toArray(),
      })),
    }),
  };
}

function drawKite(canvas, state) {
  const c = canvas.getContext("2d"),
    w = canvas.width,
    h = canvas.height;
  c.clearRect(0, 0, w, h);
  c.fillStyle = "#f6ead0";
  c.fillRect(0, 0, w, h);
  c.strokeStyle = "#b59a66";
  c.lineWidth = 2;
  c.strokeRect(12, 12, w - 24, h - 24);
  c.fillStyle = "#665037";
  c.font = `${w * 0.045}px serif`;
  c.textAlign = "center";
  c.fillText("我的汴京春游", w * 0.5, h * 0.09);
  c.save();
  c.translate(w * 0.5, h * 0.43);
  c.beginPath();
  c.moveTo(0, -h * 0.27);
  c.lineTo(w * 0.35, 0);
  c.lineTo(0, h * 0.27);
  c.lineTo(-w * 0.35, 0);
  c.closePath();
  c.fillStyle = "#ead6a7";
  c.fill();
  c.strokeStyle = "#a65c42";
  c.lineWidth = 6;
  c.stroke();
  c.clip();
  c.fillStyle = "#c9a54e";
  c.beginPath();
  c.arc(45, -65, 22, 0, Math.PI * 2);
  c.fill();
  if (has(state, "ribbon") || state.visited.includes("bridge")) {
    c.strokeStyle = "#786147";
    c.lineWidth = 9;
    c.beginPath();
    c.moveTo(-110, 45);
    c.quadraticCurveTo(0, -55, 110, 45);
    c.stroke();
    c.lineWidth = 2;
    for (let i = -90; i <= 90; i += 18) {
      c.beginPath();
      c.moveTo(i, 40);
      c.lineTo(i, 5 + Math.abs(i) * 0.25);
      c.stroke();
    }
    c.strokeStyle = "#71968b";
    c.beginPath();
    c.moveTo(-160, 65);
    c.quadraticCurveTo(0, 30, 160, 65);
    c.stroke();
  }
  if (has(state, "drum")) {
    c.fillStyle = "#ac5141";
    c.beginPath();
    c.ellipse(-65, -50, 28, 23, -0.2, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#896738";
    c.lineWidth = 8;
    c.beginPath();
    c.moveTo(-65, -25);
    c.lineTo(-68, 6);
    c.stroke();
  }
  if (has(state, "flower") || has(state, "gift")) {
    c.fillStyle =
      state.flowerChoice === "peony"
        ? "#ad5872"
        : state.flowerChoice === "willow-sprig"
          ? "#7f9d69"
          : "#d18b94";
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      c.beginPath();
      c.ellipse(
        65 + Math.cos(a) * 16,
        7 + Math.sin(a) * 16,
        16,
        11,
        a,
        0,
        Math.PI * 2,
      );
      c.fill();
    }
    c.fillStyle = "#c8a04a";
    c.beginPath();
    c.arc(65, 7, 7, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
  c.strokeStyle = "#a45d45";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(w * 0.5, h * 0.7);
  c.bezierCurveTo(w * 0.32, h * 0.78, w * 0.7, h * 0.78, w * 0.5, h * 0.86);
  c.stroke();
  if (has(state, "gift")) {
    c.fillStyle = "#78788d";
    c.fillRect(w * 0.45, h * 0.755, w * 0.1, 7);
  }
  c.fillStyle = "#574936";
  c.font = `${w * 0.03}px serif`;
  const text = state.poems.at(-1) || "把沿途的见闻，慢慢画上纸鸢。";
  const lines = text.match(/.{1,18}/gu) || [];
  for (let i = 0; i < Math.min(3, lines.length); i++)
    c.fillText(lines[i], w * 0.5, h * 0.9 + i * w * 0.043);
}
function decorateKite(toy, state) {
  const base = toy.root.children.find((o) => o.isMesh);
  if (!base) return;
  let art = toy.root.getObjectByName("journey-paint");
  if (!art) {
    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = 560;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const geometry = base.geometry.clone();
    geometry.setAttribute(
      "uv",
      new THREE.Float32BufferAttribute(
        [0.5, 1, 1, 0.5, 0.5, 0, 0, 0.5, 0.5, 0.5],
        2,
      ),
    );
    const material = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.92,
      side: THREE.DoubleSide,
    });
    material.userData.toyOwned = true;
    art = new THREE.Mesh(geometry, material);
    art.name = "journey-paint";
    art.position.z = 0.017;
    art.userData.canvas = canvas;
    toy.root.add(art);
  }
  drawKite(art.userData.canvas, state);
  art.material.map.needsUpdate = true;
}
function disposeToy(toy) {
  toy.root.removeFromParent();
  toy.root.traverse((o) => {
    if (!o.isMesh && !o.isLine) return;
    o.geometry?.dispose();
    const materials = Array.isArray(o.material) ? o.material : [o.material];
    for (const material of materials)
      if (material?.userData.toyOwned) {
        material.map?.dispose();
        material.dispose();
      }
  });
}
