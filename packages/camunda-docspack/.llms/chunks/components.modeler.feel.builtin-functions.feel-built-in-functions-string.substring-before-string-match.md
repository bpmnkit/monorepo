# String functions — substring before(string, match)

Returns a substring of the given value that contains all characters before `match`.

**Function signature**

```feel
substring before(string: string, match: string): string
```

**Examples**

```feel
substring before("foobar", "bar")
// "foo"
```


## substring after(string, match)

Returns a substring of the given value that contains all characters after `match`.

**Function signature**

```feel
substring after(string: string, match: string): string
```

**Examples**

```feel
substring after("foobar", "ob")
// "ar"
```


## contains(string, match)

Returns `true` if the given value contains the substring `match`. Otherwise, returns `false`.

**Function signature**

```feel
contains(string: string, match: string): boolean
```

**Examples**

```feel
contains("foobar", "of")
// false
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-string
