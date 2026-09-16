# Range functions — during(point, range)

**Function signature**

```feel
during(point: Any, range: range): boolean
```

**Examples**

```feel
during(5, [1..10])
// true

during(12, [1..10])
// false

during(1, (1..10])
// false
```


## during(range1, range2)

**Function signature**

```feel
during(range1: range, range2: range): boolean
```

**Examples**

```feel
during([4..6], [1..10))
// true

during((1..5], (1..10])
// true
```


## starts(point, range)

**Function signature**

```feel
starts(point: Any, range: range): boolean
```

**Examples**

```feel
starts(1, [1..5])
// true

starts(1, (1..8])
// false
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-range
