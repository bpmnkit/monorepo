# List functions — concatenate(lists)

Returns a list that includes all elements of the given lists.

**Function signature**

```feel
concatenate(lists: list): list
```

The parameter `lists` is a sequence of lists.

**Examples**

```feel
concatenate([1,2],[3])
// [1,2,3]

concatenate([1],[2],[3])
// [1,2,3]
```


## insert before(list, position, newItem)

Returns the given list with `newItem` inserted at `position`.

**Function signature**

```feel
insert before(list: list, position: number, newItem: Any): list
```

The `position` starts at the index `1`. The last position is `-1`.

**Examples**

```feel
insert before([1,3],1,2)
// [2,1,3]
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-list
