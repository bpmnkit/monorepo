# Range functions — after(range, point)

**Function signature**

```feel
after(range: range, point: Any): boolean
```

**Examples**

```feel
after([1..5], 10)
// false
```


## after(point, range)

**Function signature**

```feel
after(point: Any, range: range): boolean
```

**Examples**

```feel
after(12, [2..5])
// true
```


## after(range1, range2)

**Function signature**

```feel
after(range1: range, range2: range): boolean
```

**Examples**

```feel
after([6..10], [1..5])
// true

after([5..10], [1..5))
// true
```


## meets(range1, range2)

**Function signature**

```feel
meets(range1: range, range2: range): boolean
```

**Examples**

```feel
meets([1..5], [5..10])
// true

meets([1..3], [4..6])
// false

meets([1..3], [3..5])
// true

meets([1..5], (5..8])
// false

```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-range
