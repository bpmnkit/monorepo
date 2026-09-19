# Range functions — finished by(range1, range2)

**Function signature**

```feel
finished by(range1: range, range2: range): boolean
```

**Examples**

```feel
finished by([1..5], [3..5])
// true

finished by((5..8], [1..5))
// false

finished by([5..10], (1..10))
// false
```


## includes(range, point)

**Function signature**

```feel
includes(range: range, point: Any): boolean
```

**Examples**

```feel
includes([5..10], 6)
// true

includes([3..4], 5)
// false
```


## includes(range1, range2)

**Function signature**

```feel
includes(range1: range, range2: range): boolean
```

**Examples**

```feel
includes([1..10], [4..6])
// true

includes((5..8], [1..5))
// false

includes([1..10], [1..5))
// true
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-range
