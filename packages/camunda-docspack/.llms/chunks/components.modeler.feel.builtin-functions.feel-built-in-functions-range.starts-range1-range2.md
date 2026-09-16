# Range functions — starts(range1, range2)

**Function signature**

```feel
starts(range1: range, range2: range): boolean
```

**Examples**

```feel
starts((1..5], [1..5])
// false

starts([1..10], [1..5])
// false

starts((1..5), (1..10))
// true
```


## started by(range, point)

**Function signature**

```feel
started by(range: range, point: Any): boolean
```

**Examples**

```feel
started by([1..10], 1)
// true

started by((1..10], 1)
// false
```


## started by(range1, range2)

**Function signature**

```feel
started by(range1: range, range2: range): boolean
```

**Examples**

```feel
started by([1..10], [1..5])
// true

started by((1..10], [1..5))
// false

started by([1..10], [1..10))
// true
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-range
