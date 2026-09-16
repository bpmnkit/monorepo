# Namespace collisions

Understand namespace collisions in cluster variables, how scope priority affects variable resolution, and how to safely handle overrides to avoid unexpected behavior.

Understand namespace collisions in cluster variables, how scope priority affects variable resolution, and how to safely handle overrides to avoid unexpected behavior.


## About

Namespace collisions occur when the same variable key is defined differently across scopes (process, tenant, global). While scope priority determines which value is used, mismatched data types or structures can cause unexpected results.

This guide explains common collision types, shows real examples, and shares best practices to prevent or intentionally manage overrides.

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/cluster-variable/namespace-collisions
