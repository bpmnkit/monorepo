# String functions — matches(input, pattern, flags)

Returns `true` if the given value matches the `pattern`. Otherwise, returns `false`.

**Function signature**

```feel
matches(input: string, pattern: string, flags: string): boolean
```

The `pattern` is a string that contains a regular expression.

The `flags` can contain one or more of the following characters:

- `s` (dot-all)
- `m` (multi-line)
- `i` (case insensitive)
- `x` (comments)

**Examples**

```feel
matches("FooBar", "foo", "i")
// true
```


## replace(input, pattern, replacement)

Returns the resulting string after replacing all occurrences of `pattern` with `replacement`.

**Function signature**

```feel
replace(input: string, pattern: string, replacement: string): string
```

The `pattern` is a string that contains a regular expression.

The `replacement` can access the match groups by using `$` and the number of the group, for example,
`$1` to access the first group.

**Examples**

```feel
replace("abcd", "(ab)|(a)", "[1=$1][2=$2]")
// "[1=ab][2=]cd"

replace("0123456789", "(\d{3})(\d{3})(\d{4})", "($1) $2-$3")
// "(012) 345-6789"
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-string
