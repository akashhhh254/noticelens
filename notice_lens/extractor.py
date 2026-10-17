"""Rule-based, explainable event extractor for NoticeLens."""
import re
import uuid
from datetime import date, datetime, timedelta
from notice_lens.dates import parse_dates, parse_times

TYPE_KEYWORDS = {
    "holiday": [r"\bholidays?\b", r"\bclosed\b", r"\bno classes\b", r"\bno lectures\b", r"\bvacations?\b", r"\boff\b"],
    "deadline": [r"\bsubmits?\b", r"\bsubmission\b", r"\bdeadlines?\b", r"\blast date\b", r"\bdue\b", r"\bby\b"],
    "test": [r"\btests?\b", r"\bexams?\b", r"\bquiz(?:zes)?\b", r"\bviva\b", r"\binternals?\b", r"\bmid-term\b", r"\bmidterm\b", r"\bassessments?\b"],
    "lecture": [r"\blectures?\b", r"\bworkshops?\b", r"\bseminars?\b", r"\bsessions?\b", r"\btalks?\b", r"\bclass(?:es)?\b", r"\bwebinars?\b"],
}


def _split_clauses(text: str) -> list[tuple[str, int, int]]:
    """
    Splits text into sentences/clauses while returning (clause_text, start_idx, end_idx)
    in the original text.
    """
    clauses = []
    # Normalize bullet points and line endings without altering length where possible
    # We find sentence boundaries using regex with offsets
    # Endings: . ! ? \n ; (avoiding splitting on numbers e.g. 13.11.2026 or a.m./p.m.)
    pattern = re.compile(
        r"(?:[\r\n]+|[;]+|(?<!\b[ap])\.(?!\d)|[!?]+)",
        re.IGNORECASE
    )

    last_end = 0
    for match in pattern.finditer(text):
        m_start = match.start()
        seg = text[last_end:m_start]
        if seg.strip():
            # Adjust strip offsets
            leading_ws = len(seg) - len(seg.lstrip())
            trailing_ws = len(seg) - len(seg.rstrip())
            s = last_end + leading_ws
            e = m_start - trailing_ws
            if e > s:
                clauses.append((text[s:e], s, e))
        last_end = match.end()

    if last_end < len(text):
        seg = text[last_end:]
        if seg.strip():
            leading_ws = len(seg) - len(seg.lstrip())
            trailing_ws = len(seg) - len(seg.rstrip())
            s = last_end + leading_ws
            e = len(text) - trailing_ws
            if e > s:
                clauses.append((text[s:e], s, e))

    return clauses


def _find_venue(clause_text: str, clause_start: int, times_in_clause: list[dict], original_text: str) -> tuple[str, list[int] | None]:
    """
    Finds venue in clause:
    - 'in Room 204'
    - 'at the college ground'
    - '@ Seminar Hall'
    - 'to the department office'
    - Trailing place after last time: ', Seminar Hall'
    """
    # 1. Trailing place after last time: e.g. ', Seminar Hall' or ', Lab 3'
    if times_in_clause:
        last_time = times_in_clause[-1]
        _, t_end = last_time["span"]
        rel_end = t_end - clause_start
        if 0 <= rel_end < len(clause_text):
            trailing_text = clause_text[rel_end:].strip()
            # If starts with comma or hyphen
            trailing_match = re.search(r"^[,\-\s]+([A-Z0-9][A-Za-z0-9\s-]{2,40})$", trailing_text)
            if trailing_match:
                v_text = trailing_match.group(1).strip()
                # Find in original text inside clause
                idx = clause_text.find(v_text, rel_end)
                if idx != -1:
                    v_start = clause_start + idx
                    v_end = v_start + len(v_text)
                    return v_text, [v_start, v_end]

    # 2. 'in Room 204', 'in Lab 3'
    m_in = re.search(r"\bin\s+([A-Z0-9][A-Za-z0-9\s-]{1,35}?)(?=[,\.;]|$|\s+(?:on|from|at|by)\b)", clause_text)
    if m_in:
        v_text = m_in.group(1).strip()
        idx = m_in.start(1)
        v_start = clause_start + idx
        v_end = v_start + len(v_text)
        return v_text, [v_start, v_end]

    # 3. 'at the college ground', 'at <place>'
    m_at = re.search(r"\bat\s+(?:the\s+)?([A-Za-z0-9\s-]{2,35}?)(?=[,\.;]|$|\s+(?:on|from|in|by)\b)", clause_text)
    if m_at:
        # Check if matched text was a time like 'at 10 AM'
        candidate = m_at.group(1).strip()
        if not re.search(r"^\d{1,2}(?::\d{2})?\s*(?:am|pm|hrs|noon|midnight)?$", candidate, re.IGNORECASE):
            idx = m_at.start(1)
            v_start = clause_start + idx
            v_end = v_start + len(candidate)
            return candidate, [v_start, v_end]

    # 4. 'to the department office', 'to <place>' (common for submission/deadline)
    m_to = re.search(r"\bto\s+(?:the\s+)?([A-Za-z0-9\s-]{2,40}?)(?=[,\.;]|$|\s+(?:by|on|at|before)\b)", clause_text)
    if m_to:
        candidate = m_to.group(1).strip()
        # avoid 'to 11:30 AM'
        if not re.search(r"^\d{1,2}(?::\d{2})?\s*(?:am|pm)?$", candidate, re.IGNORECASE):
            idx = m_to.start(1)
            v_start = clause_start + idx
            v_end = v_start + len(candidate)
            return candidate, [v_start, v_end]

    # 5. '@ <place>'
    m_at_sign = re.search(r"@\s*([A-Za-z0-9\s-]{2,35}?)(?=[,\.;]|$)", clause_text)
    if m_at_sign:
        candidate = m_at_sign.group(1).strip()
        idx = m_at_sign.start(1)
        v_start = clause_start + idx
        v_end = v_start + len(candidate)
        return candidate, [v_start, v_end]

    # 6. 'venue: <place>'
    m_venue = re.search(r"\bvenue:\s*([A-Za-z0-9\s-]{2,35}?)(?=[,\.;]|$)", clause_text, re.IGNORECASE)
    if m_venue:
        candidate = m_venue.group(1).strip()
        idx = m_venue.start(1)
        v_start = clause_start + idx
        v_end = v_start + len(candidate)
        return candidate, [v_start, v_end]

    return "", None


