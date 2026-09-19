# List functions — product(list)

Returns the product of the given list of numbers.

**Function signature**

```feel
product(list: list<number>): number
```

The parameter `list` can be passed as a list or as a sequence of elements.

**Examples**

```feel
product([2, 3, 4])
// 24

product(2, 3, 4)
// 24
```


## mean(list)

Returns the arithmetic mean (i.e. average) of the given list of numbers.

**Function signature**

```feel
mean(list: list<number>): number
```

The parameter `list` can be passed as a list or as a sequence of elements.

**Examples**

```feel
mean([1,2,3])
// 2

mean(1,2,3)
// 2
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-list
