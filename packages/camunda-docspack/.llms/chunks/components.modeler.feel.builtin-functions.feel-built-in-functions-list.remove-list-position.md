# List functions — remove(list, position)

Returns the given list without the element at `position`.

**Function signature**

```feel
remove(list: list, position: number): list
```

The `position` starts at the index `1`. The last position is `-1`.

**Examples**

```feel
remove([1,2,3], 2)
// [1,3]
```


## reverse(list)

Returns the given list in revered order.

**Function signature**

```feel
reverse(list: list): list
```

**Examples**

```feel
reverse([1,2,3])
// [3,2,1]
```


## index of(list, match)

Returns an ascending list of positions containing `match`.

**Function signature**

```feel
index of(list: list, match: Any): list<number>
```

**Examples**

```feel
index of([1,2,3,2],2)
// [2,4]
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-list
