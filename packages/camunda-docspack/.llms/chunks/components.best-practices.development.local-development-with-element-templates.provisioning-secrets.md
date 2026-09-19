# Local development with element templates and Camunda 8 Run — Provisioning secrets

If your element templates use secrets, you must provide these values to the connector runtime.

Add secrets to the `connector-secrets.txt` file in the root directory of your Camunda 8 Run setup. Use the following format, with one secret per line:

```
NAME=VALUE
```

These secrets will then be available in the connector runtime using the format `secrets.NAME`.

For example:

```
MY_TOKEN=value
AWS_KEY=keyValue
...
```

In this case, the `MY_TOKEN` secret can be referenced as `secrets.MY_TOKEN`.

This applies when custom connectors are deployed as part of the Camunda 8 Run Docker Compose setup.
If you choose to run connectors differently, as described in the [custom connector hosting guide](https://docs.camunda.io/docs/next/components/connectors/custom-built-connectors/host-custom-connector#wiring-your-connector-with-a-camunda-cluster), configure secrets as environment variables instead.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/local-development-with-element-templates
