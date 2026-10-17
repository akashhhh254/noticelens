import time
from datetime import date
from notice_lens.extractor import extract_events
from notice_lens.dates import parse_dates, parse_times

TODAY = date(2026, 10, 1)


def test_edge_case_1_case_and_time_formats():
    text = "Exam on 15 NOV 2026 at 2pm. Lecture on 16 nov at 14:00 hrs. Submission on 17 NOVEMBER at NOON."
    events = extract_events(text, TODAY)
    assert len(events) == 3
    assert events[0]["start"] == "14:00"
    assert events[1]["start"] == "14:00"
    assert events[2]["start"] == "12:00"


def test_edge_case_2_multiple_events_in_one_sentence():
    text = "Internal Test 1 will be on 10 Nov 2026 at 10 AM and Quiz will be on 12 Nov 2026 at 2 PM."
    events = extract_events(text, TODAY)
    assert len(events) == 2
    assert events[0]["date"] == "2026-11-10"
    assert events[1]["date"] == "2026-11-12"

    text_semi = "Internal Test 1 on 10 Nov at 10 AM; Internal Test 2 on 12 Nov at 2 PM."
    events_semi = extract_events(text_semi, TODAY)
    assert len(events_semi) == 2


def test_edge_case_3_bullets_tabs_double_spaces():
    text = """
    Important Notice:
    •   Workshop on AI  -  15 Nov 2026\t\tfrom 10 AM to 12 PM in Room 101.
    •   Internal Test   -  18 Nov 2026\t\tat 2 PM in Room 102.
    """
    events = extract_events(text, TODAY)
    assert len(events) == 2
    assert events[0]["date"] == "2026-11-15"
    assert events[1]["date"] == "2026-11-18"


def test_edge_case_4_emoji_and_whatsapp_bold():
    text = "📢 *Urgent Notice*: *Internal Test 2* will be held on 13 Nov 2026 from 10:00 AM to 11:30 AM in *Room 204*."
    events = extract_events(text, TODAY)
    assert len(events) == 1
    assert events[0]["type"] == "test"
    assert events[0]["date"] == "2026-11-13"
    assert events[0]["start"] == "10:00"


def test_edge_case_5_date_range():
    text = "Tech Fest from 20 Nov to 22 Nov 2026 in the Auditorium."
    events = extract_events(text, TODAY)
    assert len(events) == 1
    assert events[0]["date"] == "2026-11-20"
    assert "date_range" in events[0]["flags"]


def test_edge_case_6_time_with_no_date():
    text = "Meeting at 3 PM in the conference hall."
    events = extract_events(text, TODAY)
    assert events == []


def test_edge_case_7_past_date():
    text = "Exam was on 15 Sept 2026 at 10 AM in Room 1."
    events = extract_events(text, TODAY)
    assert len(events) == 1
    assert events[0]["date"] == "2026-09-15"
    assert "past_date" in events[0]["flags"]


def test_edge_case_8_long_text_performance():
    repeated_sentence = "Internal Test 2 will be held on 13 Nov 2026 from 10:00 AM to 11:30 AM in Room 204. "
    long_text = repeated_sentence * 160  # ~16,000 characters
    start_time = time.time()
    events = extract_events(long_text, TODAY)
    duration = time.time() - start_time
    assert duration < 2.0
    assert len(events) > 0


def test_edge_case_9_random_numbers_emoji_only():
    assert extract_events("🚀🎉🔥💯", TODAY) == []
    assert extract_events("1234567890 987654321", TODAY) == []
    assert extract_events("lorem ipsum dolor sit amet", TODAY) == []


def test_edge_case_10_impossible_values_ignored():
    text = "Test on 31/02/2026 at 25:00 in Room 10."
    events = extract_events(text, TODAY)
    # Impossible date (Feb 31) and invalid time (25:00) should be safely ignored
    assert events == []
