# Testing process definitions — Writing process tests in Java — Testing your process in chunks

Divide and conquer by _testing your process in chunks_. Consider the important chunks and paths the invoice approval process consists of:

Diagram (BPMN):
  start "Invoice received" → user task "Approve invoice" → exclusive gateway "Approved?"
    — [yes] service task "Archive invoice" → service task "Add invoice to accounting system" → end "Invoice approved"
    — [no] service task "Send invoice rejection" → end "Invoice rejected"

**(1)**

The _happy path_: The invoice gets approved.

**(2)**

The invoice gets rejected.

**(3)**

A timeout on waiting for approval leads to an automatic approval.

**(4)**

An approved invoice can't get archived.

#### Testing the happy path

The happy path is kind of the default scenario with a positive outcome, so no exceptions or errors or deviations are experienced.

Fully test the happy path in one (big) test method. This makes sure you have one consistent data flow in your process. Additionally, it is easy to read and to understand, making it a great starting point for new developers to understand your process and process test case.

You were already exposed to the happy path in our example, which is the scenario that the invoice gets approved:

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

#### Testing detours

Test _forks/detours_ from the happy path as well as _errors/exceptional_ paths as chunks in separate test methods. This allows to unit test in meaningful units.

The tests for the exceptional paths are basically very similar to the happy path in our example.

**(2)**

The invoice gets rejected:

```java
@Test
public void testRejectionPath() throws Exception {
    final HashMap<String, Object> variables = new HashMap<String, Object>();
    variables.put("approver", "Zee");
    variables.put("invoice", objectMapper.readTree(invoiceJson));

    // We skip HTTP for the simple unit test - mock the http connector
    processTestContext.mockJobWorker("io.camunda:http-json:1").thenComplete();

    // Kick of the process instance
    final var processInstance =
        client
            .newCreateInstanceCommand()
            .bpmnProcessId("Process_InvoiceApproval")
            .latestVersion()
            .variables(variables)
            .send()
            .join();

    // assert the User Task and simulate a human decision
    assertThat(byElementId("UserTask_ApproveInvoice")).isCreated().hasAssignee("Zee");
    processTestContext.completeUserTask(
        byElementId("UserTask_ApproveInvoice"),
        Map.of( //
            "approved",
            false, //
            "rejectionReason",
            "it is a test case :-)"));

    // This should make the process instance execute till the end
    assertThat(processInstance)
        .hasCompletedElementsInOrder(
            byId("StartEvent_InvoiceReceived"),
            byId("UserTask_ApproveInvoice"),
            byId("Gateway_Approved"),
            byId("ServiceTask_SendRejection"),
            byId("EndEvent_InvoiceRejected"))
        .isCompleted();
  }
```

**(3)**

A timeout on waiting for approval leads to an automatic approval:

```java
@Test
public void testApprovalTimeout() throws Exception {
    final HashMap<String, Object> variables = new HashMap<String, Object>();
    variables.put("approver", "Zee");
    variables.put("invoice", objectMapper.readTree(invoiceJson));

    final var processInstance =
        client
            .newCreateInstanceCommand()
            .bpmnProcessId("Process_InvoiceApproval")
            .latestVersion()
            .variables(variables)
            .send()
            .join();

    // assert the User Task and simulate the timeout
    assertThat(processInstance).hasActiveElements("UserTask_ApproveInvoice");
    processTestContext.increaseTime(Duration.ofDays(5));

    // This should make the process instance auto approve and run till the end
    assertThat(processInstance)
        .isCompleted()
        .hasCompletedElementsInOrder(
            byId("StartEvent_InvoiceReceived"),
            byId("ServiceTask_ArchiveInvoice"),
            byId("ServiceTask_AddInvoiceAccounting"),
            byId("EndEvent_InvoiceApproved"))
        .hasTerminatedElements(byId("UserTask_ApproveInvoice"));
  }
```

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/testing-process-definitions
