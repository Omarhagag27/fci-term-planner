/* GPA calculator: semester GPA, cumulative GPA, target planner, editable grade scale.
   Formula (credit-hour weighted):  GPA = sum(hours * points) / sum(hours)  */
(function () {
  "use strict";
  const { $, el, store, normAr } = FCI;

  const KEY = "fci.gpa";
  // Standard 4.0 letter scale. Faculties differ, so every value is editable in the UI.
  const DEFAULT_SCALE = [["A+", 4], ["A", 4], ["A-", 3.7], ["B+", 3.3], ["B", 3], ["B-", 2.7],
                         ["C+", 2.3], ["C", 2], ["C-", 1.7], ["D+", 1.3], ["D", 1], ["F", 0]];
  const defaultScale = () => Object.fromEntries(DEFAULT_SCALE);

  const num = v => {
    if (v === "" || v == null) return null;
    const n = parseFloat(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const uid = () => Math.random().toString(36).slice(2, 9);
  const fmtH = n => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  const fmtN = n => String(+n.toFixed(2));

  /* ---------- state ---------- */
  function loadState() {
    const base = { courses: [], prevGpa: "", prevHours: "", target: "", scale: defaultScale() };
    const s = store.get(KEY, null);
    if (!s || typeof s !== "object") return base;
    return {
      courses: Array.isArray(s.courses)
        ? s.courses.filter(c => c && typeof c === "object")
            .map(c => ({ id: c.id || uid(), name: String(c.name || ""), hours: c.hours ?? 3, grade: String(c.grade || "") }))
        : [],
      prevGpa: s.prevGpa ?? "",
      prevHours: s.prevHours ?? "",
      target: s.target ?? "",
      scale: Object.assign(defaultScale(), s.scale && typeof s.scale === "object" ? s.scale : {})
    };
  }
  let G = loadState();
  const save = () => store.set(KEY, G);
  const maxPoints = () => {
    const v = Object.values(G.scale).map(Number).filter(Number.isFinite);
    return v.length ? Math.max(...v) : 4;
  };

  /* ---------- maths ---------- */
  function compute() {
    let hrs = 0, pts = 0, planned = 0;
    G.courses.forEach(c => {
      const h = clamp(num(c.hours) || 0, 0, 12);
      planned += h;
      const p = Number(G.scale[c.grade]);
      if (c.grade && h > 0 && Number.isFinite(p)) { hrs += h; pts += h * p; }
    });
    const pH = num(G.prevHours), pG = num(G.prevGpa);
    const prevOk = pH != null && pH > 0 && pG != null && pG >= 0 && pG <= maxPoints();
    let cum = null;
    if (prevOk) cum = (pG * pH + pts) / (pH + hrs);
    else if (hrs > 0) cum = pts / hrs;
    return { hrs, pts, planned, sem: hrs > 0 ? pts / hrs : null, cum, prevOk, pH, pG };
  }

  /** What semester GPA is needed to reach the target cumulative GPA? */
  function targetMessage(r) {
    const t = num(G.target);
    if (t == null) return { text: "", bad: false };
    if (r.planned <= 0) return { text: "أضف مواد الفصل وساعاتها أولًا لحساب المعدل المطلوب.", bad: false };
    const mx = maxPoints();
    const need = r.prevOk ? (t * (r.pH + r.planned) - r.pG * r.pH) / r.planned : t;
    if (need > mx + 1e-9) {
      const best = r.prevOk ? (r.pG * r.pH + mx * r.planned) / (r.pH + r.planned) : mx;
      return { text: `غير ممكن في هذا الفصل. أعلى معدل تراكمي يمكنك الوصول إليه: ${best.toFixed(2)}`, bad: true };
    }
    if (need <= 0) return { text: "الهدف محقق بالفعل مهما كانت نتيجة هذا الفصل.", bad: false };
    return { text: `تحتاج معدل فصل لا يقل عن ${need.toFixed(2)} على ${fmtH(r.planned)} ساعة.`, bad: false };
  }

  /* ---------- DOM ---------- */
  function field(label, input) {
    const l = el("label", "field");
    l.append(el("span", "", label), input);
    return l;
  }

  function numberInput(value, { min, max, step, label }) {
    const i = el("input", "in");
    i.type = "number"; i.inputMode = "decimal";
    i.min = min; i.max = max; i.step = step;
    i.value = value; i.setAttribute("aria-label", label);
    return i;
  }

  function row(c) {
    const r = el("div", "crow");
    const name = el("input", "in");
    name.type = "text"; name.placeholder = "اسم المادة"; name.value = c.name; name.autocomplete = "off";
    name.oninput = () => { c.name = name.value; save(); };

    const hrs = numberInput(c.hours, { min: "0", max: "12", step: "0.5", label: "الساعات المعتمدة" });
    hrs.oninput = () => { c.hours = hrs.value; save(); update(); };

    const gr = el("select", "in");
    gr.setAttribute("aria-label", "التقدير");
    gr.append(new Option("—", ""));
    DEFAULT_SCALE.forEach(([k]) => gr.append(new Option(k, k)));
    gr.value = c.grade;
    gr.onchange = () => { c.grade = gr.value; save(); update(); };

    const del = el("button", "x", "×");
    del.type = "button"; del.setAttribute("aria-label", "حذف المادة");
    del.onclick = () => { G.courses = G.courses.filter(o => o !== c); save(); renderRows(); update(); };

    r.append(field("المادة", name), field("الساعات", hrs), field("التقدير", gr), del);
    return r;
  }

  function renderRows() {
    const host = $("gpa-rows");
    host.replaceChildren();
    if (!G.courses.length) {
      host.append(el("div", "none", "لا توجد مواد بعد. أضف مادة أو استوردها من جدولك."));
      return;
    }
    G.courses.forEach(c => host.append(row(c)));
  }

  function update() {
    const r = compute();
    $("r-sem").textContent = r.sem == null ? "—" : r.sem.toFixed(2);
    $("r-cum").textContent = r.cum == null ? "—" : r.cum.toFixed(2);
    $("r-hrs").textContent = fmtH(r.hrs);
    $("formula").textContent = r.hrs > 0
      ? `GPA = Σ(h × p) / Σh = ${fmtN(r.pts)} / ${fmtH(r.hrs)} = ${r.sem.toFixed(2)}`
      : "GPA = Σ(h × p) / Σh";
    const t = targetMessage(r);
    const out = $("target-out");
    out.textContent = t.text;
    out.classList.toggle("bad", t.bad);
  }

  function addCourse(name = "") {
    G.courses.push({ id: uid(), name, hours: 3, grade: "" });
    save(); renderRows(); update();
  }

  function importFromSchedule() {
    const note = $("gpa-note");
    const names = FCI.schedule.currentCourses();
    if (!names) { note.textContent = "اختر الفرقة والمجموعة والسكشن من صفحة الجدول أولًا."; return; }
    const have = new Set(G.courses.map(c => normAr(c.name)));
    let added = 0;
    names.forEach(n => {
      if (!have.has(normAr(n))) { G.courses.push({ id: uid(), name: n, hours: 3, grade: "" }); added++; }
    });
    save(); renderRows(); update();
    note.textContent = added
      ? `تمت إضافة ${added} مادة بساعات افتراضية 3. عدّل الساعات حسب لائحتك.`
      : "كل مواد جدولك موجودة بالفعل.";
  }

  function build() {
    const root = $("view-gpa");
    root.innerHTML = `
      <div class="gpa">
        <section class="panel courses">
          <div class="ph">مواد الفصل</div>
          <div class="pb">
            <div id="gpa-rows"></div>
            <div class="actions">
              <button class="btn solid" type="button" id="add">+ مادة</button>
              <button class="btn" type="button" id="import">استيراد من الجدول</button>
              <button class="btn ghost" type="button" id="clear">مسح الكل</button>
            </div>
            <p class="note" id="gpa-note" aria-live="polite"></p>
            <p class="formula" id="formula"></p>
          </div>
        </section>

        <div class="side">
          <section class="panel">
            <div class="ph">السجل السابق (اختياري)</div>
            <div class="pb">
              <div class="two" id="prev"></div>
              <div class="three" style="margin-top:12px" id="goal"></div>
              <div class="out" id="target-out" role="status"></div>
            </div>
          </section>

          <details class="panel">
            <summary>سلم التقديرات (قابل للتعديل)</summary>
            <div class="pb">
              <div class="scale" id="scale"></div>
              <div class="actions"><button class="btn ghost" type="button" id="reset-scale">استرجاع الافتراضي</button></div>
              <p class="note">السلم الافتراضي هو سلم 4.0 القياسي. راجع لائحة كليتك وعدّل القيم إذا اختلفت.</p>
            </div>
          </details>
        </div>

        <div class="result" aria-live="polite">
          <div><small>معدل الفصل</small><b id="r-sem">—</b></div>
          <div><small>التراكمي</small><b id="r-cum">—</b></div>
          <div><small>ساعات الفصل</small><b id="r-hrs">0</b></div>
        </div>
      </div>`;

    const prevGpa = numberInput(G.prevGpa, { min: "0", max: "4", step: "0.01", label: "المعدل التراكمي السابق" });
    prevGpa.oninput = () => { G.prevGpa = prevGpa.value; save(); update(); };
    const prevHours = numberInput(G.prevHours, { min: "0", max: "300", step: "1", label: "الساعات المنجزة" });
    prevHours.oninput = () => { G.prevHours = prevHours.value; save(); update(); };
    $("prev").append(field("المعدل التراكمي الحالي", prevGpa), field("الساعات المنجزة", prevHours));

    const target = numberInput(G.target, { min: "0", max: "4", step: "0.01", label: "المعدل التراكمي المستهدف" });
    target.oninput = () => { G.target = target.value; save(); update(); };
    $("goal").append(field("المعدل التراكمي المستهدف", target));

    const scaleHost = $("scale");
    DEFAULT_SCALE.forEach(([k]) => {
      const i = numberInput(G.scale[k], { min: "0", max: "10", step: "0.1", label: "نقاط " + k });
      i.oninput = () => {
        const v = num(i.value);
        if (v != null && v >= 0) { G.scale[k] = v; save(); update(); }
      };
      const f = field(k, i);
      scaleHost.append(f);
    });
    $("reset-scale").onclick = () => {
      G.scale = defaultScale(); save();
      scaleHost.querySelectorAll("input").forEach((inp, idx) => { inp.value = DEFAULT_SCALE[idx][1]; });
      update();
    };

    $("add").onclick = () => addCourse();
    $("import").onclick = importFromSchedule;
    $("clear").onclick = () => {
      if (!G.courses.length || confirm("مسح كل المواد؟")) { G.courses = []; save(); renderRows(); update(); $("gpa-note").textContent = ""; }
    };

    renderRows();
    update();
  }

  FCI.gpa = { init: build };
})();
