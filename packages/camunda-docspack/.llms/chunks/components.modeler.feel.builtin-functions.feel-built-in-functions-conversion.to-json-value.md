# Conversion functions — to json(value)

Converts a FEEL value into a JSON string. The function converts FEEL primitives, contexts, and lists into their
corresponding JSON types. Temporal values are converted to their ISO 8601 string representation, including timezone
information for date and time values (format: `2025-11-24T10:00:00+01:00[Europe/Berlin]`).

**Function signature**

```feel
to json(value: Any): string
```

**Examples**

```feel
to json({a: 1, b: 2})
// "{\"a\":1,\"b\":2}"

to json(true)
// "true"

to json(@"2023-06-14")
// "\"2023-06-14\""

to json(@"2025-11-24T10:00:00@Europe/Berlin")
// "\"2025-11-24T10:00:00+01:00[Europe/Berlin]\""

to json(@"P3Y")
// "\"P3Y\""
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-conversion
