---
"@bpmnkit/feel": minor
---

Camunda 8's FEEL built-ins, and a parity suite against Camunda's documentation.

- New built-ins from Camunda's engine: `assert`, `is empty`, `partition`, `duplicate values`,
  `is blank`, `trim`, `extract`, `uuid`, `to base64`, `from base64`, `to json`, `from json`,
  `fromAi`, and `date and time(value, timezone)`, which moves an instant to another zone's
  clock.
- **Behaviour change:** `last day of month` now returns the date of the month's last day, as
  Camunda defines it. It used to return the day number, so `last day of month(date("2022-10-01"))`
  was `31` and is now `date("2022-10-31")`. Use `last day of month(d).day` for the number.
- `time + duration`, `time - duration`, `time - time` and `duration / duration` evaluate instead
  of returning `null`.
- `time("T23:59:00")` and date-times in Java's `+02:00[Europe/Berlin]` form parse.
- `overlaps before` and `overlaps after` no longer report an overlap where ranges only touch at
  an open end, following DMN's definition. Two more DMN TCK cases pass: 1,941 of 2,053.
- The package matches 375 of the 378 runnable examples in Camunda 8's FEEL documentation;
  `tests/camunda-parity.test.ts` checks them and lists the three differences with reasons.
