# String functions — from base64(value)

(Camunda extension)(Camunda extension)

Returns the given Base64 encoded string decoded to a plain string.

**Function signature**

```feel
from base64(value: string): string
```

**Examples**

```feel
from base64("RkVFTA==")
// "FEEL"
```


## is blank(string)

(Camunda extension)(Camunda extension)

Returns `true` if the given string is blank (empty or contains only whitespaces).

**Function signature**

```feel
is blank(string: string): boolean
```

**Examples**

```feel
is blank("")
// true

is blank(" ")
// true

is blank("hello world")
// false
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-string
