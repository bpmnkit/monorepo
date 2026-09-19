# Temporal expressions — Examples

### Compare date with offset

Check if a date is at least 6 months before another date.

```feel
date1 < date2 + @"P6M"
```

### Calculate age

Return the current age of a person based on a given birthday.

```feel
years and months duration(date(birthday), today()).years
```

### Check for weekend

Check if the current day is on a weekend.

```feel
day of week(today()) in ("Saturday","Sunday")
```

### Calculate duration between dates

Return the duration between now and the next Tuesday at 08:00.

```feel
(for x in 1..7
  return date and time(today(),@"08:00:00Z") + @"P1D" * x
)[day of week(item) = "Tuesday"][1] - now()
```

### Calculate duration between times

Return the duration between now and the next time it is 09:00 in the Europe/Berlin timezone.

```feel
{
  time: @"09:00:00@Europe/Berlin",
  date: if time(now()) < time then today() else today() + @"P1D",
  duration: date and time(date, time) - now()
}.duration
```

### Calculate next weekday

Return the next day that is not a weekend at 00:00.

```feel
(for x in 1..3
  return date and time(today(),@"00:00:00Z") + @"P1D" * x
)[not(day of week(item) in ("Saturday","Sunday"))][1]
```

### Change format of dates

Transform a given list of date-time values into a custom format.

```feel
for d in dates return {
  date: date(date and time(d)),
  day: string(date.day),
  month: substring(month of year(date), 1, 3),
  year: string(date.year),
  formatted: day + "-" + month + "-" + year
}.formatted
```

#### Evaluation context

```feel
["2021-04-21T07:25:06.000Z", "2021-04-22T07:25:06.000Z"]
```

#### Evaluation result

```feel
["21-Apr-2021", "22-Apr-2021"]
```

### Create a Unix timestamp

Return the current point in time as a Unix timestamp.

```feel
(now() - @"1970-01-01T00:00Z") / @"PT1S" * 1000
```

#### Evaluation result

```feel
1618200039000
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/language-guide/feel-temporal-expressions
