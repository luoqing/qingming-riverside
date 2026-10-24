const node = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};
export function createDialogue(parent, onClose, audio) {
  const root = node("section", "j-dialogue");
  root.hidden = true;
  root.setAttribute("role", "region");
  root.setAttribute("aria-label", "场景对话字幕");
  const heading = node("div", "j-dialogue-heading"),
    name = node("strong"),
    role = node("span"),
    leave = node("button", "j-dialogue-leave", "先走走 ×");
  leave.type = "button";
  leave.setAttribute("aria-label", "结束交谈");
  heading.append(name, role, leave);
  const text = node("button", "j-dialogue-line"),
    live = node("p", "j-sr-only"),
    choices = node("div", "j-dialogue-choices"),
    extra = node("div", "j-dialogue-extra");
  text.type = "button";
  text.setAttribute("aria-label", "显示完整字幕或继续");
  live.setAttribute("role", "status");
  root.append(heading, text, live, extra, choices);
  parent.append(root);
  let config = null,
    pages = [],
    page = 0,
    revealed = 0,
    revision = 0,
    replying = false,
    choicePage = 0;
  function split(value) {
    const chunks = String(value).match(/[^。！？；]+[。！？；]?/gu) || [
        String(value),
      ],
      out = [];
    let current = "";
    for (const chunk of chunks) {
      if (current.length + chunk.length > 66 && current) {
        out.push(current);
        current = "";
      }
      current += chunk;
    }
    if (current) out.push(current);
    return out;
  }
  function paint() {
    text.textContent = Array.from(pages[page] || "")
      .slice(0, Math.floor(revealed))
      .join("");
    text.dataset.hint = page < pages.length - 1 ? "继续 ↓" : "";
    choices.hidden = replying || page < pages.length - 1 || revealed < Array.from(pages[page] || "").length;
    extra.hidden = choices.hidden;
  }
  function say(value) {
    revision++;
    replying=false;
    name.textContent = config?.speaker || "";
    role.textContent = config?.role || "";
    pages = split(value);
    page = 0;
    revealed = 0;
    live.textContent = `${config?.speaker || ""}：${value}`;
    paint();
    const current=revision;
    audio?.speak(value,config)?.then(()=>{
      if(current!==revision || root.hidden) return;
      page=pages.length-1;revealed=Array.from(pages[page] || "").length;
      paint();
    });
  }
  function show(next) {
    config = next;
    root.hidden = false;
    document.body.classList.add("talking-to-npc");
    name.textContent = next.speaker;
    role.textContent = next.role || "";
    root.setAttribute("aria-label", `与${next.speaker}交谈`);
    extra.replaceChildren();
    setChoices(next.choices || []);
    if (next.extra) extra.append(next.extra);
    say(next.text);
  }
  function setChoices(items) {
    config.choices = items;
    choicePage = 0;
    renderChoices();
  }
  function renderChoices() {
    choices.replaceChildren();
    const items = config?.choices || [];
    for (const choice of items.slice(choicePage * 2, choicePage * 2 + 2)) {
      const b = node("button", choice.primary ? "primary" : "", choice.label);
      b.type = "button";
      b.disabled = choice.disabled === true;
      b.addEventListener("click", async () => {
        const current=++revision;
        replying=true;
        name.textContent="我"; role.textContent="";
        const spoken=choice.spoken || choice.label;
        pages=[spoken];page=0;revealed=Array.from(spoken).length;
        paint();
        await audio?.reply(spoken);
        if(current!==revision || root.hidden) return;
        replying=false;
        audio?.effect();
        choice.action();
      });
      choices.append(b);
    }
    if (items.length > 2) {
      const more = node("button", "j-choice-more", "换一句 ›");
      more.type = "button";
      more.setAttribute("aria-label", "查看其他回答");
      more.addEventListener("click", () => {
        choicePage = (choicePage + 1) % Math.ceil(items.length / 2);
        renderChoices();
      });
      choices.append(more);
    }
  }
  function hide(reason = "close") {
    if (root.hidden) return;
    root.hidden = true;
    document.body.classList.remove("talking-to-npc");
    config = null;
    revision++;
    audio?.stop();
    onClose(reason);
  }
  function advance() {
    const length = Array.from(pages[page] || "").length;
    if (revealed < length) revealed = length;
    else if (page < pages.length - 1) {
      page++;
      revealed = 0;
    }
    paint();
  }
  leave.addEventListener("click", () => hide("goodbye"));
  text.addEventListener("click", advance);
  return {
    show,
    say,
    setChoices,
    hide,
    advance,
    extra,
    update(dt) {
      if (!root.hidden) {
        revealed += Math.min(dt, 0.15) * 38;
        paint();
      }
    },
    get active() {
      return !root.hidden;
    },
    get speaker() {
      return config?.speaker;
    },
  };
}
