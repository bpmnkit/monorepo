# Testing process definitions — Testing scopes

There are three typical test scopes used when building process solutions:

1. **Unit tests**: Testing glue code or programming code you developed for your process solution. How to unit test your software itself is not discussed here, as this is a common practice for software development.

2. **Process tests**: Testing the expected behavior of the process model, including glue code and specifically the data flowing through the process model. These tests should run frequently, so they should behave like unit tests (quick turnaround, no need for external resources).

3. **Integration tests**: Testing the system in a close-to-production environment to ensure it works correctly. This is typically done before releasing a new version of your system. These tests include _human-driven_, _exploratory_ tests.

![Scopes](testing-process-definitions-assets/scopes.png)

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/testing-process-definitions
