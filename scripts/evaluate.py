"""Evaluation script for NoticeLens extraction accuracy across gold notices."""
import glob
import json
import os
import sys
from datetime import date

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from notice_lens.extractor import extract_events
from tests.fixtures.expected import TODAY


def evaluate():
    gold_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "tests", "gold")
    txt_files = sorted(glob.glob(os.path.join(gold_dir, "*.txt")))

    if not txt_files:
        print(f"No gold notices found in {gold_dir}")
        return

    total_notices = 0
    perfect_notices = 0
    total_expected_events = 0
    missing_events = 0
    extra_events = 0

    field_counts = {
        "title": 0,
        "type": 0,
        "date": 0,
        "start": 0,
        "end": 0,
        "venue": 0,
    }

    per_notice_failures = []

    for txt_path in txt_files:
        base_name = os.path.splitext(txt_path)[0]
        json_path = base_name + ".json"

        if not os.path.exists(json_path):
            continue

        total_notices += 1
        with open(txt_path, "r", encoding="utf-8") as f:
            notice_text = f.read()

        with open(json_path, "r", encoding="utf-8") as f:
            expected_events = json.load(f)

        extracted_events = extract_events(notice_text, TODAY)
        num_expected = len(expected_events)
        num_extracted = len(extracted_events)
        total_expected_events += num_expected

        notice_perfect = True
        notice_fails = []

        if num_extracted < num_expected:
            diff = num_expected - num_extracted
            missing_events += diff
            notice_perfect = False
            notice_fails.append(f"Missing {diff} event(s)")
        elif num_extracted > num_expected:
            diff = num_extracted - num_expected
            extra_events += diff
            notice_perfect = False
            notice_fails.append(f"Found {diff} extra event(s)")

        # Match events
        # We compare pairwise (1-to-1)
        matched_pairs = min(num_expected, num_extracted)
        for i in range(matched_pairs):
            exp = expected_events[i]
            ext = extracted_events[i]

            # Title: case-insensitive containment
            exp_title = exp.get("title", "").strip().lower()
            ext_title = ext.get("title", "").strip().lower()
            if exp_title in ext_title or ext_title in exp_title:
                field_counts["title"] += 1
            else:
                notice_perfect = False
                notice_fails.append(f"Event {i} title mismatch: expected '{exp.get('title')}', got '{ext.get('title')}'")

            # Type
            if exp.get("type") == ext.get("type"):
                field_counts["type"] += 1
            else:
                notice_perfect = False
                notice_fails.append(f"Event {i} type mismatch: expected '{exp.get('type')}', got '{ext.get('type')}'")

            # Date
            if exp.get("date") == ext.get("date"):
                field_counts["date"] += 1
            else:
                notice_perfect = False
                notice_fails.append(f"Event {i} date mismatch: expected '{exp.get('date')}', got '{ext.get('date')}'")

            # Start
            if exp.get("start") == ext.get("start"):
                field_counts["start"] += 1
            else:
                notice_perfect = False
                notice_fails.append(f"Event {i} start mismatch: expected '{exp.get('start')}', got '{ext.get('start')}'")

            # End
            if exp.get("end") == ext.get("end"):
                field_counts["end"] += 1
            else:
                notice_perfect = False
                notice_fails.append(f"Event {i} end mismatch: expected '{exp.get('end')}', got '{ext.get('end')}'")

            # Venue: case-insensitive containment
            exp_venue = exp.get("venue", "").strip().lower()
            ext_venue = ext.get("venue", "").strip().lower()
            if exp_venue == ext_venue or (exp_venue and exp_venue in ext_venue) or (ext_venue and ext_venue in exp_venue):
                field_counts["venue"] += 1
            else:
                notice_perfect = False
                notice_fails.append(f"Event {i} venue mismatch: expected '{exp.get('venue')}', got '{ext.get('venue')}'")

        if notice_perfect:
            perfect_notices += 1
        else:
            rel_name = os.path.basename(txt_path)
            per_notice_failures.append((rel_name, notice_fails))

    # Print summary report
    print("\n========================================================")
    print("           NoticeLens Accuracy Evaluation Report        ")
    print("========================================================")
    print(f"Total Notices Evaluated : {total_notices}")
    print(f"Total Expected Events   : {total_expected_events}")
    print(f"Missing Events          : {missing_events}")
    print(f"Extra Events            : {extra_events}\n")

    print("Field Accuracy (among expected events):")
    print("--------------------------------------------------------")
    denom = max(1, total_expected_events)
    for field in ["title", "type", "date", "start", "end", "venue"]:
        pct = (field_counts[field] / denom) * 100
        print(f"  {field.capitalize():<8} : {pct:6.2f}% ({field_counts[field]}/{total_expected_events})")

    notices_pct = (perfect_notices / max(1, total_notices)) * 100
    print("--------------------------------------------------------")
    print(f"Perfect Notices Match   : {notices_pct:6.2f}% ({perfect_notices}/{total_notices})")
    print("========================================================\n")

    if per_notice_failures:
        print("Per-Notice Failures:")
        for name, fails in per_notice_failures:
            print(f"\n[!] {name}:")
            for fail_msg in fails:
                print(f"    - {fail_msg}")
    else:
        print("All evaluated gold notices matched with 100% precision!\n")


if __name__ == "__main__":
    evaluate()
