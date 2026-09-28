//! Cron time cycles, as Zeebe reads them: Spring's six-field format
//! `second minute hour day-of-month month day-of-week`, in UTC.
//!
//! A field is `*`, `?`, a value, a range `a-b`, a step `*/n`, `a/n` or `a-b/n`,
//! or a comma-separated list of those. Months and days of the week also take
//! their English three-letter names; Sunday is 0 or 7. The macros `@yearly`,
//! `@annually`, `@monthly`, `@weekly`, `@daily`, `@midnight` and `@hourly` are
//! understood. Spring's `L`, `W` and `#` are not.

use chrono::{DateTime, Datelike, Duration, NaiveDate, TimeZone, Timelike, Utc};

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct Cron {
    seconds: u64,
    minutes: u64,
    hours: u64,
    days: u64,
    months: u64,
    weekdays: u64,
}

const MONTHS: [&str; 12] = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const WEEKDAYS: [&str; 7] = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

impl Cron {
    /// Parse a cron expression; `None` if it is not one.
    pub(crate) fn parse(expression: &str) -> Option<Cron> {
        let expression = match expression.trim().to_ascii_lowercase().as_str() {
            "@yearly" | "@annually" => "0 0 0 1 1 *".to_string(),
            "@monthly" => "0 0 0 1 * *".to_string(),
            "@weekly" => "0 0 0 * * 0".to_string(),
            "@daily" | "@midnight" => "0 0 0 * * *".to_string(),
            "@hourly" => "0 0 * * * *".to_string(),
            _ => expression.trim().to_ascii_uppercase(),
        };
        let fields: Vec<&str> = expression.split_whitespace().collect();
        let [second, minute, hour, day, month, weekday] = fields.as_slice() else {
            return None;
        };
        let weekdays = field(weekday, 0, 7, &WEEKDAYS, 0)?;
        Some(Cron {
            seconds: field(second, 0, 59, &[], 0)?,
            minutes: field(minute, 0, 59, &[], 0)?,
            hours: field(hour, 0, 23, &[], 0)?,
            days: field(day, 1, 31, &[], 0)?,
            months: field(month, 1, 12, &MONTHS, 1)?,
            // Sunday is both 0 and 7.
            weekdays: (weekdays | (weekdays >> 7)) & 0x7f,
        })
    }

    /// The first time matching the expression strictly after `after`.
    pub(crate) fn next_after(&self, after: DateTime<Utc>) -> Option<DateTime<Utc>> {
        let has = |set: u64, v: u32| set & (1 << v) != 0;
        let mut t = after.with_nanosecond(0)? + Duration::seconds(1);
        // Bounded, so that an expression that never matches (`0 0 0 31 2 *`) ends.
        for _ in 0..100_000 {
            if !has(self.months, t.month()) {
                let (y, m) = if t.month() == 12 { (t.year() + 1, 1) } else { (t.year(), t.month() + 1) };
                t = midnight(NaiveDate::from_ymd_opt(y, m, 1)?);
            } else if !has(self.days, t.day()) || !has(self.weekdays, t.weekday().num_days_from_sunday()) {
                t = midnight(t.date_naive().succ_opt()?);
            } else if !has(self.hours, t.hour()) {
                t = t.with_minute(0)?.with_second(0)? + Duration::hours(1);
            } else if !has(self.minutes, t.minute()) {
                t = t.with_second(0)? + Duration::minutes(1);
            } else if !has(self.seconds, t.second()) {
                t += Duration::seconds(1);
            } else {
                return Some(t);
            }
        }
        None
    }
}

fn midnight(date: NaiveDate) -> DateTime<Utc> {
    Utc.from_utc_datetime(&date.and_hms_opt(0, 0, 0).expect("midnight exists"))
}

/// The set of values a field allows, as a bit set. `names[i]` stands for `i + name_base`.
fn field(text: &str, min: u32, max: u32, names: &[&str], name_base: u32) -> Option<u64> {
    let value = |s: &str| -> Option<u32> {
        let v = match names.iter().position(|n| *n == s) {
            Some(i) => i as u32 + name_base,
            None => s.parse().ok()?,
        };
        (min..=max).contains(&v).then_some(v)
    };
    let mut set = 0u64;
    for part in text.split(',') {
        let (range, step) = match part.split_once('/') {
            Some((range, step)) => (range, step.parse::<u32>().ok().filter(|s| *s > 0)?),
            None => (part, 1),
        };
        let (from, to) = match range {
            "*" | "?" => (min, max),
            _ => match range.split_once('-') {
                Some((a, b)) => (value(a)?, value(b)?),
                // `a/n` runs from `a` to the end of the range.
                None if part.contains('/') => (value(range)?, max),
                None => (value(range)?, value(range)?),
            },
        };
        if from > to {
            return None;
        }
        for v in (from..=to).step_by(step as usize) {
            set |= 1 << v;
        }
    }
    Some(set)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn at(s: &str) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(s).unwrap().with_timezone(&Utc)
    }

    #[test]
    fn working_hours_on_weekdays() {
        // The example from the Camunda timer documentation.
        let cron = Cron::parse("0 0 9-17 * * MON-FRI").unwrap();
        // Friday 2026-09-25 17:30 → Monday 09:00.
        assert_eq!(cron.next_after(at("2026-09-25T17:30:00Z")), Some(at("2026-09-28T09:00:00Z")));
        assert_eq!(cron.next_after(at("2026-09-28T09:00:00Z")), Some(at("2026-09-28T10:00:00Z")));
    }

    #[test]
    fn steps_lists_and_names() {
        let cron = Cron::parse("*/15 * * * * *").unwrap();
        assert_eq!(cron.next_after(at("2026-01-01T00:00:14Z")), Some(at("2026-01-01T00:00:15Z")));
        assert_eq!(cron.next_after(at("2026-01-01T00:00:45Z")), Some(at("2026-01-01T00:01:00Z")));

        let cron = Cron::parse("0 30 8 1,15 jan,jul ?").unwrap();
        assert_eq!(cron.next_after(at("2026-01-15T08:30:00Z")), Some(at("2026-07-01T08:30:00Z")));

        // Sunday is 0 and 7.
        let sunday = at("2026-09-27T00:00:00Z");
        assert_eq!(Cron::parse("0 0 0 * * 7").unwrap().next_after(at("2026-09-26T12:00:00Z")), Some(sunday));
        assert_eq!(Cron::parse("0 0 0 * * 0").unwrap().next_after(at("2026-09-26T12:00:00Z")), Some(sunday));
    }

    #[test]
    fn macros_and_leap_days() {
        assert_eq!(Cron::parse("@daily").unwrap().next_after(at("2026-09-24T10:00:00Z")), Some(at("2026-09-25T00:00:00Z")));
        let feb29 = Cron::parse("0 0 12 29 2 *").unwrap();
        assert_eq!(feb29.next_after(at("2026-03-01T00:00:00Z")), Some(at("2028-02-29T12:00:00Z")));
        assert_eq!(Cron::parse("0 0 0 31 2 *").unwrap().next_after(at("2026-01-01T00:00:00Z")), None);
    }

    #[test]
    fn rejects_what_is_not_a_cron_expression() {
        for text in ["R/PT1H", "PT10M", "* * * * *", "0 0 25 * * *", "0 0 0 * * MON#2", "0 0 0 L * *", "0/0 * * * * *"] {
            assert_eq!(Cron::parse(text), None, "{text}");
        }
    }
}
