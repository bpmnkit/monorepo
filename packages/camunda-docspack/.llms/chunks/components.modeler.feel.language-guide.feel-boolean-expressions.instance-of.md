# Boolean expressions — Instance of

Checks if the value is of the given type. Available type names:

- `boolean`
- `number`
- `string`
- `date`
- `time`
- `date and time`
- `days and time duration`
- `years and months duration`
- `list`
- `context`
- `function`
- `Any`

Use the type `Any` to check if the value is not `null`.

```feel
1 instance of number
// true

1 instance of string
// false

1 instance of Any
// true

null instance of Any
// false

duration("P3M") instance of years and months duration
// true

duration("PT4H") instance of days and time duration
// true
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/language-guide/feel-boolean-expressions
