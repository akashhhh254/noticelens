#!/usr/bin/env python3
"""CLI bridge for NoticeLens rule engine."""
import sys
import os
import json
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from notice_lens.extractor import extract_events
from notice_lens.clash import find_clashes
from notice_lens.ics_export import generate_ics

def main():
    try:
        raw = sys.stdin.read()
        if not raw:
            print(json.dumps({"error": "Empty input"}))
            sys.exit(1)
        req = json.loads(raw)
        action = req.get("action")
        payload = req.get("payload", {})

        if action == "extract":
            text = payload.get("text", "")
            today_str = payload.get("today")
            if today_str:
                try:
                    today_val = date.fromisoformat(today_str)
                except ValueError:
                    today_val = date.today()
            else:
                today_val = date.today()

            events = extract_events(text, today_val)
            warnings = []
            if not events:
                warnings.append("No dates or times were found. Check that the notice includes a date.")
            print(json.dumps({"events": events, "warnings": warnings}))

        elif action == "clashes":
            events = payload.get("events", [])
            timetable = payload.get("timetable", [])
            result = find_clashes(events, timetable)
            print(json.dumps(result))

        elif action == "export":
            events = payload.get("events", [])
            ics_text, err = generate_ics(events)
            if err:
                print(json.dumps({"error": err}))
            else:
                print(json.dumps({"ics": ics_text}))

        else:
            print(json.dumps({"error": f"Unknown action: {action}"}))
            sys.exit(1)

    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
