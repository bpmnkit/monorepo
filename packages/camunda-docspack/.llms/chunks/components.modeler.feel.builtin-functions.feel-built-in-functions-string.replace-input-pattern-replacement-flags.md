# String functions — replace(input, pattern, replacement, flags)

Returns the resulting string after replacing all occurrences of `pattern` with `replacement`.

**Function signature**

```feel
replace(input: string, pattern: string, replacement: string, flags: string): string
```

The `pattern` is a string that contains a regular expression.

The `replacement` can access the match groups by using `$` and the number of the group, for example,
`$1` to access the first group.

The `flags` can contain one or more of the following characters:

- `s` (dot-all)
- `m` (multi-line)
- `i` (case insensitive)
- `x` (comments)

**Examples**

```feel
replace("How do you feel?", "Feel", "FEEL", "i")
// "How do you FEEL?"
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-string
