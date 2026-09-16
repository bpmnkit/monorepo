# Range functions — finishes(point, range)

**Function signature**

```feel
finishes(point: Any, range: range): boolean
```

**Examples**

```feel
finishes(5, [1..5])
// true

finishes(10, [1..7])
// false
```


## finishes(range1, range2)

**Function signature**

```feel
finishes(range1: range, range2: range): boolean
```

**Examples**

```feel
finishes([3..5], [1..5])
// true

finishes((1..5], [1..5))
// false

finishes([5..10], [1..10))
// false
```


## finished by(range, point)

**Function signature**

```feel
finished by(range: range, point: Any): boolean
```

**Examples**

```feel
finished by([5..10], 10)
// true

finished by([3..4], 2)
// false
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-range
