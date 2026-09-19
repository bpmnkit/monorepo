# List functions — string join(list, delimiter, prefix, suffix)

(Camunda extension)(Camunda extension)

Joins a list of strings into a single string. This is similar to
Java's [joining](<https://docs.oracle.com/en/java/javase/11/docs/api/java.base/java/util/stream/Collectors.html#joining(java.lang.CharSequence,java.lang.CharSequence,java.lang.CharSequence)>)
function.

If an item of the list is `null`, the item is ignored for the result string. If an item is
neither a string nor `null`, the function returns `null` instead of a string.

The resulting string starts with `prefix`, contains a `delimiter` between each element, and ends
with `suffix`.

**Function signature**

```feel
string join(list: list<string>, delimiter: string, prefix: string, suffix: string): string
```

**Examples**

```feel
string join(["a","b","c"], ", ", "[", "]")
// "[a, b, c]"
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-list
