# Context expressions — Examples

### Validate data

Validate journal entries and return all violations.

```feel
{
  check1: {
    error: "Document Type invalid for current year posting",
    violations: collection[documentType = "S2" and glDate > startFiscalYear]
  },
  check2: {
    error: "Document Type invalid for current year posting",
    violations: collection[ledgerType = "GP" and foreignAmount != null]
  },
  result: [check1, check2][count(violations) > 0]
}
```

### Structure calculation

Calculate the minimum age of a given list of birthdays.

```feel
{
  age: function(birthday) (today() - birthday).years,
  ages: for birthday in birthdays return age(birthday),
  minAge: min(ages)
}.minAge
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/language-guide/feel-context-expressions
