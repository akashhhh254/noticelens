import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from datetime import date
from app import app

PASS_COUNT = 0
FAIL_COUNT = 0


def log_test(name: str, passed: bool, msg: str = ""):
    global PASS_COUNT, FAIL_COUNT
    if passed:
        PASS_COUNT += 1
        print(f"[PASS] {name}")
    else:
        FAIL_COUNT += 1
        print(f"[FAIL] {name}: {msg}")


def run_smoke():
    client = app.test_client()

    # 1. /health
    r = client.get("/health")
    log_test(
        "GET /health status ok",
        r.status_code == 200 and r.get_json().get("status") == "ok",
        f"got {r.status_code} {r.get_json()}"
    )

    # 2. Empty or whitespace text -> 400 'Please paste a notice first.'
    r = client.post("/api/extract", json={"text": "   "})
    log_test(
        "Empty text returns 400 with expected message",
        r.status_code == 400 and r.get_json().get("error") == "Please paste a notice first.",
        f"got {r.status_code} {r.get_json()}"
    )

    # 3. Text > 20000 chars -> 413
    r = client.post("/api/extract", json={"text": "X" * 20001})
    log_test(
        "Long text (>20000 chars) returns 413",
        r.status_code == 413 and "too long" in r.get_json().get("error", "").lower(),
        f"got {r.status_code} {r.get_json()}"
    )

    # 4. Missing or invalid JSON -> 400
    r = client.post("/api/extract", data="not a json", content_type="text/plain")
    log_test(
        "Invalid JSON returns 400",
        r.status_code == 400,
        f"got {r.status_code}"
    )

    # 5. No events found -> 200 with events [] and warning
    with open("tests/fixtures/notice_d.txt", "r", encoding="utf-8") as f:
        text_d = f.read()
    r = client.post("/api/extract", json={"text": text_d})
    data = r.get_json() or {}
    log_test(
        "No events found returns 200 with warnings",
        r.status_code == 200 and data.get("events") == [] and len(data.get("warnings", [])) > 0,
        f"got {r.status_code} {data}"
    )

    # 6. Notice A through /api/extract and /api/clashes
    with open("tests/fixtures/notice_a.txt", "r", encoding="utf-8") as f:
        text_a = f.read()
    r = client.post("/api/extract", json={"text": text_a, "today": "2026-10-01"})
    data_a = r.get_json() or {}
    events_a = data_a.get("events", [])
    log_test(
        "Notice A extracts exactly 3 events",
        r.status_code == 200 and len(events_a) == 3,
        f"got {r.status_code} count={len(events_a)}"
    )

    r_clash = client.post("/api/clashes", json={"events": events_a, "timetable": []})
    data_clash = r_clash.get_json() or {}
    clashes = data_clash.get("clashes", [])
    log_test(
        "Notice A detects exactly 2 clashes",
        r_clash.status_code == 200 and len(clashes) == 2,
        f"got {r_clash.status_code} count={len(clashes)}"
    )

    # 7. Export Notice A .ics
    r_export = client.post("/api/export", json={"events": events_a})
    log_test(
        "Export returns valid 200 .ics file",
        r_export.status_code == 200 and "BEGIN:VCALENDAR" in r_export.data.decode("utf-8"),
        f"got {r_export.status_code}"
    )

    # 8. Coordinator publish and fetch
    r_pub = client.post("/api/publish", json={
        "title": "Smoke Notice",
        "text": text_a,
        "events": events_a
    })
    pub_data = r_pub.get_json() or {}
    notice_id = pub_data.get("id")
    pub_ok = r_pub.status_code == 200 and bool(notice_id)
    if pub_ok:
        r_fetch = client.get(f"/n/{notice_id}")
        fetch_ok = r_fetch.status_code == 200 and "Smoke Notice" in r_fetch.data.decode("utf-8")
    else:
        fetch_ok = False

    log_test(
        "Coordinator publish and fetch works",
        pub_ok and fetch_ok,
        f"pub_code={r_pub.status_code}, notice_id={notice_id}"
    )

    print("\n------------------------------")
    print(f"Summary: {PASS_COUNT} PASSED, {FAIL_COUNT} FAILED")
    print("------------------------------")

    if FAIL_COUNT > 0:
        sys.exit(1)


if __name__ == "__main__":
    run_smoke()
