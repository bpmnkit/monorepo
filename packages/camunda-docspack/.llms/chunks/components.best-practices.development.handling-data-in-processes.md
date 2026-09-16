# Handling data in processes

When using Camunda, you have access to a dynamic map of process variables, which lets you associate data to every single process instance.

When using Camunda, you have access to a dynamic map of process variables, which lets you associate data to every single process instance (and local scopes in case of user tasks or parallel flows). Ensure you use these mechanisms in a lightweight and meaningful manner, storing just the relevant data in the process instance.

Depending on your programming language, consider accessing your process variables in a type safe way, centralizing (simple and complex) type conversion and using constants for process variable names.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/handling-data-in-processes
