# List functions — sublist(list, start position, length)

Returns a partial list of the given value starting at `start position`.

**Function signature**

```feel
sublist(list: list, start position: number, length: number): list
```

The `start position` starts at the index `1`. The last position is `-1`.

**Examples**

```feel
sublist([1,2,3], 1, 2)
// [1,2]
```


## append(list, items)

Returns the given list with all `items` appended.

**Function signature**

```feel
append(list: list, items: Any): list
```

The parameter `items` can be a single element or a sequence of elements.

**Examples**

```feel
append([1], 2, 3)
// [1,2,3]
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-list
