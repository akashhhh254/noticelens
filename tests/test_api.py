import json
from app import app
from tests.fixtures.expected import TODAY


def test_health():
    client = app.test_client()
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.get_json() == {"status": "ok"}


def test_extract_empty_text():
    client = app.test_client()
    resp = client.post("/api/extract", json={"text": "   "})
    assert resp.status_code == 400
    assert resp.get_json() == {"error": "Please paste a notice first."}


def test_extract_missing_text():
    client = app.test_client()
    resp = client.post("/api/extract", json={})
    assert resp.status_code == 400
    assert resp.get_json() == {"error": "Please paste a notice first."}


def test_extract_too_long_text():
    client = app.test_client()
    resp = client.post("/api/extract", json={"text": "a" * 20001})
    assert resp.status_code == 413
    assert resp.get_json() == {"error": "This notice is too long. Please paste a shorter one."}


def test_extract_invalid_json():
    client = app.test_client()
    resp = client.post("/api/extract", data="not json", content_type="text/plain")
    assert resp.status_code == 400
    assert "error" in resp.get_json()


def test_extract_no_events():
    client = app.test_client()
    with open("tests/fixtures/notice_d.txt", "r", encoding="utf-8") as f:
        text = f.read()
    resp = client.post("/api/extract", json={"text": text})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["events"] == []
    assert data["warnings"] == ["No dates or times were found. Check that the notice includes a date."]


def test_notice_a_extract_and_clashes():
    client = app.test_client()
    with open("tests/fixtures/notice_a.txt", "r", encoding="utf-8") as f:
        text = f.read()

    # Extract
    resp = client.post("/api/extract", json={"text": text, "today": TODAY.isoformat()})
    assert resp.status_code == 200
    data = resp.get_json()
    assert len(data["events"]) == 3

    # Clashes
    clash_resp = client.post("/api/clashes", json={"events": data["events"], "timetable": []})
    assert clash_resp.status_code == 200
    clash_data = clash_resp.get_json()
    assert len(clash_data["clashes"]) == 2
    assert len(clash_data["checks"]) == 3
