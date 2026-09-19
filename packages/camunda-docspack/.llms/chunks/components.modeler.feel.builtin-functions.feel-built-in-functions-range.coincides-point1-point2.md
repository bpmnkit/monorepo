# Range functions — coincides(point1, point2)

**Function signature**

```feel
coincides(point1: Any, point2: Any): boolean
```

**Examples**

```feel
coincides(5, 5)
// true

coincides(3, 4)
// false
```


## coincides(range1, range2)

**Function signature**

```feel
coincides(range1: range, range2: range): boolean
```

**Examples**

```feel
coincides([1..5], [1..5])
// true

coincides((1..5], [1..5))
// false

coincides([1..5], [2..6])
// false
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-range
