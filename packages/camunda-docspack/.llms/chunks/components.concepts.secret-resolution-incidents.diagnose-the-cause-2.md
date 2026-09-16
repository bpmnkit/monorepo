# Troubleshoot secret resolution failures — Diagnose the cause (2)

- **Secret name**: Confirm the reference name exactly matches the secret name in the store, including case. Store-managed names that the Camunda secret endpoints reject, such as names containing a period, can still resolve when you escape them with backticks in an input mapping expression.

  Escaping applies only to expressions. Camunda scans references in [cluster variable](https://docs.camunda.io/docs/next/components/admin/cluster-variables) values as plain text rather than parsing them as FEEL. In this case, the name after the prefix must match `[\p{Alnum}_-]+` and cannot be escaped. A period, space, or other unsupported character prevents Camunda from detecting the reference.

- **Reference format**: Confirm the reference is a FEEL expression rather than a static string. In an input mapping source or Connector property, use a path such as `=camunda.secrets.TOKEN`. Static values and quoted references such as `={"auth": "camunda.secrets.TOKEN"}` are rejected at deployment.

- **Value size**: Confirm the resolved value and other job variables fit within `camunda.cluster.network.max-message-size`.

The `SECRET` resource type in [authorizations](https://docs.camunda.io/docs/next/components/concepts/access-control/authorizations) applies to the secrets API, not broker-side secret resolution. Missing Camunda authorizations don't cause `SECRET_RESOLUTION_ERROR` incidents.

---
Source: https://docs.camunda.io/docs/next/components/concepts/secret-resolution-incidents
