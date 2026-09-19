# How to use cluster variables

Learn how to use and access cluster variables, from simple to advanced patterns.

Learn how to use and access cluster variables, from simple to advanced patterns.


## Use in BPMN

### Service task input mapping

Map cluster variables to service task inputs.
For example:

```
= camunda.vars.env.API_ENDPOINT
```

For the target variable:

```
apiUrl
```

### Gateway conditions

Use cluster variables in conditional sequence flows.
For example:

```
orderAmount > camunda.vars.env.APPROVAL_THRESHOLD
camunda.vars.env.FEATURE_EXPRESS_SHIPPING = true
```

### Script tasks

Reference cluster variables in script expressions.
For example:

```
var endpoint = camunda.vars.env.API_CONFIG.base_url;
var timeout = camunda.vars.env.API_CONFIG.timeout_ms;
```

### Output mappings

Use cluster variables in output parameter expressions.
For example:

```
= {
  "endpoint": camunda.vars.env.SERVICE_URL,
  "timestamp": now(),
  "threshold": camunda.vars.env.PROCESSING_THRESHOLD
}
```

### Call activities

Pass cluster variables as input to called processes.
For example:

```
= {
  "config": camunda.vars.env.SUBPROCESS_CONFIG,
  "flags": camunda.vars.env.FEATURE_FLAGS
}
```

### Combining multiple variables

Create expressions using multiple cluster variables.
For example:

```
camunda.vars.env.API_BASE_URL + "/api/v" + camunda.vars.env.API_VERSION + "/resource"
```

### Resolve secret references in a cluster variable

[Orchestration Cluster secret references](https://docs.camunda.io/docs/next/reference/glossary#secret-reference-orchestration-cluster) in a [`SECRET_REFERENCE`-kind](https://docs.camunda.io/docs/next/components/modeler/feel/cluster-variable/data-types#variable-kinds) cluster variable are resolved only when the variable is read by an input mapping on an element that creates a job for a job worker, such as a service task or an ad hoc sub-process. In the other contexts on this page, including gateway conditions, script tasks, output mappings, and call activity input, the variable resolves to its stored value, so the reference text reaches your process unchanged.

The following rules apply to an input mapping that reads a `SECRET_REFERENCE`-kind variable:

- The mapping source must be a FEEL expression. A static value, written without a leading `=`, is a plain string and holds no references.
- A trailing field path narrows what is resolved. `= camunda.vars.env.MY_VAR.a.b` resolves only the references stored inside the `a.b` part of the value.
- If the variable does not exist, or if its kind is `JSON`, nothing is resolved and no incident is raised.
- Execution listener and task listener jobs never carry resolved values, even when the element they run on has such an input mapping.

The reference is recorded on the job at creation, in the same way as a reference written directly into an input mapping, and resolved in the background ahead of activation. The resolved value reaches the worker only once the job is handed out. For what this means for when a job reaches a worker, see [secret resolution and job activation](https://docs.camunda.io/docs/next/components/concepts/secret-resolution-and-job-activation).

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/cluster-variable/usage-guide
