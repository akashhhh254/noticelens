from datetime import date
from icalendar import Calendar
from app import app
from notice_lens.extractor import extract_events
from tests.fixtures.expected import TODAY


def test_ics_export_notice_a():
    client = app.test_client()
    with open("tests/fixtures/notice_a.txt", "r", encoding="utf-8") as f:
        text = f.read()

    events = extract_events(text, TODAY)
    assert len(events) == 3

    resp = client.post("/api/export", json={"events": events})
    assert resp.status_code == 200
    assert resp.headers["Content-Type"].startswith("text/calendar")
    assert "attachment; filename=notices.ics" in resp.headers["Content-Disposition"]

    ics_data = resp.data.decode("utf-8")
    assert "\r\n" in ics_data
    assert "BEGIN:VCALENDAR" in ics_data
    assert "VERSION:2.0" in ics_data
    assert "PRODID:-//NoticeLens//EN" in ics_data

    cal = Calendar.from_ical(resp.data)
    subcomponents = [c for c in cal.subcomponents if c.name == "VEVENT"]
    assert len(subcomponents) == 3

    # Map by summary
    dtstarts = {}
    for sc in subcomponents:
        summary = str(sc.get("summary"))
        dtstart = sc.get("dtstart").to_ical().decode("utf-8")
        dtstarts[summary] = dtstart

    # Exact UTC DTSTART values required by P6:
    # test 20261113T043000Z, lecture 20261113T053000Z, deadline 20261113T063000Z
    test_dt = [v for k, v in dtstarts.items() if "Internal Test 2" in k][0]
    assert test_dt == "20261113T043000Z"

    lecture_dt = [v for k, v in dtstarts.items() if "AI in Healthcare" in k][0]
    assert lecture_dt == "20261113T053000Z"

    deadline_dt = [v for k, v in dtstarts.items() if "DEADLINE:" in k][0]
    assert deadline_dt == "20261113T063000Z"


def test_ics_holiday_format():
    client = app.test_client()
    events = [
        {
            "id": "e_hol",
            "title": "Diwali Holiday",
            "type": "holiday",
            "date": "2026-11-14",
            "all_day": True,
            "start": None,
            "end": None,
            "venue": "",
            "spans": {},
            "flags": [],
        }
    ]
    resp = client.post("/api/export", json={"events": events})
    assert resp.status_code == 200

    cal = Calendar.from_ical(resp.data)
    vevents = [c for c in cal.subcomponents if c.name == "VEVENT"]
    assert len(vevents) == 1
    ve = vevents[0]
    dtstart = ve.get("dtstart").to_ical().decode("utf-8")
    dtend = ve.get("dtend").to_ical().decode("utf-8")
    assert dtstart == "20261114"
    assert dtend == "20261115"


def test_ics_missing_time_error():
    client = app.test_client()
    events = [
        {
            "id": "e_notime",
            "title": "Sports Day",
            "type": "other",
            "date": "2026-11-25",
            "all_day": False,
            "start": None,
            "end": None,
            "venue": "college ground",
            "spans": {},
            "flags": ["missing_time"],
        }
    ]
    resp = client.post("/api/export", json={"events": events})
    assert resp.status_code == 400
    data = resp.get_json()
    assert data["error"] == "Some events are missing a time."
    assert "e_notime" in data["event_ids"]
