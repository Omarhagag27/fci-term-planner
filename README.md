# Gadwali (جدولي)

A fast, mobile-first timetable viewer and GPA calculator for students of the Faculty of Computers and Information (FCI). *Gadwali* means "my schedule" in Arabic. Pick your year, group and section, and get your own weekly schedule instead of hunting for it inside a giant spreadsheet.

> **جدولي:** اختر الفرقة والمجموعة والسكشن لتحصل على جدولك الأسبوعي فقط، مع حاسبة معدل فصلي وتراكمي. موقع ثابت بدون خادم ولا تسجيل دخول، يعمل على الموبايل والكمبيوتر.

It is a static site: plain HTML, CSS and JavaScript with no framework and no build step. The data comes from the faculty's Excel timetable, converted once per term into a JSON file by a small Python script.

## Why this exists

The faculty timetable is published as a spreadsheet: one sheet per year, merged cells for multi-hour classes and multi-section lectures, and a different layout depending on the year. It is readable on a big monitor and painful on a phone. This project turns that workbook into structured data, then shows each student only the classes that apply to them.

## Features

**Schedule**
- Year → group/department → section picker. Your choice is remembered, and also encoded in the URL, so you can send a friend a direct link such as `#schedule/1/y1g1/3`.
- Phone layout: one day at a time with day tabs (swipe left/right to change day), a thumb-reach bottom navigation bar and 44px touch targets.
- Desktop layout: all six days side by side, no horizontal scrolling.
- Today is highlighted. The class in progress is tagged **الآن** and the next one **التالي**.
- Overlapping classes in your section are flagged **تعارض**, which usually points to a data entry error worth reporting.

**GPA calculator**
- Semester GPA, weighted by credit hours.
- Cumulative GPA, if you enter your previous GPA and completed hours.
- Target planner: enter the cumulative GPA you want and see the semester GPA you need, or a clear message if it is out of reach this term.
- One-tap import of your section's courses from the schedule (tutorials are merged with their lecture, spelling variants are de-duplicated).
- Courses with no grade selected are ignored, so you can run "what if" scenarios before results are out.
- The grade scale is editable. Everything is saved in your browser only.

**Interface**
- Terminal-style dark theme with three accent colours (green, amber, cyan).
- Arabic and RTL first, with a monospace Latin font for numbers and times.
- Respects `prefers-reduced-motion` and safe areas on notched phones.

## How it works

```
schedule.xlsx ──► parser.py ──► schedule.json ──► index.html + js/ + css/
 (faculty file)   (openpyxl)     (static data)       (runs in the browser)
```

1. `parser.py` reads every sheet of `schedule.xlsx`, detects the layout, resolves merged cells into start and end hours, and writes `schedule.json`. It does not hard-code any course names; every cell is read as-is.
2. The browser fetches `schedule.json`, filters events by your group and section, and renders them.
3. Nothing is sent anywhere. There is no backend, no analytics and no account.

### Data format

`schedule.json` contains two keys. `years` describes the year → group → sections tree, and `events` is a flat list:

```json
{
  "group": "y1g1",
  "day": 1,
  "start": 8,
  "end": 10,
  "sections": [1, 2, 3, 4, 5, 6, 7, 8],
  "course": "فيزياء 1",
  "instructor": "أ.د/غادة عبادى",
  "location": "مدرج 4"
}
```

`day` runs from `0` (Saturday) to `5` (Thursday). `start` and `end` are whole hours in 24-hour time, between 8 and 20.

## Project structure

```
gadwali/
├── index.html        Page shell
├── css/
│   └── style.css     Terminal theme, mobile and desktop layouts
├── js/
│   ├── utils.js      Shared helpers (DOM, storage, Arabic name normalising)
│   ├── schedule.js   Loads schedule.json, picker, day views
│   ├── gpa.js        GPA calculator
│   └── app.js        Routing, bottom nav, accent colour
├── parser.py         Excel → JSON converter
├── schedule.xlsx     Source timetable
├── schedule.json     Generated data (commit this)
├── requirements.txt  Python dependencies
└── LICENSE           MIT
```

Scripts are plain `<script>` tags that share one `window.FCI` namespace, so the page works from any static host without a bundler.

## Run it locally

The page loads `schedule.json` with `fetch`, which browsers block on `file://`. Serve the folder instead:

```bash
python -m http.server 8000
# open http://localhost:8000
```

If you open `index.html` directly, the page tells you this instead of failing silently.

## Update the schedule for a new term

```bash
pip install -r requirements.txt
# replace schedule.xlsx with the new workbook, then:
python parser.py schedule.xlsx schedule.json
```

The script prints how many events it extracted and the names of any sheets it skipped because it could not recognise their layout. Commit the new `schedule.json`. Also update the term label in `index.html` (the `.sub` line).

The parser understands three sheet layouts: sheets with `رقم المجموعة` blocks, sheets with department headers, and sheets with several tracks per level under a `المستوى` row. Days are read from the first column (Saturday to Thursday) with one row per hour from 08:00 to 20:00.

## GPA details

```
GPA        = Σ(hours × points) / Σ hours
Cumulative = (prevGPA × prevHours + Σ(hours × points)) / (prevHours + Σ hours)
Needed GPA = (target × (prevHours + termHours) − prevGPA × prevHours) / termHours
```

The default scale is a standard 4.0 letter scale:

| Grade | A+ | A | A- | B+ | B | B- | C+ | C | C- | D+ | D | F |
|-------|----|---|----|----|---|----|----|---|----|----|---|---|
| Points| 4.0 | 4.0 | 3.7 | 3.3 | 3.0 | 2.7 | 2.3 | 2.0 | 1.7 | 1.3 | 1.0 | 0 |

Faculties differ on both the letters and the points. **Check your faculty's bylaws** and edit the scale under "سلم التقديرات" if needed. Results are shown to two decimals. This tool is a planning aid, not an official transcript.

## Deploy on GitHub Pages

1. Push the repo to GitHub.
2. Go to **Settings → Pages**, choose **Deploy from a branch**, pick `main` and `/ (root)`.
3. Your site will be served at `https://<username>.github.io/gadwali/`.

Any other static host (Netlify, Cloudflare Pages, a plain web server) works the same way.

## Known limitations

- **Data quality follows the source sheet.** Typos, stray characters and a few cells without an instructor or room come straight from the Excel file. The UI hides obvious junk (stray quotes, Latin gibberish, an instructor field containing only `م/`), but cannot fix wrong data. Always confirm important changes with the faculty.
- Classes are stored in whole-hour slots; the source sheet works the same way.
- The timetable has no credit-hour information, so imported courses default to 3 hours. Edit them to match your bylaws.
- No offline mode yet. The page needs a connection on first load (and for the web fonts, which fall back to system fonts if blocked).
- Friday has no classes in the source, so it is not shown.
- This is a student project, not an official faculty product.

## Contributing

Found a wrong class or a layout the parser does not understand? Open an issue with the sheet name and the affected cell. Pull requests are welcome, especially for new sheet layouts in `parser.py`.

## License

[MIT](LICENSE) © 2026 Omar Hagag
