# Timer events — Timers — Time date

A specific point in time defined as ISO 8601 combined date and time representation. It must contain timezone information, either `Z` for UTC or a zone offset. Optionally, it can contain a zone id.

- `2019-10-01T12:00:00Z` - UTC time
- `2019-10-02T08:09:40+02:00` - UTC plus two hours zone offset
- `2019-10-02T08:09:40+02:00[Europe/Berlin]` - UTC plus two hours zone offset at Berlin

If the date is in the past at the time of deployment, the timer fires immediately.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/timer-events/timer-events
