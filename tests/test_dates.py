from datetime import date
from notice_lens.dates import parse_dates, parse_times, get_spans

TODAY = date(2026, 10, 1)


def test_date_13_nov():
    res = parse_dates("13 Nov", TODAY)
    assert len(res) == 1
    assert res[0]["date"] == "2026-11-13"
    assert res[0]["flags"] == ["no_year"]
    assert res[0]["text"] == "13 Nov"


def test_date_13_nov_2026():
    res = parse_dates("13 Nov 2026", TODAY)
    assert len(res) == 1
    assert res[0]["date"] == "2026-11-13"
    assert res[0]["flags"] == []
    assert res[0]["text"] == "13 Nov 2026"


def test_date_13_11_2026():
    res = parse_dates("13/11/2026", TODAY)
    assert len(res) == 1
    assert res[0]["date"] == "2026-11-13"
    assert res[0]["flags"] == []
    assert res[0]["text"] == "13/11/2026"


def test_date_03_04():
    res = parse_dates("03/04", TODAY)
    assert len(res) == 1
    assert res[0]["date"] == "2027-04-03"
    assert set(res[0]["flags"]) == {"ambiguous_date", "no_year"}
    assert res[0]["text"] == "03/04"


def test_date_5_jan():
    res = parse_dates("5 Jan", TODAY)
    assert len(res) == 1
    assert res[0]["date"] == "2027-01-05"
    assert res[0]["flags"] == ["no_year"]
    assert res[0]["text"] == "5 Jan"


def test_date_ordinal_and_long_month():
    res = parse_dates("13th November 2026", TODAY)
    assert len(res) == 1
    assert res[0]["date"] == "2026-11-13"
    assert res[0]["flags"] == []


def test_date_month_first():
    res = parse_dates("Nov 13, 2026", TODAY)
    assert len(res) == 1
    assert res[0]["date"] == "2026-11-13"
    assert res[0]["flags"] == []


def test_date_hyphen_and_dot_numeric():
    res_hyphen = parse_dates("13-11-2026", TODAY)
    assert len(res_hyphen) == 1
    assert res_hyphen[0]["date"] == "2026-11-13"

    res_dot = parse_dates("13.11.2026", TODAY)
    assert len(res_dot) == 1
    assert res_dot[0]["date"] == "2026-11-13"


def test_date_sept_short_name():
    res = parse_dates("15 Sept 2026", TODAY)
    assert len(res) == 1
    assert res[0]["date"] == "2026-09-15"
    assert "past_date" in res[0]["flags"]


def test_date_inherits_explicit_year_in_same_notice():
    text = "Exam on 13 Nov 2026. Viva on 18 Nov."
    res = parse_dates(text, TODAY)
    assert len(res) == 2
    assert res[0]["date"] == "2026-11-13"
    assert res[0]["flags"] == []
    assert res[1]["date"] == "2026-11-18"
    # Because another date had explicit year giving date >= today, no_year flag is omitted
    assert res[1]["flags"] == []


def test_date_spans_slice_back_correctly():
    with open("tests/fixtures/notice_a.txt", "r", encoding="utf-8") as f:
        text = f.read()
    res = parse_dates(text, TODAY)
    assert len(res) >= 2
    for item in res:
        s, e = item["span"]
        assert text[s:e] == item["text"]


def test_time_2_pm():
    res = parse_times("2 PM")
    assert len(res) == 1
    assert res[0]["start"] == "14:00"
    assert res[0]["end"] is None


def test_time_2_30_pm():
    res = parse_times("2:30 pm")
    assert len(res) == 1
    assert res[0]["start"] == "14:30"
    assert res[0]["end"] is None


def test_time_14_00():
    res = parse_times("14:00")
    assert len(res) == 1
    assert res[0]["start"] == "14:00"
    assert res[0]["end"] is None


def test_time_14_00_hrs():
    res = parse_times("14:00 hrs")
    assert len(res) == 1
    assert res[0]["start"] == "14:00"
    assert res[0]["end"] is None


def test_time_12_00_noon():
    res = parse_times("12:00 noon")
    assert len(res) == 1
    assert res[0]["start"] == "12:00"
    assert res[0]["end"] is None


def test_time_noon_alone():
    res = parse_times("noon")
    assert len(res) == 1
    assert res[0]["start"] == "12:00"
    assert res[0]["end"] is None


def test_time_12_am():
    res = parse_times("12 AM")
    assert len(res) == 1
    assert res[0]["start"] == "00:00"
    assert res[0]["end"] is None


def test_time_midnight():
    res = parse_times("midnight")
    assert len(res) == 1
    assert res[0]["start"] == "00:00"
    assert res[0]["end"] is None


def test_time_range_10_to_11_30_am():
    res = parse_times("10 to 11:30 AM")
    assert len(res) == 1
    assert res[0]["start"] == "10:00"
    assert res[0]["end"] == "11:30"
    assert res[0]["flags"] == []


def test_time_range_10_00_am_to_11_30_am():
    res = parse_times("10:00 AM to 11:30 AM")
    assert len(res) == 1
    assert res[0]["start"] == "10:00"
    assert res[0]["end"] == "11:30"
    assert res[0]["flags"] == []


def test_time_range_2_pm_to_5_pm():
    res = parse_times("2 PM - 5 PM")
    assert len(res) == 1
    assert res[0]["start"] == "14:00"
    assert res[0]["end"] == "17:00"
    assert res[0]["flags"] == []


def test_time_range_en_dash():
    res = parse_times("11:00 AM – 12:30 PM")
    assert len(res) == 1
    assert res[0]["start"] == "11:00"
    assert res[0]["end"] == "12:30"
    assert res[0]["flags"] == []


def test_time_range_9_11_am():
    res = parse_times("9-11 AM")
    assert len(res) == 1
    assert res[0]["start"] == "09:00"
    assert res[0]["end"] == "11:00"
    assert res[0]["flags"] == []


def test_time_range_2_to_4_no_ampm():
    res = parse_times("2 to 4")
    assert len(res) == 1
    assert res[0]["start"] == "14:00"
    assert res[0]["end"] == "16:00"
    assert res[0]["flags"] == ["no_ampm"]


def test_bare_number_9_is_not_time():
    res = parse_times("the number 9 alone")
    assert res == []


def test_room_number_not_time():
    res = parse_times("Room 204")
    assert res == []


def test_get_spans_utility():
    text = "Starts at 2 PM in Room 204"
    times = parse_times(text)
    spans = get_spans(times)
    assert len(spans) == 1
    s, e = spans[0]
    assert text[s:e] == "2 PM"
