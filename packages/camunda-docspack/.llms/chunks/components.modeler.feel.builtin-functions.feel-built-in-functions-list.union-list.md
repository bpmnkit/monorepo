# List functions — union(list)

Returns a list that includes all elements of the given lists without duplicates.

**Function signature**

```feel
union(list: list): list
```

The parameter `list` is a sequence of lists.

**Examples**

```feel
union([1,2],[2,3])
// [1,2,3]
```


## distinct values(list)

Returns the given list without duplicates.

**Function signature**

```feel
distinct values(list: list): list
```

**Examples**

```feel
distinct values([1,2,3,2,1])
// [1,2,3]
```


## duplicate values(list)

(Camunda extension)(Camunda extension)

Returns all duplicate values of the given list.

**Function signature**

```feel
duplicate values(list: list): list
```

**Examples**

```feel
duplicate values([1,2,3,2,1])
// [1,2]
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-list
