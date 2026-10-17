"""Clash detection engine for NoticeLens."""
from datetime import datetime, date


def _to_minutes(time_str: str) -> int:
    h, m = map(int, time_str.split(":"))
    return h * 60 + m


def _get_overlap_minutes(start_a: str, end_a: str, start_b: str, end_b: str) -> int:
    a1, a2 = _to_minutes(start_a), _to_minutes(end_a)
    b1, b2 = _to_minutes(start_b), _to_minutes(end_b)
    overlap = min(a2, b2) - max(a1, b1)
    return max(0, overlap)


def _normalize_day(day_str: str) -> str:
    """Normalizes day name to 3-letter abbreviation (Mon, Tue, etc.)"""
    d = day_str.strip()[:3].capitalize()
    return d


def find_clashes(events: list[dict], timetable: list[dict] | None = None) -> dict:
    """
    Finds clashes between events and against timetable slots.
    Returns:
    {
        "clashes": [
            {
                "a_id": ...,
                "b_id": ...,
                "kind": "overlap"|"deadline_inside"|"holiday"|"timetable",
                "minutes": int,
                "message": str,
                "action": str
            }
        ],
        "checks": [...],
        "skipped": [event_id, ...]
    }
    """
    if timetable is None:
        timetable = []

    clashes = []
    checks = []
    skipped = []

    active_events = []
    for evt in events:
        if not evt.get("all_day") and not evt.get("start"):
            skipped.append(evt["id"])
        else:
            active_events.append(evt)

    # 1. Compare event pairs
    n = len(active_events)
    for i in range(n):
        for j in range(i + 1, n):
            a = active_events[i]
            b = active_events[j]

            # Same date check
            if a.get("date") != b.get("date"):
                checks.append({
                    "a_id": a["id"],
                    "b_id": b["id"],
                    "a_title": a.get("title", ""),
                    "b_title": b.get("title", ""),
                    "clash": False,
                    "kind": None,
                    "minutes": 0,
                    "message": "Events are on different dates.",
                    "action": "",
                })
                continue

            # Holiday check
            if a.get("all_day") or b.get("all_day") or a.get("type") == "holiday" or b.get("type") == "holiday":
                clash_item = {
                    "a_id": a["id"],
                    "b_id": b["id"],
                    "kind": "holiday",
                    "minutes": 0,
                    "message": "This is on a day the college is closed.",
                    "action": "Confirm the date with the coordinator.",
                }
                clashes.append(clash_item)
                checks.append({
                    "a_id": a["id"],
                    "b_id": b["id"],
                    "a_title": a.get("title", ""),
                    "b_title": b.get("title", ""),
                    "clash": True,
                    **clash_item
                })
                continue

            # Check if one is a deadline and the other is a timed event
            is_a_deadline = (a.get("type") == "deadline" or a.get("end") is None)
            is_b_deadline = (b.get("type") == "deadline" or b.get("end") is None)

            if is_a_deadline and is_b_deadline:
                # Two deadlines never clash
                checks.append({
                    "a_id": a["id"],
                    "b_id": b["id"],
                    "a_title": a.get("title", ""),
                    "b_title": b.get("title", ""),
                    "clash": False,
                    "kind": None,
                    "minutes": 0,
                    "message": "Both are deadlines.",
                    "action": "",
                })
                continue

            if is_a_deadline:
                dl_evt = a
                timed_evt = b
                dl_time = _to_minutes(dl_evt["start"])
                t_start = _to_minutes(timed_evt["start"])
                t_end = _to_minutes(timed_evt["end"]) if timed_evt.get("end") else t_start + 60

                if t_start <= dl_time < t_end:
                    clash_item = {
                        "a_id": a["id"],
                        "b_id": b["id"],
                        "kind": "deadline_inside",
                        "minutes": 0,
                        "message": "The deadline falls during this event.",
                        "action": "Submit before the event starts, or ask the coordinator about extending the time.",
                    }
                    clashes.append(clash_item)
                    checks.append({
                        "a_id": a["id"],
                        "b_id": b["id"],
                        "a_title": a.get("title", ""),
                        "b_title": b.get("title", ""),
                        "clash": True,
                        **clash_item
                    })
                else:
                    checks.append({
                        "a_id": a["id"],
                        "b_id": b["id"],
                        "a_title": a.get("title", ""),
                        "b_title": b.get("title", ""),
                        "clash": False,
                        "kind": None,
                        "minutes": 0,
                        "message": "Deadline is outside the event hours.",
                        "action": "",
                    })
                continue

            if is_b_deadline:
                dl_evt = b
                timed_evt = a
                dl_time = _to_minutes(dl_evt["start"])
                t_start = _to_minutes(timed_evt["start"])
                t_end = _to_minutes(timed_evt["end"]) if timed_evt.get("end") else t_start + 60

                if t_start <= dl_time < t_end:
                    clash_item = {
                        "a_id": a["id"],
                        "b_id": b["id"],
                        "kind": "deadline_inside",
                        "minutes": 0,
                        "message": "The deadline falls during this event.",
                        "action": "Submit before the event starts, or ask the coordinator about extending the time.",
                    }
                    clashes.append(clash_item)
                    checks.append({
                        "a_id": a["id"],
                        "b_id": b["id"],
                        "a_title": a.get("title", ""),
                        "b_title": b.get("title", ""),
                        "clash": True,
                        **clash_item
                    })
                else:
                    checks.append({
                        "a_id": a["id"],
                        "b_id": b["id"],
                        "a_title": a.get("title", ""),
                        "b_title": b.get("title", ""),
                        "clash": False,
                        "kind": None,
                        "minutes": 0,
                        "message": "Deadline is outside the event hours.",
                        "action": "",
                    })
                continue

            # Both are timed events
            a_start, a_end = a["start"], a["end"]
            b_start, b_end = b["start"], b["end"]

            # Two timed events clash if a.start < b.end and b.start < a.end
            if a_start < b_end and b_start < a_end:
                overlap = _get_overlap_minutes(a_start, a_end, b_start, b_end)
                clash_item = {
                    "a_id": a["id"],
                    "b_id": b["id"],
                    "kind": "overlap",
                    "minutes": overlap,
                    "message": f"These two overlap for {overlap} minutes.",
                    "action": "Ask the coordinator which one to attend or whether one can be moved.",
                }
                clashes.append(clash_item)
                checks.append({
                    "a_id": a["id"],
                    "b_id": b["id"],
                    "a_title": a.get("title", ""),
                    "b_title": b.get("title", ""),
                    "clash": True,
                    **clash_item
                })
            else:
                checks.append({
                    "a_id": a["id"],
                    "b_id": b["id"],
                    "a_title": a.get("title", ""),
                    "b_title": b.get("title", ""),
                    "clash": False,
                    "kind": None,
                    "minutes": 0,
                    "message": "No overlap between events.",
                    "action": "",
                })

    # 2. Check timetable slots against active events
    for slot in timetable:
        slot_day = _normalize_day(slot.get("day", ""))
        slot_start = slot.get("start")
        slot_end = slot.get("end")
        subject = slot.get("subject", "Class")

        if not slot_day or not slot_start or not slot_end:
            continue

        for evt in active_events:
            if evt.get("all_day"):
                continue

            evt_date_str = evt.get("date")
            if not evt_date_str:
                continue

            try:
                evt_dt = datetime.strptime(evt_date_str, "%Y-%m-%d")
                evt_day = evt_dt.strftime("%a")
            except ValueError:
                continue

            if evt_day != slot_day:
                checks.append({
                    "a_id": evt["id"],
                    "b_id": f"tt_{subject}",
                    "a_title": evt.get("title", ""),
                    "b_title": subject,
                    "clash": False,
                    "kind": None,
                    "minutes": 0,
                    "message": f"Different days ({evt_day} vs {slot_day}).",
                    "action": "",
                })
                continue

            evt_start = evt.get("start")
            evt_end = evt.get("end")
            if not evt_start:
                continue

            # If deadline (no end), does slot start <= deadline < slot end?
            if evt.get("type") == "deadline" or not evt_end:
                dl_m = _to_minutes(evt_start)
                s_m = _to_minutes(slot_start)
                e_m = _to_minutes(slot_end)
                if s_m <= dl_m < e_m:
                    clash_item = {
                        "a_id": evt["id"],
                        "b_id": f"tt_{subject}",
                        "kind": "timetable",
                        "minutes": 0,
                        "message": f"This overlaps your class {subject}.",
                        "action": "Check with the faculty or the coordinator about the clash.",
                    }
                    clashes.append(clash_item)
                    checks.append({
                        "a_id": evt["id"],
                        "b_id": f"tt_{subject}",
                        "a_title": evt.get("title", ""),
                        "b_title": subject,
                        "clash": True,
                        **clash_item
                    })
                continue

            # Timed event vs slot: slot.start < event.end and event.start < slot.end
            if slot_start < evt_end and evt_start < slot_end:
                overlap = _get_overlap_minutes(slot_start, slot_end, evt_start, evt_end)
                clash_item = {
                    "a_id": evt["id"],
                    "b_id": f"tt_{subject}",
                    "kind": "timetable",
                    "minutes": overlap,
                    "message": f"This overlaps your class {subject}.",
                    "action": "Check with the faculty or the coordinator about the clash.",
                }
                clashes.append(clash_item)
                checks.append({
                    "a_id": evt["id"],
                    "b_id": f"tt_{subject}",
                    "a_title": evt.get("title", ""),
                    "b_title": subject,
                    "clash": True,
                    **clash_item
                })
            else:
                checks.append({
                    "a_id": evt["id"],
                    "b_id": f"tt_{subject}",
                    "a_title": evt.get("title", ""),
                    "b_title": subject,
                    "clash": False,
                    "kind": None,
                    "minutes": 0,
                    "message": "No overlap with class.",
                    "action": "",
                })

    return {
        "clashes": clashes,
        "checks": checks,
        "skipped": skipped,
    }
