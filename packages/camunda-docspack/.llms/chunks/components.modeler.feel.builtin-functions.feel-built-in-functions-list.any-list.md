# List functions — any(list)

Returns `true` if any element of the given list is `true`. Otherwise, returns `false`.

If the given list is empty, it returns `false`.

**Function signature**

```feel
any(list: list<boolean>): boolean
```

The parameter `list` can be passed as a list or as a sequence of elements.

**Examples**

```feel
any([false,true])
// true

any(false,null,true)
// true
```

**Info**
The function `any()` replaced the previous function `or()`. The previous function is deprecated and
should not be used anymore.


## sublist(list, start position)

Returns a partial list of the given value starting at `start position`.

**Function signature**

```feel
sublist(list: list, start position: number): list
```

The `start position` starts at the index `1`. The last position is `-1`.

**Examples**

```feel
sublist([1,2,3], 2)
// [2,3]
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-list
