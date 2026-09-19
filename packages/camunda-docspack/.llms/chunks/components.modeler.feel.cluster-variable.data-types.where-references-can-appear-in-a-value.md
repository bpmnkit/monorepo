# Supported data types — Where references can appear in a value

Camunda scans every string in a `SECRET_REFERENCE`-kind variable's value, including strings nested inside objects and arrays. Object keys are not scanned. A reference has the form `camunda.secrets.<name>`, where `<name>` can contain ASCII letters, digits, underscores, and dashes, up to 240 characters. A name that fails either limit is never resolved; see [secrets](https://docs.camunda.io/docs/next/self-managed/components/orchestration-cluster/core-settings/configuration/properties#secrets). This character set applies to references embedded in a cluster-variable value; a reference [written directly in an input mapping source](https://docs.camunda.io/docs/next/components/concepts/variables#escape-secret-names-with-special-characters) can use other characters through backtick escaping.

For example, the following value carries two references, one at the top level and one nested:

```json
{
  "apiKey": "camunda.secrets.PAYMENT_API_KEY",
  "database": {
    "user": "reporting",
    "password": "camunda.secrets.REPORTING_DB_PASSWORD"
  }
}
```

Do not place a reference inside an array. Camunda detects such a reference when you create the variable, but it cannot be resolved when a process reads the variable: the job is not activated and raises an incident instead. See [when a job is not activated](https://docs.camunda.io/docs/next/components/concepts/secret-resolution-and-job-activation#understand-why-a-job-is-not-activated).

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/cluster-variable/data-types
