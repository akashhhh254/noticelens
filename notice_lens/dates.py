"""Date and time parsing functions for NoticeLens."""
import re
from datetime import date, datetime, timedelta

MONTH_MAP = {
    "jan": 1, "january": 1,
    "feb": 2, "february": 2,
    "mar": 3, "march": 3,
    "apr": 4, "april": 4,
    "may": 5,
    "jun": 6, "june": 6,
    "jul": 7, "july": 7,
    "aug": 8, "august": 8,
    "sep": 9, "sept": 9, "september": 9,
    "oct": 10, "october": 10,
    "nov": 11, "november": 11,
    "dec": 12, "december": 12,
}

MONTH_REGEX_STR = r"(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)"


def parse_dates(text: str, today: date) -> list[dict]:
    """
    Finds all dates in text and returns a list of results:
    [
        {
            "date": "YYYY-MM-DD",
            "text": matched_text,
            "span": (start, end),
            "flags": [...],
            "has_explicit_year": bool
        }
    ]
    """
    if not text:
        return []

    candidates = []

    # Check for date range like 'from 20 Nov to 22 Nov' or '20 Nov to 22 Nov'
    range_regex = re.compile(
        r"\b(?:from\s+)?(?P<d1>\d{1,2}(?:st|nd|rd|th)?)\s+(?P<m1>" + MONTH_REGEX_STR + r")"
        r"(?:\s+(?P<y1>\d{4}))?\s+(?:to|-|–|—)\s+"
        r"(?P<d2>\d{1,2}(?:st|nd|rd|th)?)\s+(?P<m2>" + MONTH_REGEX_STR + r")"
        r"(?:\s+(?P<y2>\d{4}))?\b",
        re.IGNORECASE
    )
    for m in range_regex.finditer(text):
        raw_d1 = re.sub(r"(st|nd|rd|th)", "", m.group("d1"), flags=re.IGNORECASE)
        m1_str = m.group("m1").lower()
        month = MONTH_MAP.get(m1_str)
        day = int(raw_d1)
        year_str = m.group("y1") or m.group("y2")
        year = int(year_str) if year_str else None
        candidates.append({
            "day": day,
            "month": month,
            "year": year,
            "has_explicit_year": bool(year),
            "is_numeric": False,
            "is_range": True,
            "span": (m.start(), m.end()),
            "text": m.group(0),
        })

    # Check for date range like '20 to 22 Nov' or 'from 20 to 22 Nov'
    range_regex2 = re.compile(
        r"\b(?:from\s+)?(?P<d1>\d{1,2}(?:st|nd|rd|th)?)\s+(?:to|-|–|—)\s+"
        r"(?P<d2>\d{1,2}(?:st|nd|rd|th)?)\s+(?P<m2>" + MONTH_REGEX_STR + r")"
        r"(?:\s+(?P<y2>\d{4}))?\b",
        re.IGNORECASE
    )
    for m in range_regex2.finditer(text):
        if any(c["span"][0] <= m.start() and m.end() <= c["span"][1] for c in candidates):
            continue
        raw_d1 = re.sub(r"(st|nd|rd|th)", "", m.group("d1"), flags=re.IGNORECASE)
        m2_str = m.group("m2").lower()
        month = MONTH_MAP.get(m2_str)
        day = int(raw_d1)
        year_str = m.group("y2")
        year = int(year_str) if year_str else None
        candidates.append({
            "day": day,
            "month": month,
            "year": year,
            "has_explicit_year": bool(year),
            "is_numeric": False,
            "is_range": True,
            "span": (m.start(), m.end()),
            "text": m.group(0),
        })

    # Pattern 1: Day Month Year (e.g., '13 Nov', '13 Nov 2026', '13th November 2026')
    p1 = re.compile(
        r"\b(?P<day>\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(?P<month>"
        + MONTH_REGEX_STR
        + r")(?:\s+(?P<year>\d{4}))?\b",
        re.IGNORECASE,
    )
    for m in p1.finditer(text):
        # avoid overlapping range candidate
        if any(c["span"][0] <= m.start() and m.end() <= c["span"][1] for c in candidates):
            continue
        day = int(m.group("day"))
        month = MONTH_MAP[m.group("month").lower()]
        year = int(m.group("year")) if m.group("year") else None
        candidates.append({
            "day": day,
            "month": month,
            "year": year,
            "has_explicit_year": bool(year),
            "is_numeric": False,
            "is_range": False,
            "span": (m.start(), m.end()),
            "text": m.group(0),
        })

    # Pattern 2: Month Day, Year (e.g., 'Nov 13, 2026', 'Nov 13 2026', 'November 13th, 2026')
    p2 = re.compile(
        r"\b(?P<month>"
        + MONTH_REGEX_STR
        + r")\s+(?P<day>\d{1,2})(?:st|nd|rd|th)?(?:[,\s]+(?P<year>\d{4}))?\b",
        re.IGNORECASE,
    )
    for m in p2.finditer(text):
        if any(c["span"][0] <= m.start() and m.end() <= c["span"][1] for c in candidates):
            continue
        day = int(m.group("day"))
        month = MONTH_MAP[m.group("month").lower()]
        year = int(m.group("year")) if m.group("year") else None
        candidates.append({
            "day": day,
            "month": month,
            "year": year,
            "has_explicit_year": bool(year),
            "is_numeric": False,
            "is_range": False,
            "span": (m.start(), m.end()),
            "text": m.group(0),
        })

    # Pattern 3: Numeric dd/mm/yyyy or dd-mm-yyyy or dd.mm.yyyy (with 4-digit year)
    p3 = re.compile(
        r"\b(?P<day>\d{1,2})([/.-])(?P<month>\d{1,2})\2(?P<year>\d{4})\b"
    )
    for m in p3.finditer(text):
        if any(c["span"][0] <= m.start() and m.end() <= c["span"][1] for c in candidates):
            continue
        day = int(m.group("day"))
        month = int(m.group("month"))
        year = int(m.group("year"))
        candidates.append({
            "day": day,
            "month": month,
            "year": year,
            "has_explicit_year": True,
            "is_numeric": True,
            "is_range": False,
            "span": (m.start(), m.end()),
            "text": m.group(0),
        })

    # Pattern 4: Numeric dd/mm or dd-mm (without year)
    # Must not match ratios or versions or times. E.g. '03/04', '18/11'
    p4 = re.compile(
        r"\b(?P<day>\d{1,2})([/-])(?P<month>\d{1,2})\b"
    )
    for m in p4.finditer(text):
        if any(c["span"][0] <= m.start() and m.end() <= c["span"][1] for c in candidates):
            continue
        day = int(m.group("day"))
        month = int(m.group("month"))
        # month must be 1..12, day must be 1..31
        if not (1 <= month <= 12 and 1 <= day <= 31):
            continue
        candidates.append({
            "day": day,
            "month": month,
            "year": None,
            "has_explicit_year": False,
            "is_numeric": True,
            "is_range": False,
            "span": (m.start(), m.end()),
            "text": m.group(0),
        })

    # Sort candidates by span start
    candidates.sort(key=lambda c: c["span"][0])

    # Check for valid explicit year in the notice that gives date >= today
    explicit_future_year = None
    for c in candidates:
        if c["has_explicit_year"] and c["year"]:
            try:
                dt = date(c["year"], c["month"], c["day"])
                if dt >= today:
                    explicit_future_year = c["year"]
                    break
            except ValueError:
                pass

    results = []
    for c in candidates:
        day = c["day"]
        month = c["month"]
        flags = []

        if c["is_range"]:
            flags.append("date_range")

        if c["has_explicit_year"]:
            year = c["year"]
            try:
                dt = date(year, month, day)
            except ValueError:
                # Impossible date (e.g. 31/02/2026) -> ignore
                continue
            if dt < today:
                flags.append("past_date")
        else:
            # Missing year
            if explicit_future_year is not None:
                # Use explicit year from notice without no_year flag
                year = explicit_future_year
                try:
                    dt = date(year, month, day)
                except ValueError:
                    continue
                if dt < today:
                    flags.append("past_date")
                if c["is_numeric"]:
                    flags.append("ambiguous_date")
            else:
                # Next occurrence of that date on or after today
                try:
                    dt_this_year = date(today.year, month, day)
                except ValueError:
                    # Impossible date
                    continue

                if dt_this_year >= today:
                    year = today.year
                    dt = dt_this_year
                else:
                    year = today.year + 1
                    try:
                        dt = date(year, month, day)
                    except ValueError:
                        continue

                flags.append("no_year")
                if c["is_numeric"]:
                    flags.append("ambiguous_date")

        results.append({
            "date": dt.strftime("%Y-%m-%d"),
            "text": c["text"],
            "span": c["span"],
            "flags": sorted(list(set(flags))),
            "has_explicit_year": c["has_explicit_year"],
        })

    return results


