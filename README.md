# NoticeLens 🔍

> **Turn messy college notices into structured events, detect schedule clashes, and export one-click calendar files — 100% rule-based, private, explainable, and zero AI/LLM cost.**

Built for **SETU 2026** (Round 2 Submission).

---

## 📌 1. The Problem

College notices are posted as informal paragraphs, WhatsApp forwards, or text PDFs. Students routinely miss submission deadlines, double-book exam and lab review times, or fail to notice that an event conflicts with their regular weekly timetable or a college holiday. 

Modern "AI solutions" fail here because:
1. They hallucinate dates and times.
2. They incur ongoing API costs and latency.
3. They send private campus announcements to third-party cloud servers.
4. They cannot explain *why* an event was flagged or how a clash was calculated.

**NoticeLens** solves this with a **deterministic, rule-based extraction and clash engine**:
- **Zero LLM calls, zero paid APIs, zero network calls at runtime.**
- Every extracted field links directly to exact character offsets in the original notice.
- When information is missing or ambiguous, explainable flags alert the user before export.

---

## ✨ 2. Features

- **Rule-Based Extraction:** Parses tests, assignment deadlines, guest lectures, workshops, and holidays from unstructured text or text-based PDFs.
- **Explainable Source Highlighting:** Highlights original text with colored spans for Title, Date, Time, and Venue without breaking words.
- **Clash Detection Engine:** Detects overlapping events, deadlines falling inside other events, events scheduled on college holidays, and conflicts with personal weekly timetable classes.
- **Personal Weekly Timetable:** Save recurring class slots in `localStorage` to check notice events against your daily schedule.
- **Interactive SVG Timeline:** Visual day timeline showing timed event intervals, shaded clash overlaps, and deadline marker points.
- **RFC 5545 .ics Calendar Export:** Native, hand-crafted `.ics` calendar generation with Asia/Kolkata (IST) to UTC conversion, 15-minute deadline alarms, and all-day holiday support. Compatible with Google Calendar, Apple Calendar, and Outlook.
- **Coordinator Publishing View:** Coordinators can review, edit, and publish verified notices to a persistent share link (`/n/<id>`) powered by SQLite. Students view read-only verified events and check clashes against their own timetable.
- **Privacy & Safety First:** Notices processed locally in memory. No notices stored unless explicitly published.

---

## ⚙️ 3. How It Works

### Extraction Rules (`docs/SPEC.md`)
- **Date Parsing:** Numbers are interpreted as `dd/mm` (e.g. `13/11/2026` is Nov 13, 2026; `03/04` is April 3). A missing year inherits any future explicit year mentioned in the notice, or defaults to the next upcoming occurrence.
- **Time Parsing:** Supports 12-hour (`2 PM`, `2:30 pm`, `10 to 11:30 AM`), 24-hour (`14:00`, `14:00 hrs`), and words (`noon` = 12:00, `midnight` = 00:00). When AM/PM is omitted (e.g., `2 to 4`), hours 1–6 default to PM and 7–11 default to AM with a `no_ampm` warning flag.
- **Deadlines:** Events with keywords (`submit`, `submission`, `due`, `by`) are single point-in-time events with no end time.
- **Assumed End:** Tests or lectures with a start time but no end time assume a duration of 60 minutes and receive the `assumed_end` flag.
- **Holidays:** Full-day events that clash with all other events on the same date.

### Transparent Flags
| Flag | Explanation |
| --- | --- |
| `missing_time` | Event has a date but no time (required before export for non-holidays). |
| `no_ampm` | AM/PM was not stated and was inferred. |
| `no_year` | Year omitted in text; next occurrence assumed. |
| `ambiguous_date` | Numeric date read as dd/mm without explicit year. |
| `unknown_type` | Event category could not be determined; defaulted to `other`. |
| `no_venue` | No room or location detected. |
| `assumed_end` | Test or lecture lacked end time; 60 minutes assumed. |
| `date_range` | Date range detected; only the first day was scheduled. |
| `past_date` | Event date is in the past relative to today. |

