/* Schedule view: loads schedule.json, lets the student pick year / group / section,
   and renders one day at a time on phones, all days on wide screens. */
(function () {
  "use strict";
  const { $, el, store, hue, fmtTime, cleanCourse, normAr } = FCI;

  const DAYS = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
  // JS getDay(): Sun=0..Sat=6  ->  our index: Sat=0..Thu=5, Fri=6 (no classes)
  const todayIdx = (new Date().getDay() + 1) % 7;

  const S = { data: null, y: null, g: null, s: null, day: 0, open: true };

  const cleanInstr = s => (s && s.replace(/[\s/]/g, "").length > 1 ? s.trim() : "");
  const yearObj = () => S.data.years.find(v => v.id === S.y);
  const groupObj = () => { const y = S.data && yearObj(); return y && y.groups.find(v => v.id === S.g); };
  const defaultDay = () => (todayIdx < DAYS.length ? todayIdx : 0);

  /* ---------- loading ---------- */
  async function load(hashSel) {
    const app = $("app");
    app.replaceChildren(Object.assign(el("div", "state"), { innerHTML: "<p>جاري تحميل الجدول…</p>" }));
    try {
      const r = await fetch("schedule.json", { cache: "no-cache" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      S.data = await r.json();
      if (!Array.isArray(S.data.years) || !Array.isArray(S.data.events)) throw new Error("bad format");
    } catch (err) {
      const box = el("div", "state");
      box.append(el("p", "", "تعذّر تحميل ملف الجدول (schedule.json)."));
      if (location.protocol === "file:") {
        const p = el("p", "", "الصفحة مفتوحة مباشرة من الجهاز. شغّل خادمًا محليًا بالأمر: ");
        p.append(el("code", "", "python -m http.server"));
        box.append(p);
      }
      const b = el("button", "btn", "إعادة المحاولة");
      b.type = "button"; b.onclick = () => load(hashSel);
      box.append(b);
      app.replaceChildren(box);
      return;
    }
    restore(hashSel);
    render();
  }

  /* ---------- selection: URL hash > localStorage ---------- */
  function restore(hashSel) {
    const saved = hashSel || store.get("sel", {}) || {};
    const y = S.data.years.find(v => v.id === saved.y);
    const g = y && y.groups.find(v => v.id === saved.g);
    S.y = y ? y.id : null;
    S.g = g ? g.id : null;
    S.s = g && g.sections.includes(saved.s) ? saved.s : null;
    S.open = S.s == null;
    S.day = defaultDay();
  }
  const selectionKey = () => (S.s != null ? `${S.y}/${S.g}/${S.s}` : "");

  /* ---------- data helpers ---------- */
  function byDay() {
    const g = groupObj();
    const out = DAYS.map(() => []);
    if (!g || S.s == null) return out;
    S.data.events
      .filter(e => e.group === g.id && e.sections.includes(S.s) && out[e.day])
      .sort((a, b) => a.start - b.start || a.end - b.end)
      .forEach(e => out[e.day].push(e));
    return out;
  }

  /** Unique course names for the selected section (used by the GPA importer). */
  function currentCourses() {
    if (!S.data || S.s == null) return null;
    const seen = new Map();
    byDay().flat().forEach(e => {
      const key = normAr(e.course);
      if (!key) return;
      const isTutorial = /^\s*["“]?تمارين/.test(e.course);
      const prev = seen.get(key);
      if (!prev || (prev.tutorial && !isTutorial)) seen.set(key, { name: cleanCourse(e.course), tutorial: isTutorial });
    });
    return [...seen.values()].map(v => v.name.replace(/^تمارين\s+/, ""));
  }

  /* ---------- rendering ---------- */
  function chips(host, items, cur, on) {
    host.replaceChildren(...items.map(it => {
      const b = el("button", "chip", it.label);
      b.type = "button";
      b.setAttribute("aria-pressed", String(it.id === cur));
      b.onclick = () => on(it.id);
      return b;
    }));
  }

  function renderPicker() {
    const y = S.data && yearObj(), g = groupObj();
    const complete = S.s != null;
    const active = FCI.view === "schedule";
    $("picker").hidden = !active || (complete && !S.open);
    $("w2").hidden = !y; $("w3").hidden = !g;

    chips($("s1"), S.data.years.map(v => ({ id: v.id, label: v.name })), S.y, id => {
      S.y = id; S.g = S.s = null; S.open = true; render();
    });
    if (y) chips($("s2"), y.groups.map(v => ({ id: v.id, label: v.name })), S.g, id => {
      S.g = id; S.s = null;
      const grp = groupObj();
      if (grp.sections.length === 1) { S.s = grp.sections[0]; S.open = false; S.day = defaultDay(); }
      render();
    });
    if (g) chips($("s3"), g.sections.map(n => ({ id: n, label: "سكشن " + n })), S.s, id => {
      S.s = id; S.open = false; S.day = defaultDay(); render(); window.scrollTo({ top: 0 });
    });

    const who = $("who");
    who.hidden = !(complete && active);
    if (complete) {
      who.replaceChildren(el("span", "", y.name), el("span", "", g.name), el("span", "", "سكشن " + S.s), el("i", "", S.open ? "إغلاق" : "تغيير"));
      who.setAttribute("aria-expanded", String(S.open));
      who.onclick = () => { S.open = !S.open; renderPicker(); window.scrollTo({ top: 0 }); };
    }
  }

  function renderTabs(days) {
    const tabs = $("tabs");
    const show = S.s != null && FCI.view === "schedule";
    tabs.hidden = !show;
    if (!show) return;
    tabs.replaceChildren(...DAYS.map((d, i) => {
      const b = el("button", "tab" + (i === todayIdx ? " today" : ""));
      b.type = "button";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", String(i === S.day));
      b.append(el("b", "", d), el("small", "", days[i].length ? String(days[i].length) : "—"));
      b.onclick = () => { S.day = i; render(); };
      return b;
    }));
  }

  function summary(list) {
    if (!list.length) return "لا توجد محاضرات";
    return `${list.length} مواد، من ${fmtTime(list[0].start)} إلى ${fmtTime(Math.max(...list.map(e => e.end)))}`;
  }

  function card(e, status, conflict) {
    const a = el("article", "ev" + (status === "now" ? " now" : ""));
    a.style.setProperty("--h", hue(e.course));
    const t = el("div", "time");
    t.append(el("b", "", fmtTime(e.start)), el("span", "", fmtTime(e.end)));
    const body = el("div");
    const head = el("div", "head");
    head.append(el("h3", "", cleanCourse(e.course)));
    if (status === "now") head.append(el("span", "tag now", "الآن"));
    else if (status === "next") head.append(el("span", "tag", "التالي"));
    if (conflict) head.append(el("span", "tag warn", "تعارض"));
    const meta = el("div", "meta");
    if (e.location) meta.append(el("span", "loc", e.location));
    const ins = cleanInstr(e.instructor);
    if (ins) meta.append(el("span", "", ins));
    body.append(head);
    if (meta.childNodes.length) body.append(meta);
    a.append(t, body);
    return a;
  }

  function renderDays(days) {
    const app = $("app");
    if (S.s == null) {
      app.replaceChildren(el("div", "hint", "اختر الفرقة ثم المجموعة ثم السكشن لعرض الجدول"));
      return;
    }
    const now = new Date();
    const nowH = now.getHours() + now.getMinutes() / 60;
    const wrap = el("div", "days");
    days.forEach((list, i) => {
      const sec = el("section", "day" + (i === S.day ? " active" : "") + (i === todayIdx ? " today" : ""));
      const head = el("div", "dayhead");
      head.append(el("h2", "", DAYS[i]), el("p", "", summary(list)));
      sec.append(head);
      if (!list.length) {
        sec.append(el("div", "none", "يوم بلا محاضرات"));
      } else {
        const ul = el("div", "list");
        let nextDone = false;
        list.forEach(e => {
          let st = "";
          if (i === todayIdx) {
            if (nowH >= e.start && nowH < e.end) st = "now";
            else if (nowH < e.start && !nextDone) { st = "next"; nextDone = true; }
          }
          const conflict = list.some(o => o !== e && o.start < e.end && e.start < o.end);
          ul.append(card(e, st, conflict));
        });
        sec.append(ul);
      }
      wrap.append(sec);
    });
    app.replaceChildren(wrap);
  }

  function render() {
    if (!S.data) return;
    store.set("sel", { y: S.y, g: S.g, s: S.s });
    const days = byDay();
    renderPicker();
    renderTabs(days);
    renderDays(days);
    if (FCI.syncHash) FCI.syncHash();
  }

  /* swipe between days on phones (RTL: swiping left moves forward) */
  (function swipe() {
    let x0 = null, y0 = null;
    document.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    document.addEventListener("touchend", e => {
      if (x0 == null || S.s == null || FCI.view !== "schedule" || innerWidth >= 820) return;
      const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      x0 = null;
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      const next = S.day + (dx < 0 ? 1 : -1);
      if (next >= 0 && next < DAYS.length) { S.day = next; render(); }
    }, { passive: true });
  })();

  FCI.schedule = { load, render, currentCourses, selectionKey };
})();
