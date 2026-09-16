# Mapping rules — How to use mapping rules

**Info**
To use mapping rules, you must be familiar with the structure of the JWT access tokens that your OIDC provider issues to clients.

A mapping rule has the following properties:

- Claim name: The name of a (nested) claim or a [JSONPath expression](https://www.rfc-editor.org/rfc/rfc9535).
- Claim value: The expected value of the claim. The mapping rule takes effect only if this value is present in a JWT access token.

Using a mapping rule is a two-step process:

1. _Create the mapping rule_ – Define how Camunda identifies a match between a JWT claim and the rule.
2. _Assign the mapping rule_ – Apply it to a group, role, authorization, or tenant.

Assume the following payload of an access token issued by your Identity Provider (IdP):

```json
{
  "sub": "1234567890",
  "name": "John Doe",
  "isAdmin": true,
  "orggroups": ["acct", "finance"],
  "iat": 1516239022
}
```

To make any user a member of the `admin` role when their `isAdmin` claim is set to `true`, first define a mapping rule as follows:

- Claim name: `isAdmin`
- Claim value: `true`

Then, assign the mapping rule to the `admin` role.

To make any member of the organizational group `acct` a member of the Orchestration Cluster group `accounting`, define a mapping rule as follows:

- Claim name: `orggroups`
- Claim value: `acct`

Then, assign the mapping rule to the `accounting` group.

**Note**
In this case, the mapping rule matches against an array of objects. Depending on the JWT structure, a claim value is matched using `equals` or `in` semantics.

---
Source: https://docs.camunda.io/docs/next/components/concepts/access-control/mapping-rules
