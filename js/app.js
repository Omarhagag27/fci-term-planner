/* Boot: view switching (schedule / gpa), URL hash, accent colour. */
(function () {
  "use strict";
  const { $, store } = FCI;
  const VIEWS = ["schedule", "gpa"];

  FCI.view = "schedule";

  /** Hash formats:  #gpa   #schedule   #schedule/1/y1g1/3   (and the old #1/y1g1/3) */
  function parseHash() {
    const p = location.hash.slice(1).split("/").filter(Boolean);
    let view = "schedule";
    if (p[0] === "gpa") { view = "gpa"; p.length = 0; }
    else if (p[0] === "schedule") p.shift();
    const sel = p.length === 3 ? { y: +p[0], g: p[1], s: +p[2] } : null;
    return { view, sel };
  }

  FCI.syncHash = function () {
    let h;
    if (FCI.view === "gpa") h = "#gpa";
    else {
      const k = FCI.schedule.selectionKey();
      h = k ? "#schedule/" + k : "#schedule";
    }
    try { history.replaceState(null, "", h); } catch (e) {}
  };

  function setView(v, scroll) {
    FCI.view = v;
    VIEWS.forEach(n => {
      $("view-" + n).hidden = n !== v;
      $("nav-" + n).setAttribute("aria-selected", String(n === v));
    });
    FCI.schedule.render();   // refreshes the picker / day tabs visibility
    FCI.syncHash();
    if (scroll) window.scrollTo({ top: 0 });
  }

  function setAccent(name) {
    document.documentElement.dataset.accent = name;
    store.set("fci.accent", name);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = "#060a08";
  }

  function boot() {
    const h = parseHash();
    const accent = store.get("fci.accent", "green");
    setAccent(["green", "amber", "cyan"].includes(accent) ? accent : "green");
    document.querySelectorAll(".accents button").forEach(b => { b.onclick = () => setAccent(b.dataset.accent); });
    document.querySelectorAll(".nav button").forEach(b => { b.onclick = () => setView(b.dataset.view, true); });

    FCI.gpa.init();
    FCI.view = h.view;
    VIEWS.forEach(n => {
      $("view-" + n).hidden = n !== h.view;
      $("nav-" + n).setAttribute("aria-selected", String(n === h.view));
    });
    FCI.schedule.load(h.sel);
  }

  boot();
})();
