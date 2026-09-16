# List functions — mode(list)

Returns the mode of the given list of numbers.

**Function signature**

```feel
mode(list: list<number>): number
```

The parameter `list` can be passed as a list or as a sequence of elements.

**Examples**

```feel
mode(6, 3, 9, 6, 6)
// [6]

mode([6, 1, 9, 6, 1])
// [1, 6]
```


## all(list)

Returns `false` if any element of the given list is `false`. Otherwise, returns `true`.

If the given list is empty, it returns `true`.

**Function signature**

```feel
all(list: list<boolean>): boolean
```

The parameter `list` can be passed as a list or as a sequence of elements.

**Examples**

```feel
all([true,false])
// false

all(false,null,true)
// false
```

**Info**
The function `all()` replaced the previous function `and()`. The previous function is deprecated and
should not be used anymore.

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-list
