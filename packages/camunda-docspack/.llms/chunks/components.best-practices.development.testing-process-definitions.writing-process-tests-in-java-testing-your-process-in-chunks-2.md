# Testing process definitions — Writing process tests in Java — Testing your process in chunks (2)

**(4)**

An approved invoice can't get archived:

```java
@Test
public void testArchiveSystemError() throws Exception {
    final HashMap<String, Object> variables = new HashMap<String, Object>();
    variables.put("approver", "Zee");
    variables.put("invoice", objectMapper.readTree(invoiceJson));

    doThrow(new WiredLegacyException()).when(archiveService).archiveInvoice(anyString(), any());

    final var processInstance =
        client
            .newCreateInstanceCommand()
            .bpmnProcessId("Process_InvoiceApproval")
            .latestVersion()
            .variables(variables)
            .send()
            .join();

    // approve the request
    assertThat(byElementId("UserTask_ApproveInvoice")).isCreated();
    processTestContext.completeUserTask(byElementId("UserTask_ApproveInvoice"),
      Map.of("approved", true));

    // This should lead to the exception being thrown, causing the process to end up in the user task designed to handle the problem.
    assertThat(byElementId("UserTask_ManuallyArchiveInvoice"))
        .isCreated();
        // The test for .hasCandidateGroup("archive-team") is probably not worth implementing
        // as it limits flexibility in model changes.
    processTestContext.completeUserTask(byElementId("UserTask_ManuallyArchiveInvoice"));

    assertThat(processInstance)
        .isCompleted()
        .hasCompletedElementsInOrder(
            byId("StartEvent_InvoiceReceived"),
            byId("UserTask_ApproveInvoice"),
            byId("UserTask_ManuallyArchiveInvoice"),
            byId("ServiceTask_AddInvoiceAccounting"),
            byId("EndEvent_InvoiceApproved"))
        .hasTerminatedElements(byId("ServiceTask_ArchiveInvoice"));
    verify(accountingService).addInvoiceToAccount("0815", "INV-1001");
  }
```

<!--

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/testing-process-definitions
