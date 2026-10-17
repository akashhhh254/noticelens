"""ICS calendar exporter for NoticeLens (RFC 5545)."""
import re
import uuid
from datetime import datetime, date, timedelta, timezone


def _escape_ics_text(text: str) -> str:
    """Escapes commas, semicolons, and newlines for ICS properties."""
    if not text:
        return ""
    text = text.replace("\\", "\\\\")
    text = text.replace(";", r"\;")
    text = text.replace(",", r"\,")
    text = text.replace("\r\n", r"\n").replace("\r", r"\n").replace("\n", r"\n")
    return text


def _fold_line(line: str, max_length: int = 75) -> str:
    """Folds lines longer than 75 octets by inserting CRLF followed by a space."""
    if len(line.encode("utf-8")) <= max_length:
        return line

    parts = []
    current = ""
    for char in line:
        candidate = current + char
        if len(candidate.encode("utf-8")) > max_length:
            parts.append(current)
            current = " " + char
        else:
            current = candidate
    if current:
        parts.append(current)
    return "\r\n".join(parts)


def _to_utc_iso(date_str: str, time_str: str) -> str:
    """
    Converts Asia/Kolkata date (YYYY-MM-DD) and time (HH:MM) to UTC string YYYYMMDDTHHMMSSZ.
    Asia/Kolkata is UTC+5:30.
    """
    dt_local = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
    dt_utc = dt_local - timedelta(hours=5, minutes=30)
    return dt_utc.strftime("%Y%m%dT%H%M%SZ")


def generate_ics(events: list[dict]) -> tuple[str | None, dict | None]:
    """
    Generates ICS calendar string from events.
    Returns (ics_content, None) on success, or (None, error_dict) if validation fails.
    """
    missing_time_ids = []
    for evt in events:
        if not evt.get("all_day") and evt.get("type") != "holiday" and not evt.get("start"):
            missing_time_ids.append(evt.get("id"))

    if missing_time_ids:
        return None, {
            "error": "Some events are missing a time.",
            "event_ids": missing_time_ids,
        }

    now_utc = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//NoticeLens//EN",
        "CALSCALE:GREGORIAN",
    ]

    for evt in events:
        evt_type = evt.get("type", "other")
        all_day = evt.get("all_day", False) or evt_type == "holiday"
        title = evt.get("title", "Event")
        venue = evt.get("venue", "")
        uid_val = f"{uuid.uuid4()}@noticelens"

        lines.append("BEGIN:VEVENT")
        lines.append(f"UID:{uid_val}")
        lines.append(f"DTSTAMP:{now_utc}")
        lines.append("DESCRIPTION:Created by NoticeLens")

        if venue:
            lines.append(f"LOCATION:{_escape_ics_text(venue)}")

        date_str = evt["date"]

        if all_day:
            # Holiday all-day event
            d_obj = datetime.strptime(date_str, "%Y-%m-%d").date()
            next_d_obj = d_obj + timedelta(days=1)
            dt_start_str = d_obj.strftime("%Y%m%d")
            dt_end_str = next_d_obj.strftime("%Y%m%d")

            lines.append(f"SUMMARY:{_escape_ics_text(title)}")
            lines.append(f"DTSTART;VALUE=DATE:{dt_start_str}")
            lines.append(f"DTEND;VALUE=DATE:{dt_end_str}")
        elif evt_type == "deadline":
            # Deadline: start at deadline, end 15 min later, VALARM 15m before
            start_time = evt["start"]
            dt_start_utc = _to_utc_iso(date_str, start_time)

            # End 15 min later
            dt_local = datetime.strptime(f"{date_str} {start_time}", "%Y-%m-%d %H:%M")
            dt_end_local = dt_local + timedelta(minutes=15)
            dt_end_utc = (dt_end_local - timedelta(hours=5, minutes=30)).strftime("%Y%m%dT%H%M%SZ")

            lines.append(f"SUMMARY:DEADLINE: {_escape_ics_text(title)}")
            lines.append(f"DTSTART:{dt_start_utc}")
            lines.append(f"DTEND:{dt_end_utc}")

            lines.append("BEGIN:VALARM")
            lines.append("ACTION:DISPLAY")
            lines.append("DESCRIPTION:Reminder")
            lines.append("TRIGGER:-PT15M")
            lines.append("END:VALARM")
        else:
            # Timed event
            start_time = evt["start"]
            end_time = evt.get("end")
            if not end_time:
                # 60 min assumed
                st_obj = datetime.strptime(start_time, "%H:%M")
                end_time = (st_obj + timedelta(minutes=60)).strftime("%H:%M")

            dt_start_utc = _to_utc_iso(date_str, start_time)
            dt_end_utc = _to_utc_iso(date_str, end_time)

            lines.append(f"SUMMARY:{_escape_ics_text(title)}")
            lines.append(f"DTSTART:{dt_start_utc}")
            lines.append(f"DTEND:{dt_end_utc}")

        lines.append("END:VEVENT")

    lines.append("END:VCALENDAR")

    folded_lines = [_fold_line(line) for line in lines]
    return "\r\n".join(folded_lines) + "\r\n", None
