# Range functions — before(range, point)

**Function signature**

```feel
before(range: range, point: Any): boolean
```

**Examples**

```feel
before([1..5], 10)
// true
```


## before(point, range)

**Function signature**

```feel
before(point: Any, range: range): boolean
```

**Examples**

```feel
before(1, [2..5])
// true
```


## before(range1, range2)

**Function signature**

```feel
before(range1: range, range2: range): boolean
```

**Examples**

```feel
before([1..5], [6..10])
// true

before([1..5),[5..10])
// true
```


## after(point1, point2)

**Function signature**

```feel
after(point1: Any, point2: Any): boolean
```

**Examples**

```feel
after(10, 1)
// true

after(1, 10)
// false
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-range
