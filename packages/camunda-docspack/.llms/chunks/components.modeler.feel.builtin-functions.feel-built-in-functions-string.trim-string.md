# String functions — trim(string)

(Camunda extension)(Camunda extension)

Returns the given string without leading and trailing spaces.

**Function signature**

```feel
trim(string: string): string
```

**Examples**

```feel
trim("  hello world  ")
// "hello world"

trim("hello   world ")
// "hello   world"
```


## uuid()

(Camunda extension)(Camunda extension)

Returns a UUID (Universally Unique Identifier) with 36 characters.

**Function signature**

```feel
uuid(): string
```

**Examples**

```feel
uuid()
// "7793aab1-d761-4d38-916b-b7270e309894"
```


## to base64(value)

(Camunda extension)(Camunda extension)

Returns the given string encoded in Base64 format.

**Function signature**

```feel
to base64(value: string): string
```

**Examples**

```feel
to base64("FEEL")
// "RkVFTA=="
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-string
