from notice_lens.clash import find_clashes
from notice_lens.extractor import extract_events
from tests.fixtures.expected import TODAY


def test_case_1_overlap_30_min():
    events = [
        {"id": "e1", "type": "lecture", "date": "2026-11-13", "start": "10:00", "end": "11:30", "all_day": False},
        {"id": "e2", "type": "lecture", "date": "2026-11-13", "start": "11:00", "end": "12:30", "all_day": False},
    ]
    res = find_clashes(events)
    assert len(res["clashes"]) == 1
    c = res["clashes"][0]
    assert c["kind"] == "overlap"
    assert c["minutes"] == 30


def test_case_2_touching_no_clash():
    events = [
        {"id": "e1", "type": "lecture", "date": "2026-11-13", "start": "10:00", "end": "11:00", "all_day": False},
        {"id": "e2", "type": "lecture", "date": "2026-11-13", "start": "11:00", "end": "12:00", "all_day": False},
    ]
    res = find_clashes(events)
    assert len(res["clashes"]) == 0


def test_case_3_contained_overlap_30_min():
    events = [
        {"id": "e1", "type": "lecture", "date": "2026-11-13", "start": "10:00", "end": "12:00", "all_day": False},
        {"id": "e2", "type": "lecture", "date": "2026-11-13", "start": "10:30", "end": "11:00", "all_day": False},
    ]
    res = find_clashes(events)
    assert len(res["clashes"]) == 1
    c = res["clashes"][0]
    assert c["kind"] == "overlap"
    assert c["minutes"] == 30


def test_case_4_identical_times():
    events = [
        {"id": "e1", "type": "lecture", "date": "2026-11-13", "start": "10:00", "end": "11:00", "all_day": False},
        {"id": "e2", "type": "lecture", "date": "2026-11-13", "start": "10:00", "end": "11:00", "all_day": False},
    ]
    res = find_clashes(events)
    assert len(res["clashes"]) == 1
    assert res["clashes"][0]["kind"] == "overlap"


def test_case_5_deadline_inside_event():
    events = [
        {"id": "e1", "type": "deadline", "date": "2026-11-13", "start": "12:00", "end": None, "all_day": False},
        {"id": "e2", "type": "lecture", "date": "2026-11-13", "start": "11:00", "end": "12:30", "all_day": False},
    ]
    res = find_clashes(events)
    assert len(res["clashes"]) == 1
    c = res["clashes"][0]
    assert c["kind"] == "deadline_inside"


def test_case_6_deadline_at_end_no_clash():
    events = [
        {"id": "e1", "type": "deadline", "date": "2026-11-13", "start": "11:30", "end": None, "all_day": False},
        {"id": "e2", "type": "test", "date": "2026-11-13", "start": "10:00", "end": "11:30", "all_day": False},
    ]
    res = find_clashes(events)
    assert len(res["clashes"]) == 0


def test_case_7_deadline_at_start_clashes():
    events = [
        {"id": "e1", "type": "deadline", "date": "2026-11-13", "start": "11:00", "end": None, "all_day": False},
        {"id": "e2", "type": "lecture", "date": "2026-11-13", "start": "11:00", "end": "12:00", "all_day": False},
    ]
    res = find_clashes(events)
    assert len(res["clashes"]) == 1
    assert res["clashes"][0]["kind"] == "deadline_inside"


def test_case_8_two_deadlines_never_clash():
    events = [
        {"id": "e1", "type": "deadline", "date": "2026-11-13", "start": "12:00", "end": None, "all_day": False},
        {"id": "e2", "type": "deadline", "date": "2026-11-13", "start": "12:00", "end": None, "all_day": False},
    ]
    res = find_clashes(events)
    assert len(res["clashes"]) == 0


def test_case_9_same_times_different_dates():
    events = [
        {"id": "e1", "type": "lecture", "date": "2026-11-13", "start": "10:00", "end": "11:00", "all_day": False},
        {"id": "e2", "type": "lecture", "date": "2026-11-14", "start": "10:00", "end": "11:00", "all_day": False},
    ]
    res = find_clashes(events)
    assert len(res["clashes"]) == 0


def test_case_10_holiday_vs_any_event_same_date():
    events = [
        {"id": "e1", "type": "holiday", "date": "2026-11-14", "start": None, "end": None, "all_day": True},
        {"id": "e2", "type": "lecture", "date": "2026-11-14", "start": "10:00", "end": "11:00", "all_day": False},
    ]
    res = find_clashes(events)
    assert len(res["clashes"]) == 1
    assert res["clashes"][0]["kind"] == "holiday"


def test_case_11_holiday_vs_deadline_same_date():
    events = [
        {"id": "e1", "type": "holiday", "date": "2026-11-14", "start": None, "end": None, "all_day": True},
        {"id": "e2", "type": "deadline", "date": "2026-11-14", "start": "17:00", "end": None, "all_day": False},
    ]
    res = find_clashes(events)
    assert len(res["clashes"]) == 1
    assert res["clashes"][0]["kind"] == "holiday"


def test_case_12_timetable_slot_fri_clash():
    # 2026-11-13 is a Friday
    events = [
        {"id": "e1", "type": "test", "date": "2026-11-13", "start": "10:00", "end": "11:30", "all_day": False},
    ]
    timetable = [
        {"day": "Fri", "start": "10:30", "end": "11:30", "subject": "DBMS"},
    ]
    res = find_clashes(events, timetable)
    assert len(res["clashes"]) == 1
    c = res["clashes"][0]
    assert c["kind"] == "timetable"
    assert c["minutes"] == 60


def test_case_13_timetable_mon_slot_vs_friday_event():
    events = [
        {"id": "e1", "type": "test", "date": "2026-11-13", "start": "10:00", "end": "11:30", "all_day": False},
    ]
    timetable = [
        {"day": "Mon", "start": "10:00", "end": "11:00", "subject": "OS"},
    ]
    res = find_clashes(events, timetable)
    assert len(res["clashes"]) == 0


def test_case_14_event_with_no_start_time_skipped():
    events = [
        {"id": "e1", "type": "other", "date": "2026-11-25", "start": None, "end": None, "all_day": False},
        {"id": "e2", "type": "test", "date": "2026-11-25", "start": "10:00", "end": "11:00", "all_day": False},
    ]
    res = find_clashes(events)
    assert "e1" in res["skipped"]
    assert len(res["clashes"]) == 0


def test_notice_a_clashes():
    with open("tests/fixtures/notice_a.txt", "r", encoding="utf-8") as f:
        text = f.read()
    events = extract_events(text, TODAY)
    assert len(events) == 3
    # event 0: test 10:00 - 11:30
    # event 1: deadline 12:00
    # event 2: lecture 11:00 - 12:30
    res = find_clashes(events)

    # 3 checks
    assert len(res["checks"]) == 3
    assert len(res["clashes"]) == 2

    # test vs lecture -> overlap, 30 min
    overlap_clash = [c for c in res["clashes"] if c["kind"] == "overlap"]
    assert len(overlap_clash) == 1
    assert overlap_clash[0]["minutes"] == 30

    # deadline vs lecture -> deadline_inside
    deadline_clash = [c for c in res["clashes"] if c["kind"] == "deadline_inside"]
    assert len(deadline_clash) == 1

    # test vs deadline -> no clash
    no_clash_checks = [c for c in res["checks"] if not c["clash"]]
    assert len(no_clash_checks) == 1
