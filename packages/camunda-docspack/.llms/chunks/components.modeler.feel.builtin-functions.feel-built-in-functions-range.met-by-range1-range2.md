# Range functions — met by(range1, range2)

**Function signature**

```feel
met by(range1: range, range2: range): boolean
```

**Examples**

```feel
met by([5..10], [1..5])
// true

met by([3..4], [1..2])
// false

met by([3..5], [1..3])
// true

met by((5..8], [1..5))
// false

met by([5..10], [1..5))
// false
```


## overlaps(range1, range2)

**Function signature**

```feel
overlaps(range1: range, range2: range): boolean
```

**Examples**

```feel
overlaps([5..10], [1..6])
// true

overlaps((3..7], [1..4])
// true

overlaps([1..3], (3..6])
// false

overlaps((5..8], [1..5))
// false

overlaps([4..10], [1..5))
// true
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-range
