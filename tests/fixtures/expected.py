from datetime import date

TODAY = date(2026, 10, 1)

EXPECTED = {
    "A": [
        {
            "title_has": "Internal Test 2",
            "type": "test",
            "date": "2026-11-13",
            "start": "10:00",
            "end": "11:30",
            "venue_has": "Room 204",
            "flags": set(),
        },
        {
            "title_has": "record",
            "type": "deadline",
            "date": "2026-11-13",
            "start": "12:00",
            "end": None,
            "venue_has": "department office",
            "flags": set(),
        },
        {
            "title_has": "AI in Healthcare",
            "type": "lecture",
            "date": "2026-11-13",
            "start": "11:00",
            "end": "12:30",
            "venue_has": "Seminar Hall",
            "flags": set(),
        },
    ],
    "B": [
        {
            "title_has": "Workshop",
            "type": "lecture",
            "date": "2026-11-18",
            "start": "14:00",
            "end": "16:00",
            "venue_has": "Lab 3",
            "flags": set(),
        },
        {
            "title_has": "report",
            "type": "deadline",
            "date": "2026-11-19",
            "start": "17:00",
            "end": None,
            "no_venue": True,
            "flags": {"no_venue"},
        },
        {
            "title_has": "closed",
            "type": "holiday",
            "date": "2026-11-14",
            "all_day": True,
            "start": None,
            "end": None,
            "flags": set(),
        },
    ],
    "C": [
        {
            "title_has": "Sports Day",
            "type": "other",
            "date": "2026-11-25",
            "start": None,
            "end": None,
            "venue_has": "college ground",
            "flags": {"unknown_type", "missing_time"},
        },
    ],
    "D": [],
    "E": [
        {
            "title_has": "Quiz",
            "type": "test",
            "date": "2027-04-03",
            "start": "10:00",
            "end": "11:00",
            "venue_has": "Room 12",
            "flags": {"ambiguous_date", "no_year", "assumed_end"},
        },
    ],
}
