# List functions — flatten(list)

Returns a list that includes all elements of the given list without nested lists.

**Function signature**

```feel
flatten(list: list): list
```

**Examples**

```feel
flatten([[1,2],[[3]], 4])
// [1,2,3,4]
```


## sort(list, precedes)

Returns the given list sorted by the `precedes` function.

**Function signature**

```feel
sort(list: list, precedes: function<(Any, Any) -> boolean>): list
```

**Examples**

```feel
sort(list: [3,1,4,5,2], precedes: function(x,y) x < y)
// [1,2,3,4,5]
```


## string join(list)

Joins a list of strings into a single string. This is similar to
Java's [joining](<https://docs.oracle.com/en/java/javase/11/docs/api/java.base/java/util/stream/Collectors.html#joining(java.lang.CharSequence,java.lang.CharSequence,java.lang.CharSequence)>)
function.

If an item of the list is `null`, the item is ignored for the result string. If an item is
neither a string nor `null`, the function returns `null` instead of a string.

**Function signature**

```feel
string join(list: list<string>): string
```

**Examples**

```feel
string join(["a","b","c"])
// "abc"

string join(["a",null,"c"])
// "ac"

string join([])
// ""
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-list
