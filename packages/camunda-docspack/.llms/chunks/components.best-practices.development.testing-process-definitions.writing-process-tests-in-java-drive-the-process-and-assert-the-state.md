# Testing process definitions — Writing process tests in Java — Drive the process and assert the state

For tests, you drive the process from wait state to wait state and assert that you observe the expected process and variable states. For example, you might implement a test for the scenario when an invoice gets approved and processed without errors:

```java
@Test
public void happyPath() throws Exception {
    final HashMap<String, Object> variables = new HashMap<String, Object>();
    variables.put("approver", "Zee");
    variables.put("invoice", objectMapper.readTree(invoiceJson));

    // Kick off the process instance // <1>
    final var processInstance =
        client
            .newCreateInstanceCommand()
            .bpmnProcessId("Process_InvoiceApproval")
            .latestVersion()
            .variables(variables)
            .send()
            .join();

    // assert the User Task and simulate a human decision // <2>
    assertThat(byElementId("UserTask_ApproveInvoice")).isCreated().hasAssignee("Zee");
    processTestContext.completeUserTask(
        byElementId("UserTask_ApproveInvoice"), Map.of("approved", true));

    // This should make the process instance execute till the end // <3>
    assertThat(processInstance)
        .hasCompletedElementsInOrder(
            byId("StartEvent_InvoiceReceived"),
            byId("UserTask_ApproveInvoice"),
            byId("ServiceTask_ArchiveInvoice"),
            byId("ServiceTask_AddInvoiceAccounting"),
            byId("EndEvent_InvoiceApproved"))
        .isCompleted();

    // verify that side effects have happened // <4>
    verify(archiveService).archiveInvoice("INV-1001", objectMapper.readTree(invoiceJson));
    verify(accountingService).addInvoiceToAccount("0815", "INV-1001");
  }
```

1. Create a new process instance. You may want to use some glue code to start your process (e.g. the REST API facade), or also create helper methods within your test class.

2. Drive the process through its wait states, e.g. by completing a waiting user task.

3. Assert that your process is in the expected state.

4. Verify with your mocking library that your business service methods were called as expected.

Be careful not to "overspecify" your test method by asserting too much. Your process definition will likely evolve in the future and such changes should break as little test code as possible, but just as much as necessary!

As a rule of thumb _always_ assert that the expected _external effects_ of your process really took place (e.g. that business services were called as expected). Additionally, carefully choose which aspects of _internal process state_ are important enough so that you want your test method to warn about any related change later on.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/testing-process-definitions
