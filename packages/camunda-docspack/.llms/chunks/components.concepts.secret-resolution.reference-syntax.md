# Secret resolution — Reference syntax

A reference has the form `camunda.secrets.<name>`, where `<name>` is a single, non-empty token of ASCII letters, digits, `_`, and `-`.

`camunda.secrets.<name>` is authored as a FEEL expression (`=camunda.secrets.<name>`), so a dashed name has to be backtick-escaped. A bare dash is FEEL's minus operator:

```feel
=camunda.secrets.`db-password`
```

An unescaped dashed name is not a reference. FEEL reads `=camunda.secrets.db-password` as the reference `db` minus the variable `password`.

### Charset differs by surface

The engine detects a reference by parsing the FEEL abstract syntax tree, not by matching characters against a fixed set. A name written in a model can therefore be anything a FEEL identifier allows, including unicode letters, `$`, and any name that is backtick-escaped, such as `` =camunda.secrets.`tls.crt` ``.

The gateway API is stricter. `POST /v2/secrets/resolve` and `POST /v2/secrets/list` both reject any name outside `[\p{Alnum}_-]+`.

| Name                                       | Resolves in a model | Usable with `/v2/secrets/resolve` or `/v2/secrets/list` |
| :----------------------------------------- | :-----------------: | :-----------------------------------------------------: |
| `API_TOKEN`                                |         Yes         |                           Yes                           |
| `` `db-password` `` (backtick-escaped)     |         Yes         |                 Yes (as `db-password`)                  |
| `` `tls.crt` `` (backtick-escaped)         |         Yes         |                   No: contains a `.`                    |
| `` `résumé` `` (backtick-escaped, unicode) |         Yes         |              No: outside `[\p{Alnum}_-]+`               |

A name a model can reference is not guaranteed to be creatable or manageable through the API. Use the API's charset for any name you intend to create, list, or grant permissions on through `/v2/secrets/*`.

---
Source: https://docs.camunda.io/docs/next/components/concepts/secret-resolution
