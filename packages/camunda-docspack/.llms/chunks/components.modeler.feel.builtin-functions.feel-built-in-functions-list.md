# List functions

This document outlines built-in list functions and examples.


## list contains(list, element)

Returns `true` if the given list contains the element. Otherwise, returns `false`.

**Function signature**

```feel
list contains(list: list, element: Any): boolean
```

**Examples**

```feel
list contains([1,2,3], 2)
// true
```


## count(list)

Returns the number of elements of the given list.

**Function signature**

```feel
count(list: list): number
```

**Examples**

```feel
count([1,2,3])
// 3
```


## min(list)

Returns the minimum of the given list.

**Function signature**

```feel
min(list: list): Any
```

All elements in `list` should have the same type and be comparable.

The parameter `list` can be passed as a list or as a sequence of elements.

**Examples**

```feel
min([1,2,3])
// 1

min(1,2,3)
// 1
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-list
