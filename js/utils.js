/* Shared helpers. Everything hangs off one global: window.FCI. */
(function () {
  "use strict";
  const FCI = (window.FCI = window.FCI || {});

  FCI.$ = id => document.getElementById(id);

  /** Create an element: el("div", "class", "text"). Text is always set as textContent. */
  FCI.el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  /** localStorage that never throws (private mode, blocked storage, bad JSON). */
  FCI.store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v == null ? fallback : JSON.parse(v);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
    }
  };

  /** Stable hue (0-359) from a string, so a course keeps its colour. */
  FCI.hue = s => {
    let h = 0;
    for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360;
    return h;
  };

  /** 8 -> "08:00" */
  FCI.fmtTime = h => String(h).padStart(2, "0") + ":00";

  /** The Excel export leaves stray quotes and Latin junk in some course names. */
  FCI.cleanCourse = s =>
    String(s || "").replace(/["“”]/g, "").replace(/\b[a-z]{4,}\b/gi, "").replace(/\s+/g, " ").trim();

  /**
   * Normalise an Arabic course name so spelling variants compare equal:
   * "تمارين أساسيات رياضيات" and "اساسيات الرياضيات" -> same key.
   */
  FCI.normAr = s =>
    FCI.cleanCourse(s)
      .replace(/[\u064B-\u0652\u0640]/g, "")
      .replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
      .replace(/^تمارين\s+/, "")
      .replace(/(^|\s)ال/g, "$1")
      .replace(/\s+[ابه]$/, "")
      .replace(/\s+/g, " ").trim();
})();
