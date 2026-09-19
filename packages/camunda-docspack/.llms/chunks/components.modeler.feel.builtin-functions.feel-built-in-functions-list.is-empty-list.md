# List functions — is empty(list)

(Camunda extension)(Camunda extension)

Returns `true` if the given list is empty. Otherwise, returns `false`.

**Function signature**

```feel
is empty(list: list): boolean
```

**Examples**

```feel
is empty([])
// true

is empty([1,2,3])
// false
```


## partition(list, size)

(Camunda extension)(Camunda extension)

Returns consecutive sublists of a list, each of the same size (the final list may be smaller).

If `size` is less than `0`, it returns `null`.

**Function signature**

```feel
partition(list: list, size: number): list
```

**Examples**

```feel
partition([1,2,3,4,5], 2)
// [[1,2], [3,4], [5]]

partition([], 2)
// []

partition([1,2], 0)
// null
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-list
