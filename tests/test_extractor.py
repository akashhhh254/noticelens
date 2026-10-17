import os
from tests.fixtures.expected import EXPECTED, TODAY
from notice_lens.extractor import extract_events


def test_extractor_fixtures():
    fixture_files = {
        "A": "tests/fixtures/notice_a.txt",
        "B": "tests/fixtures/notice_b.txt",
        "C": "tests/fixtures/notice_c.txt",
        "D": "tests/fixtures/notice_d.txt",
        "E": "tests/fixtures/notice_e.txt",
    }

    for key, path in fixture_files.items():
        with open(path, "r", encoding="utf-8") as f:
            text = f.read()

        events = extract_events(text, TODAY)
        expected_events = EXPECTED[key]

        assert len(events) == len(expected_events), (
            f"Notice {key}: expected {len(expected_events)} events, got {len(events)}"
        )

        for i, (evt, exp) in enumerate(zip(events, expected_events)):
            # Check title
            if "title_has" in exp:
                assert exp["title_has"].lower() in evt["title"].lower(), (
                    f"Notice {key} event {i}: expected title containing '{exp['title_has']}', got '{evt['title']}'"
                )

            # Check type
            assert evt["type"] == exp["type"], (
                f"Notice {key} event {i}: expected type {exp['type']}, got {evt['type']}"
            )

            # Check date
            assert evt["date"] == exp["date"], (
                f"Notice {key} event {i}: expected date {exp['date']}, got {evt['date']}"
            )

            # Check start and end
            assert evt["start"] == exp.get("start"), (
                f"Notice {key} event {i}: expected start {exp.get('start')}, got {evt['start']}"
            )
            assert evt["end"] == exp.get("end"), (
                f"Notice {key} event {i}: expected end {exp.get('end')}, got {evt['end']}"
            )

            # Check all_day
            if "all_day" in exp:
                assert evt["all_day"] == exp["all_day"]

            # Check venue
            if "venue_has" in exp:
                assert exp["venue_has"].lower() in evt["venue"].lower(), (
                    f"Notice {key} event {i}: expected venue containing '{exp['venue_has']}', got '{evt['venue']}'"
                )
            if exp.get("no_venue"):
                assert evt["venue"] == ""

            # Check flags
            assert set(evt["flags"]) == exp["flags"], (
                f"Notice {key} event {i}: expected flags {exp['flags']}, got {set(evt['flags'])}"
            )

            # Check spans
            for field, span in evt["spans"].items():
                s, e = span
                assert 0 <= s < e <= len(text), f"Notice {key} event {i}: invalid span {span} for {field}"
                sub = text[s:e]
                assert len(sub.strip()) > 0, f"Notice {key} event {i}: empty span text for {field}"


def test_custom_notice():
    text = "Viva on 20 Nov at 11 AM in Lab 2."
    events = extract_events(text, TODAY)
    assert len(events) == 1
    evt = events[0]
    assert evt["type"] == "test"
    assert evt["date"] == "2026-11-20"
    assert evt["start"] == "11:00"
    assert evt["end"] == "12:00"  # assumed_end
    assert "assumed_end" in evt["flags"]
    assert "Lab 2" in evt["venue"]
