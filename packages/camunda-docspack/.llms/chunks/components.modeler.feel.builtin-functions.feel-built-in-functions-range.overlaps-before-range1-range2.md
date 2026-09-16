# Range functions — overlaps before(range1, range2)

**Function signature**

```feel
overlaps before(range1: range, range2: range): boolean
```

**Examples**

```feel
overlaps before([1..5], [4..10])
// true

overlaps before([3..4], [1..2])
// false

overlaps before([1..3], (3..5])
// false

overlaps before([1..5), (3..8])
// true

overlaps before([1..5), [5..10])
// false
```


## overlaps after(range1, range2)

**Function signature**

```feel
overlaps after(range1: range, range2: range): boolean
```

**Examples**

```feel
overlaps after([4..10], [1..5])
// true

overlaps after([3..4], [1..2])
// false

overlaps after([3..5], [1..3))
// false

overlaps after((5..8], [1..5))
// false

overlaps after([4..10], [1..5))
// true
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-range
