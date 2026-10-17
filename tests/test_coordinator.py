from app import app


def test_publish_and_fetch():
    client = app.test_client()
    events = [
        {
            "id": "e1",
            "title": "Internal Test 2",
            "type": "test",
            "date": "2026-11-13",
            "start": "10:00",
            "end": "11:30",
            "all_day": False,
            "venue": "Room 204",
            "spans": {},
            "flags": [],
        }
    ]
    payload = {
        "title": "CSE III Year Schedule",
        "text": "Internal Test 2 will be held on 13 Nov 2026...",
        "events": events,
    }

    # 1. Publish
    resp = client.post("/api/publish", json=payload)
    assert resp.status_code == 200
    data = resp.get_json()
    assert "id" in data
    assert len(data["id"]) == 8
    assert data["url"] == f"/n/{data['id']}"

    notice_id = data["id"]

    # 2. Fetch page /n/<id>
    page_resp = client.get(f"/n/{notice_id}")
    assert page_resp.status_code == 200
    assert "CSE III Year Schedule" in page_resp.data.decode("utf-8")

    # 3. Fetch API /api/notice/<id>
    api_resp = client.get(f"/api/notice/{notice_id}")
    assert api_resp.status_code == 200
    api_data = api_resp.get_json()
    assert api_data["title"] == "CSE III Year Schedule"
    assert len(api_data["events"]) == 1


def test_publish_reject_empty_events():
    client = app.test_client()
    resp = client.post("/api/publish", json={"title": "Test", "text": "...", "events": []})
    assert resp.status_code == 400
    assert "Please provide a title and at least one event" in resp.get_json()["error"]


def test_unknown_notice_404():
    client = app.test_client()
    resp = client.get("/n/doesnotexist")
    assert resp.status_code == 404
    assert "Notice Not Found" in resp.data.decode("utf-8")
