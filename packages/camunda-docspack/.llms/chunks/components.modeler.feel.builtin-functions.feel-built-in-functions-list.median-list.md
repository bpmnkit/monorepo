# List functions — median(list)

Returns the median element of the given list of numbers.

**Function signature**

```feel
median(list: list<number>): number
```

The parameter `list` can be passed as a list or as a sequence of elements.

**Examples**

```feel
median(8, 2, 5, 3, 4)
// 4

median([6, 1, 2, 3])
// 2.5
```


## stddev(list)

Returns the standard deviation of the given list of numbers.

**Function signature**

```feel
stddev(list: list<number>): number
```

The parameter `list` can be passed as a list or as a sequence of elements.

**Examples**

```feel
stddev(2, 4, 7, 5)
// 2.0816659994661326

stddev([2, 4, 7, 5])
// 2.0816659994661326
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-list
