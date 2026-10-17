# NoticeLens Specification (docs/SPEC.md)

## Event Fields
- **id**: Unique identifier string.
- **title**: Event title string (e.g. 'Internal Test 2', 'Lab records submission').
- **type**: One of `test`, `deadline`, `lecture`, `holiday`, `other`.
- **date**: Date in `YYYY-MM-DD` format.
- **start**: Time in `HH:MM` format (24-hour), or `null`.
- **end**: Time in `HH:MM` format (24-hour), or `null`.
- **all_day**: Boolean (`true` for holidays and full-day events, `false` otherwise).
- **venue**: Venue string (e.g. 'Room 204', 'Seminar Hall', or empty string `""`).
- **spans**: Map of field name to `[start, end]` character offsets into the original text (e.g., `title`, `date`, `time`, `venue`).
- **flags**: List of warning/annotation strings.

## Flags
- `missing_time`: Event has a date but no time (not applied to holidays).
- `no_ampm`: AM/PM was not stated and had to be inferred.
- `no_year`: No year was given in the date text.
- `ambiguous_date`: Numeric date without an explicit year read as dd/mm.
- `unknown_type`: Could not determine event type; defaulted to `other`.
- `no_venue`: No venue was detected in the notice (not applied to holidays).
- `assumed_end`: A test or lecture with a start time but no end time; assumed to last 60 minutes.
- `date_range`: Date range detected (e.g. 'from 20 Nov to 22 Nov'); only first day added.
- `past_date`: Event date is in the past relative to today.

## Rules
- Dates written as numbers are `dd/mm` (e.g. `13/11/2026` is 13th November 2026).
- A missing year means the next occurrence of that date on or after today, unless another date in the same notice has an explicit year that gives a date on or after today; then use that year without a flag.
- 'noon' is `12:00`.
- A deadline is a single point in time at its time, with no end (`end` is null).
- A test or lecture with a start but no end is assumed to last 60 minutes and gets the flag `assumed_end`.
- Two timed events clash if `a.start < b.end` and `b.start < a.end`.
- A deadline clashes with an event if `event.start <= deadline < event.end`. A deadline exactly at an event's end does not clash. Two deadlines never clash.
- A holiday is all-day and clashes with every other event on the same date.
- Time zone is Asia/Kolkata (UTC+5:30, no daylight saving).