def _find_title(clause_text: str, clause_start: int, event_type: str, original_text: str) -> tuple[str, list[int]]:
    """
    Extracts title and span for the event.
    e.g. 'Internal Test 2', 'Lab records', 'Workshop on Python Basics', 'AI in Healthcare', 'Sports Day', 'Quiz'.
    """
    # 1. Quoted phrase after lecture on / workshop on or standalone quote
    quote_match = re.search(r'["“]([^"”]+)["”]', clause_text)
    if quote_match:
        # Check if preceded by 'lecture on' / 'workshop on'
        pre_match = re.search(r'(?:(?:guest\s+)?(?:lecture|workshop|seminar|session)\s+on\s+)?["“]([^"”]+)["”]', clause_text, re.IGNORECASE)
        if pre_match and pre_match.start() != pre_match.start(1):
            t_text = pre_match.group(0).strip()
            s = clause_start + pre_match.start()
            return t_text, [s, s + len(t_text)]
        else:
            t_text = quote_match.group(1).strip()
            s = clause_start + quote_match.start(1)
            return t_text, [s, s + len(t_text)]

    # 2. 'Workshop on Python Basics'
    m_on = re.search(r'\b((?:Workshop|Lecture|Seminar|Session|Talk)\s+on\s+[A-Za-z0-9\s-]{2,30}?)(?=[,–\-]|\s+(?:from|on|at|in|by)\b|$)', clause_text, re.IGNORECASE)
    if m_on:
        t_text = m_on.group(1).strip()
        s = clause_start + m_on.start(1)
        return t_text, [s, s + len(t_text)]

    # 3. Known noun phrases:
    # 'Internal Test 2', 'Sports Day', 'Quiz'
    m_np = re.search(r'\b(Internal Test\s*\d*|Sports Day|Quiz|Annual Day|Tech Fest|Hackathon)\b', clause_text, re.IGNORECASE)
    if m_np:
        t_text = m_np.group(1).strip()
        s = clause_start + m_np.start(1)
        return t_text, [s, s + len(t_text)]

    # 4. Submission / Deadline phrase: e.g. 'Lab records', 'project report'
    m_sub = re.search(r'\b((?:[A-Za-z0-9-]+\s+){0,3}(?:records?|reports?|assignments?|submissions?|thesis|forms?))\b', clause_text, re.IGNORECASE)
    if m_sub:
        t_text = m_sub.group(1).strip()
        # Clean leading words like 'Submit your '
        clean_text = re.sub(r'^(?:Please\s+)?(?:Submit\s+(?:your\s+)?)?', '', t_text, flags=re.IGNORECASE).strip()
        idx = clause_text.find(clean_text)
        if idx != -1:
            s = clause_start + idx
            return clean_text, [s, s + len(clean_text)]

    # 5. Holiday title: 'College will remain closed' or 'Diwali'
    if event_type == "holiday":
        m_holiday = re.search(r'\b(College\s+will\s+remain\s+closed|closed|holiday|vacation)\b', clause_text, re.IGNORECASE)
        if m_holiday:
            t_text = m_holiday.group(1).strip()
            s = clause_start + m_holiday.start(1)
            return t_text, [s, s + len(t_text)]

    # 6. Fallback: Take words before 'will be held', 'is scheduled', 'on', 'from', 'at'
    m_pre = re.search(r'^(?:Reminder:\s*|Notice:\s*|All\s+[^:]+:\s*)?([A-Za-z0-9\s-]{2,40}?)(?=\s+(?:will be held|is scheduled|held on|scheduled on|on|at|from|by)\b)', clause_text, re.IGNORECASE)
    if m_pre:
        t_text = m_pre.group(1).strip()
        idx = clause_text.find(t_text)
        if idx != -1 and len(t_text) > 1:
            s = clause_start + idx
            return t_text, [s, s + len(t_text)]

    # 7. Ultimate fallback: First 3-4 words of clause
    words = clause_text.split()[:4]
    fallback_text = " ".join(words)
    s = clause_start
    return fallback_text, [s, s + len(fallback_text)]


