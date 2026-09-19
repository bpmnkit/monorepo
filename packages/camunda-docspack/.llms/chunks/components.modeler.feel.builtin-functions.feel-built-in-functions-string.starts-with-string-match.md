# String functions — starts with(string, match)

Returns `true` if the given value starts with the substring `match`. Otherwise, returns `false`.

**Function signature**

```feel
starts with(string: string, match: string): boolean
```

**Examples**

```feel
starts with("foobar", "fo")
// true
```


## ends with(string, match)

Returns `true` if the given value ends with the substring `match`. Otherwise, returns `false`.

**Function signature**

```feel
ends with(string: string, match: string): boolean
```

**Examples**

```feel
ends with("foobar", "r")
// true
```


## matches(input, pattern)

Returns `true` if the given value matches the `pattern`. Otherwise, returns `false`.

**Function signature**

```feel
matches(input: string, pattern: string): boolean
```

The `pattern` is a string that contains a regular expression.

**Examples**

```feel
matches("foobar", "^fo*bar")
// true
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-string
