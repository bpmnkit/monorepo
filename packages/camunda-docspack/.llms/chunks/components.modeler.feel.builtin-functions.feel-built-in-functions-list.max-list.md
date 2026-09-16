# List functions — max(list)

Returns the maximum of the given list.

**Function signature**

```feel
max(list: list): Any
```

All elements in `list` should have the same type and be comparable.

The parameter `list` can be passed as a list or as a sequence of elements.

**Examples**

```feel
max([1,2,3])
// 3

max(1,2,3)
// 3
```


## sum(list)

Returns the sum of the given list of numbers.

**Function signature**

```feel
sum(list: list<number>): number
```

The parameter `list` can be passed as a list or as a sequence of elements.

**Examples**

```feel
sum([1,2,3])
// 6

sum(1,2,3)
// 6
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-list
