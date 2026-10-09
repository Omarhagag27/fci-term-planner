
import json
import openpyxl

# =========================
# Settings
# =========================

FILE_NAME = "schedule.xlsx"
SHEET_NAME = "الفرقة الثالثة"
OUTPUT_FILE = "schedule.json"

CS_FIRST_COLUMN = 3
CS_LAST_COLUMN = 13


# =========================
# Timetable information
# =========================

days = {
    6: "السبت",
    18: "الاحد",
    30: "الاثنين",
    42: "الثلاثاء",
    54: "الاربعاء",
    66: "الخميس"
}

day_order = {
    "السبت": 0,
    "الاحد": 1,
    "الاثنين": 2,
    "الثلاثاء": 3,
    "الاربعاء": 4,
    "الخميس": 5
}


# =========================
# Helper: format time
# =========================

def format_hour(hour):
    suffix = "AM" if hour < 12 else "PM"
    hour_12 = hour % 12 or 12
    return f"{hour_12} {suffix}"


# =========================
# Helper: parse event text
# =========================

def parse_text(text):
    lines = [
        line.strip()
        for line in str(text).split("\n")
        if line.strip()
    ]

    course = lines[0] if lines else ""
    instructor = lines[1] if len(lines) > 1 else ""
    location = lines[2] if len(lines) > 2 else ""

    # Some cells contain the location on the same line as the course.
    if " - " in course:
        parts = course.rsplit(" - ", 1)

        possible_course = parts[0].strip()
        possible_location = parts[1].strip()

        if (
            "مدرج" in possible_location
            or "معمل" in possible_location
        ):
            course = possible_course
            location = possible_location

    return course, instructor, location


# =========================
# Load workbook
# =========================

workbook = openpyxl.load_workbook(FILE_NAME)
sheet = workbook[SHEET_NAME]


# =========================
# Extract events
# =========================

events = []

for merged_range in sheet.merged_cells.ranges:

    min_col = merged_range.min_col
    max_col = merged_range.max_col
    min_row = merged_range.min_row
    max_row = merged_range.max_row

    # Only include timetable rows.
    if min_row < 6 or max_row > 77:
        continue

    # Only include Computer Science columns (C:M).
    if max_col < CS_FIRST_COLUMN or min_col > CS_LAST_COLUMN:
        continue

    value = sheet.cell(min_row, min_col).value

    if value is None:
        continue

    # Find the day.
    day_start = ((min_row - 6) // 12) * 12 + 6
    day = days[day_start]

    # Calculate the start and end hours.
    start_hour = 8 + (min_row - day_start)
    end_hour = 8 + (max_row - day_start + 1)

    # Find the sections covered by this cell.
    first_section = max(
        min_col, CS_FIRST_COLUMN
    ) - CS_FIRST_COLUMN + 1

    last_section = min(
        max_col, CS_LAST_COLUMN
    ) - CS_FIRST_COLUMN + 1

    sections = list(range(first_section, last_section + 1))

    # Parse the event details.
    course, instructor, location = parse_text(value)

    event = {
        "day": day,
        "start": format_hour(start_hour),
        "end": format_hour(end_hour),
        "start_hour": start_hour,
        "sections": sections,
        "course": course,
        "instructor": instructor,
        "location": location
    }

    events.append(event)


# =========================
# Sort events
# =========================

events.sort(
    key=lambda event: (
        day_order[event["day"]],
        event["start_hour"]
    )
)


# =========================
# Save as JSON
# =========================

with open(OUTPUT_FILE, "w", encoding="utf-8") as file:
    json.dump(
        events,
        file,
        ensure_ascii=False,
        indent=4
    )

print(f"Successfully extracted {len(events)} events.")
print(f"Saved timetable to {OUTPUT_FILE}.")