### Clash Logic
- **Timed Events:** Clash if $A_{start} < B_{end}$ and $B_{start} < A_{end}$.
- **Deadlines:** Clash with an event if $Event_{start} \le Deadline < Event_{end}$. (A deadline exactly at an event's end time does not clash).
- **Holidays:** Clash with every event and deadline on the same calendar date.
- **Timetable Slots:** Clash with any event falling on the same weekday during overlapping hours.

---

## 🚀 4. Setup and Quick Start

### Prerequisites
- Python 3.11+
- Git

### One-Click Start

**On Windows:**
```cmd
run.bat
```

**On Linux / macOS:**
```bash
chmod +x run.sh
./run.sh
```

### Manual Setup
```bash
# 1. Create and activate virtual environment
python -m venv .venv

# Windows
.venv\Scripts\activate

# Linux / macOS
source .venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Run application
python app.py
```
Open **http://127.0.0.1:5000** in your web browser.

---

## 🧪 5. Running Tests and Evaluation

### Run Test Suite
```bash
pytest -v
```
All tests verify deterministic parsing, exact assertions, RFC 5545 compliance, API error codes, edge cases, and coordinator persistence.

### Run Smoke Test
```bash
python scripts/smoke.py
```
Checks `/health`, input bounds, empty notices, notice A extraction (3 events, 2 clashes), `.ics` export, and coordinator publish/fetch.

### Run Accuracy Evaluation on Gold Dataset
```bash
python scripts/evaluate.py
```
Evaluates extraction accuracy across gold benchmark notices in `tests/gold/`.

### How to Add Real Notices to the Evaluation Suite
1. Create a raw notice text file: `tests/gold/<notice_name>.txt`.
2. Create the hand-labelled ground truth: `tests/gold/<notice_name>.json` with format:
   ```json
   [
     {
       "title": "Internal Test 2",
       "type": "test",
       "date": "2026-11-13",
       "start": "10:00",
       "end": "11:30",
       "venue": "Room 204",
       "all_day": false
     }
   ]
   ```
3. Run `python scripts/evaluate.py` to view precision, recall, and field-level accuracy metrics.

---

## 📂 6. Project Structure

```
NoticeLens/
├── app.py                      # Flask routes and REST API endpoints
├── run.bat                     # Windows startup runner
├── run.sh                      # Linux/macOS startup runner
├── requirements.txt            # Pinned dependencies
├── README.md                   # Project documentation
├── noticelens.db               # SQLite database for published notices
├── docs/
│   └── SPEC.md                 # Complete project specification and rules
├── notice_lens/
│   ├── __init__.py
│   ├── dates.py                # Pure date & time parsing and span extraction
│   ├── extractor.py            # Rule-based event extractor
│   ├── clash.py                # Clash calculation and timetable engine
│   ├── ics_export.py           # Native RFC 5545 .ics calendar exporter
│   └── db.py                   # SQLite database operations
├── templates/
│   ├── index.html              # Main application template (Student & Coordinator)
│   └── 404.html                # Friendly 404 page for unknown notices
├── static/
│   ├── app.js                  # Vanilla JS application logic & SVG rendering
│   └── style.css               # Responsive design system & micro-animations
├── tests/
│   ├── fixtures/               # Reference text notices and expected.py
│   ├── gold/                   # Ground truth benchmark dataset for evaluation
│   ├── test_dates.py           # 28 date and time parsing unit tests
│   ├── test_extractor.py       # Fixture verification for Notices A-E
│   ├── test_clash.py           # 15 schedule clash matrix unit tests
│   ├── test_api.py             # HTTP status codes & validation tests
│   ├── test_ics.py             # icalendar parsing and UTC verification
│   ├── test_pdf.py             # PDF upload and error handling tests
│   ├── test_coordinator.py     # SQLite publish, fetch, and 404 tests
│   └── test_edge_cases.py      # 10 robustness and stress test cases
└── scripts/
    ├── smoke.py                # End-to-end smoke test runner
    └── evaluate.py             # Accuracy evaluation script
```

---

## ⚠️ 7. Limitations

- **Text PDFs Only:** Scanned image-only PDFs without an embedded text layer are rejected with a friendly message asking the user to paste text (OCR integration planned).
- **No User Login:** Coordinator view uses randomly generated, unguessable 8-character URLs instead of authentication.

---

## 🔮 8. Next Steps & Commercial Viability

1. **Client-Side Tesseract OCR:** Direct extraction from phone screenshots and scanned paper flyers.
2. **ERP & Timetable Sync:** One-click import from university portals (Moodle, Canvas, Google Classroom).
3. **Department Coordinator Subscriptions:** Departmental SaaS license allowing faculty coordinators to publish official semester calendars directly to enrolled students.
#   n o t i c e l e n s  
 