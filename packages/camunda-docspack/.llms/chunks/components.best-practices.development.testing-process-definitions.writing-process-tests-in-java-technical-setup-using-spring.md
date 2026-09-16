# Testing process definitions — Writing process tests in Java — Technical setup using Spring

**Caution**

- Camunda Process Test was introduced with **Camunda 8.8**.
- You must use **JUnit 5** in every test class. The `@Test` annotation you import must be `org.junit.jupiter.api.Test`.

1. Use [_JUnit 5_](http://junit.org) as your unit test framework.
2. Use the [Camunda Spring Boot Starter](https://docs.camunda.io/docs/next/apis-tools/camunda-spring-boot-starter/getting-started).
3. Use `@CamundaSpringProcessTest` to start a process engine.
4. Ensure you have Docker installed locally to use [TestContainers](https://docs.camunda.io/docs/next/apis-tools/testing/getting-started#prerequisites), which is the easiest way to run tests.
5. Use assertions from [Camunda Process Test](https://docs.camunda.io/docs/next/apis-tools/testing/assertions) to verify that your expectations about the process state are met.
6. Use a mocking framework of your choice (such as [Mockito](http://mockito.org)) to mock service methods and verify that services are called as expected.
7. Use utilities from [Camunda Process Test](https://docs.camunda.io/docs/next/apis-tools/testing/utilities) to mock job workers you don't want to run (for example, connectors).

The following code shows an example test:

```java
@SpringBootTest(
    properties = {
      "camunda.client.worker.defaults.enabled=false", // disable job workers and enable them selectively
      "camunda.client.worker.override.archive-invoice.enabled=true",
    })
@CamundaSpringProcessTest
public class InvoiceApprovalTest {

  @Autowired
  private CamundaClient client;
  @Autowired
  private CamundaProcessTestContext processTestContext;
  @Autowired
  private ObjectMapper objectMapper;

  // Mock services that are called from the job workers
  @MockitoBean
  private ArchiveService archiveService;
  @MockitoBean
  private AccountingService accountingService;

  // Sample data used
  private final String invoiceJson =
      """
      {
        "id": "INV-1001",
        "amount": 12000,
        "currency": "EUR",
        "supplier": {
          "id": "0815",
          "name": "Acme GmbH"
        },
        "contactEmail": "accounting@acme.com"
      }""";

  @Test
  public void happyPath() throws Exception {
    final HashMap<String, Object> variables = new HashMap<String, Object>();
    variables.put("approver", "Zee");
    variables.put("invoice", objectMapper.readTree(invoiceJson));

    // After all preparations, start the process instance
    final var processInstance =
        client
            .newCreateInstanceCommand()
            .bpmnProcessId("Process_InvoiceApproval")
            .latestVersion()
            .variables(variables)
            .send()
            .join();

    // assert the User Task was created
    assertThat(byElementId("UserTask_ApproveInvoice")).isCreated().hasAssignee("Zee");
    // and simulate the user completing it
    processTestContext.completeUserTask(byElementId("UserTask_ApproveInvoice"),
        Map.of("approved", true));

    // This should make the process instance execute to completion
    assertThat(processInstance)
        .hasCompletedElementsInOrder(
            byId("StartEvent_InvoiceReceived"),
            byId("UserTask_ApproveInvoice"),
            byId("ServiceTask_ArchiveInvoice"),
            byId("ServiceTask_AddInvoiceAccounting"),
            byId("EndEvent_InvoiceApproved"))
        .isCompleted();

    // verify that side effects have happened
    Mockito.verify(archiveService).archiveInvoice("INV-1001", objectMapper.readTree(invoiceJson));
    Mockito.verify(accountingService).addInvoiceToAccount("0815", "INV-1001");
  }
```

**Note**
The complete source code for this example test is available on [GitHub](https://github.com/camunda/camunda/tree/main/testing/camunda-process-test-example/src/test/java/io/camunda/InvoiceApprovalTest.java).

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/testing-process-definitions