def extract_events(text: str, today: date) -> list[dict]:
    """
    Extracts structured events from text following docs/SPEC.md.
    Returns: list of event dicts with id, title, type, date, start, end,
             all_day, venue, spans, flags.
    """
    if not text or not text.strip():
        return []

    # 1. Parse all dates and times across the text
    all_dates = parse_dates(text, today)
    all_times = parse_times(text)

    # 2. Split text into candidate clauses
    raw_clauses = _split_clauses(text)
    clauses = []
    for c_text, s, e in raw_clauses:
        dates_here = [d for d in all_dates if s <= d["span"][0] and d["span"][1] <= e]
        if len(dates_here) > 1:
            # Check for 'and' or '&' between date 0 and date 1
            m_split = re.search(r"\s+(?:and|&)\s+", c_text, re.IGNORECASE)
            if m_split:
                sp_start = s + m_split.start()
                sp_end = s + m_split.end()
                if dates_here[0]["span"][1] <= sp_start and dates_here[1]["span"][0] >= sp_end:
                    clauses.append((text[s:sp_start], s, sp_start))
                    clauses.append((text[sp_end:e], sp_end, e))
                    continue
        clauses.append((c_text, s, e))

    events = []
    last_seen_date = None
    event_counter = 1

    for clause_text, c_start, c_end in clauses:
        # Check dates inside this clause
        dates_in_clause = [d for d in all_dates if c_start <= d["span"][0] and d["span"][1] <= c_end]
        # Check times inside this clause
        times_in_clause = [t for t in all_times if c_start <= t["span"][0] and t["span"][1] <= c_end]

        # Determine type candidate
        event_type = None
        clause_lower = clause_text.lower()

        # Check holiday
        if any(re.search(w, clause_lower) for w in TYPE_KEYWORDS["holiday"]):
            event_type = "holiday"
        # Check deadline
        elif any(re.search(w, clause_lower) for w in TYPE_KEYWORDS["deadline"]):
            event_type = "deadline"
        # Check test
        elif any(re.search(w, clause_lower) for w in TYPE_KEYWORDS["test"]):
            event_type = "test"
        # Check lecture
        elif any(re.search(w, clause_lower) for w in TYPE_KEYWORDS["lecture"]):
            event_type = "lecture"
        else:
            event_type = "other"

        # Check if clause has date, time, or holiday keyword
        if not dates_in_clause and not times_in_clause and event_type != "holiday":
            # Not an event candidate clause
            continue

        # Carry context date if time present but no date
        date_obj = None
        if dates_in_clause:
            date_obj = dates_in_clause[0]
            last_seen_date = date_obj
        elif last_seen_date is not None:
            date_obj = last_seen_date

        if not date_obj:
            # Time with no date and no earlier date
            continue

        flags = set(date_obj["flags"])

        # Determine unknown type flag
        if event_type == "other":
            flags.add("unknown_type")

        # Time handling
        start_time = None
        end_time = None
        all_day = False
        time_span = None

        if event_type == "holiday":
            all_day = True
            start_time = None
            end_time = None
        elif times_in_clause:
            t_obj = times_in_clause[0]
            start_time = t_obj["start"]
            time_span = t_obj["span"]
            for f in t_obj.get("flags", []):
                flags.add(f)

            if event_type == "deadline":
                # Single point in time
                end_time = None
            else:
                end_time = t_obj["end"]
                if not end_time and event_type in ("test", "lecture"):
                    # Assumed 60 min end
                    st_dt = datetime.strptime(start_time, "%H:%M")
                    et_dt = st_dt + timedelta(minutes=60)
                    end_time = et_dt.strftime("%H:%M")
                    flags.add("assumed_end")
        else:
            # No time found
            flags.add("missing_time")

        # Venue handling
        venue_str, venue_span = _find_venue(clause_text, c_start, times_in_clause, text)
        if not venue_str and event_type != "holiday":
            flags.add("no_venue")

        # Title handling
        title_str, title_span = _find_title(clause_text, c_start, event_type, text)

        # Spans mapping
        spans = {
            "title": title_span,
            "date": list(date_obj["span"]),
        }
        if time_span:
            spans["time"] = list(time_span)
        if venue_span:
            spans["venue"] = list(venue_span)

        event_id = f"evt_{event_counter}"
        event_counter += 1

        events.append({
            "id": event_id,
            "title": title_str,
            "type": event_type,
            "date": date_obj["date"],
            "start": start_time,
            "end": end_time,
            "all_day": all_day,
            "venue": venue_str,
            "spans": spans,
            "flags": sorted(list(flags)),
        })

    return events
