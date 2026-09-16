# Testing process definitions — Writing polyglot process tests

TODO

* How to provision / cleanup engine (API to create cluster)
* Use the API / Language client to drive your process
* No assertions available at the moment (probably use history API?)
* Assert side effects / workers

* Example in Node.js?
-->


## Integration tests

Test the process in a close-to-real-life environment. This verifies that it really works before releasing a new version of your process definition, which includes _human-driven_, _exploratory_ tests.

Clearly _define your goals_ for integration tests! Goals could be:

- End user & acceptance tests
- Complete end-to-end tests
- Performance & load tests, etc.

Carefully consider _automating_ tests on scope 3. You need to look at the overall effort spent on writing test automation code and maintaining it when compared with executing human-driven tests for your software project's lifespan. The best choice depends very much on the frequency of regression test runs.

Most effort is typically invested in setting up proper test data in surrounding systems.

Configure your tests to be dedicated integration tests, and separate them from unit or process tests.

You can use typical industry standard tools for integration testing together with Camunda.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/testing-process-definitions