def _to_24h(hour: int, minute: int, ampm: str | None, default_mode: str | None = None) -> tuple[int, int, bool]:
    """
    Returns (hour_24, minute, had_ampm).
    If ampm is None, uses default_mode or hour 1-6 PM / 7-11 AM.
    """
    if ampm:
        ampm = ampm.lower().replace(".", "").strip()
        if ampm == "am":
            if hour == 12:
                hour = 0
        elif ampm == "pm":
            if hour != 12:
                hour += 12
        return hour, minute, True

    if default_mode:
        return _to_24h(hour, minute, default_mode)

    # Bare hour without am/pm
    # hours 1 to 6 are assumed PM, 7 to 11 AM, 12 is PM
    if 1 <= hour <= 6:
        h24 = hour + 12
    elif hour == 12:
        h24 = 12
    else:
        h24 = hour
    return h24, minute, False


def parse_times(text: str) -> list[dict]:
    """
    Finds single times or time ranges in text.
    Returns:
    [
        {
            "start": "HH:MM",
            "end": "HH:MM" or None,
            "text": matched_text,
            "span": (start, end),
            "flags": [...]
        }
    ]
    """
    if not text:
        return []

    results = []

    # Helper regex components
    AMPM = r"(?:[Aa]\.?[Mm]\.?|[Pp]\.?[Mm]\.?)"
    TIME_SEP = r"(?:to|-|–|—)"

    # Check for "12:00 noon", "noon", "12 noon", "12:00 midnight", "midnight", "12 midnight"
    noon_midnight_regex = re.compile(
        r"\b(?:(?P<t12>12(?::00)?)\s+)?(?P<word>noon|midnight)\b",
        re.IGNORECASE,
    )

    # Range pattern:
    # Example: '10:00 AM to 11:30 AM', '10 to 11:30 AM', '2 PM - 5 PM', '11:00 AM – 12:30 PM', '9-11 AM', '2 to 4'
    range_regex = re.compile(
        r"\b(?P<h1>\d{1,2})(?::(?P<m1>\d{2}))?\s*(?P<ampm1>" + AMPM + r")?\s*"
        r"(?P<sep>" + TIME_SEP + r")\s*"
        r"(?P<h2>\d{1,2})(?::(?P<m2>\d{2}))?\s*(?P<ampm2>" + AMPM + r")?\b",
        re.IGNORECASE
    )

    # Single time with hrs or AM/PM:
    # e.g. '14:00 hrs', '14:00', '2:30 pm', '2 PM', '2 p.m.'
    single_regex = re.compile(
        r"\b(?P<h>\d{1,2})(?::(?P<m>\d{2}))?\s*(?:(?P<hrs>hrs|hours)|(?P<ampm>" + AMPM + r"))\b",
        re.IGNORECASE
    )

    # 24-hr time without explicit AM/PM or hrs, e.g. '14:00' (colon required, 00-23 hours)
    hhmm_regex = re.compile(
        r"\b(?P<h>[01]?\d|2[0-3]):(?P<m>[0-5]\d)\b"
    )

    matched_spans = []

    # 1. Noon / Midnight
    for m in noon_midnight_regex.finditer(text):
        word = m.group("word").lower()
        t_str = "12:00" if word == "noon" else "00:00"
        results.append({
            "start": t_str,
            "end": None,
            "text": m.group(0),
            "span": (m.start(), m.end()),
            "flags": [],
        })
        matched_spans.append((m.start(), m.end()))

    # 2. Time Ranges
    for m in range_regex.finditer(text):
        if any(s <= m.start() and m.end() <= e for s, e in matched_spans):
            continue

        h1 = int(m.group("h1"))
        m1 = int(m.group("m1") or 0)
        ampm1 = m.group("ampm1")

        h2 = int(m.group("h2"))
        m2 = int(m.group("m2") or 0)
        ampm2 = m.group("ampm2")

        # Validate hours and minutes
        if not (0 <= h1 <= 24 and 0 <= m1 <= 59 and 0 <= h2 <= 24 and 0 <= m2 <= 59):
            continue
        if h1 > 23 or h2 > 23:
            continue

        # A bare range like '2 to 4' or '10 to 11:30 AM'
        flags = []
        if not ampm1 and not ampm2:
            # Both lack am/pm: check if they are 24-hour style (e.g. 14:00 to 16:00)
            if (m.group("m1") is not None and h1 >= 13) or (m.group("m2") is not None and h2 >= 13):
                # 24h format
                t1_h, t1_m = h1, m1
                t2_h, t2_m = h2, m2
            else:
                # Inherit assumption: hours 1 to 6 assumed PM, 7 to 11 AM
                t1_h, t1_m, _ = _to_24h(h1, m1, None)
                t2_h, t2_m, _ = _to_24h(h2, m2, None)
                flags.append("no_ampm")
        else:
            # At least one has am/pm
            effective_ampm1 = ampm1 or ampm2
            effective_ampm2 = ampm2 or ampm1
            t1_h, t1_m, _ = _to_24h(h1, m1, effective_ampm1)
            t2_h, t2_m, _ = _to_24h(h2, m2, effective_ampm2)

        start_time = f"{t1_h:02d}:{t1_m:02d}"
        end_time = f"{t2_h:02d}:{t2_m:02d}"

        results.append({
            "start": start_time,
            "end": end_time,
            "text": m.group(0),
            "span": (m.start(), m.end()),
            "flags": flags,
        })
        matched_spans.append((m.start(), m.end()))

    # 3. Single times with AM/PM or hrs
    for m in single_regex.finditer(text):
        if any(s <= m.start() and m.end() <= e for s, e in matched_spans):
            continue

        h = int(m.group("h"))
        min_ = int(m.group("m") or 0)
        if not (0 <= h <= 24 and 0 <= min_ <= 59):
            continue
        if h > 23:
            continue

        ampm = m.group("ampm")
        hrs = m.group("hrs")

        if hrs:
            t_h, t_m = h, min_
            flags = []
        else:
            t_h, t_m, _ = _to_24h(h, min_, ampm)
            flags = []

        results.append({
            "start": f"{t_h:02d}:{t_m:02d}",
            "end": None,
            "text": m.group(0),
            "span": (m.start(), m.end()),
            "flags": flags,
        })
        matched_spans.append((m.start(), m.end()))

    # 4. HH:MM alone (24-hour style e.g. '14:00', but not if already part of range or date)
    for m in hhmm_regex.finditer(text):
        if any(s <= m.start() and m.end() <= e for s, e in matched_spans):
            continue
        h = int(m.group("h"))
        min_ = int(m.group("m"))
        if h > 23 or min_ > 59:
            continue

        results.append({
            "start": f"{h:02d}:{min_:02d}",
            "end": None,
            "text": m.group(0),
            "span": (m.start(), m.end()),
            "flags": [],
        })
        matched_spans.append((m.start(), m.end()))

    # Sort by span start
    results.sort(key=lambda r: r["span"][0])
    return results


def get_spans(matches: list[dict]) -> list[tuple[int, int]]:
    """Returns the character span of every match."""
    return [m["span"] for m in matches]
