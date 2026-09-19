# String functions — split(string, delimiter)

Splits the given value into a list of substrings, breaking at each occurrence of the `delimiter` pattern.

**Function signature**

```feel
split(string: string, delimiter: string): list<string>
```

The `delimiter` is a string that contains a regular expression.

**Examples**

```feel
split("John Doe", "\s" )
// ["John", "Doe"]

split("a;b;c;;", ";")
// ["a", "b", "c", "", ""]
```


## extract(string, pattern)

(Camunda extension)(Camunda extension)

Returns all matches of the pattern in the given string. Returns an empty list if the pattern doesn't
match.

**Function signature**

```feel
extract(string: string, pattern: string): list<string>
```

The `pattern` is a string that contains a regular expression.

**Examples**

```feel
extract("references are 1234, 1256, 1378", "12[0-9]*")
// ["1234","1256"]
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-string
