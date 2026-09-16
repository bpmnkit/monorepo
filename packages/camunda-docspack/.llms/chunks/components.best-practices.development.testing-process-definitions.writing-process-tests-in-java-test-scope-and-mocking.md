# Testing process definitions — Writing process tests in Java — Test scope and mocking

In a test case like this, you want to test the executable BPMN process definition, plus all the glue code that logically belongs to the process definition in a broader sense. Typical examples of glue code you want to include in a process test are:

- Worker code, typically connected to a service task
- Expressions (FEEL) used in your process model for gateway decisions or input/output mappings
- Other glue code, for example, your own Client API (probably exposed via REST) that performs data mapping before calling the Camunda Client.

The following illustration shows this for the invoice approval example:

![Process test scope example](testing-process-definitions-assets/process-test-scope-example.png)

Workflow engine-independent business code should _not_ be included in the tests. In the invoice approval example, the `ArchiveService` will be mocked, and the `ArchiveInvoiceWorker` will read and transform process variables and call this mock. This way, you can test the process model, the glue code, and the data flow in your process test without calling out to the real archive system.

The following code examples highlight the important aspects around mocking.

The `ArchiveInvoiceWorker` is executed as part of the test. It does input data mapping **(1)** and also translates a specific business exception into a BPMN error **(2)**:

```java
@Component
public class ArchiveInvoiceWorker {

  private final ArchiveService service;
  public ArchiveInvoiceWorker(final ArchiveService service) {
    this.service = service;
  }

  @JobWorker(type = "archive-invoice")
  public void handleJob(
      @Variable("invoiceId") final String invoiceId, // <1>
      @Variable("invoice") final JsonNode invoiceJson) {
    try {
      service.archiveInvoice(invoiceId, invoiceJson);
    } catch (WiredLegacyException e) { // <2>
      throw new BpmnError(
          "LEGACY_ERROR_ARCHIVE", "The archive system had a problem: " + e.getMessage());
    }
  }
}
```

The `ArchiveService` is considered a business service (it could, for example, wrap the archive system client SDK to make the appropriate remote calls) and should _not_ be executed during the test. This is why this interface is mocked in the test case:

```java
@MockitoBean
private ArchiveService archiveService;

@Test
public void happyPath() throws Exception {
  // ...
  // Using Mockito you can verify a business method was called with the expected parameters
  Mockito.verify(archiveService).archiveInvoice("INV-1001", objectMapper.readTree(invoiceJson));
}

@Test
void testArchiveSystemError() throws Exception {
  // Using Mockito you can define what should happen when a method is called, in this case an exception is thrown to simulate a business error
  doThrow(new WiredLegacyException()).when(archiveService).archiveInvoice(anyString(), any());
  //...
}
```

Some workers might not delegate to a proper service class, which you can easily mock. The prime example is connectors. The invoice process uses the REST connector to trigger the invoice rejection via some REST API. To avoid calling the REST endpoint, you can mock the job worker that would be provided by the connector runtime:

```java
@Test
public void testRejectionPath() throws Exception {
  processTestContext.mockJobWorker("io.camunda:http-json:1").thenComplete();
  // ...
}
```

You could also mock the REST endpoint, which we touch on later discussing integration tests. Some projects consider REST mocking part of the unit test scope, and this is generally also fine, even if we see it as integration test scope by default.

You can use the same [utilities from Camunda Process Test](https://docs.camunda.io/docs/next/apis-tools/testing/utilities) to mock other workers, where you simply do not want to run the job worker itself. Maybe the implementation is not clean, but beyond your control. However, we advise to use a proper service interface whenever possible instead of job worker mocking.

```java
// Define the mock
final JobWorkerMock addInvoiceJobWorkerMock =
    processTestContext
        .mockJobWorker("add-invoice-to-accounting")
        .withHandler(
            (jobClient, job) -> {
                jobClient
                    .newCompleteCommand(job)
                    // .variables(null) //  We could now also simulate setting some response values
                    .send()
                    .join();
            });

// ... drive the process ...

// and assert:
assertThat(addInvoiceJobWorkerMock.getInvocations())
    .as("add-invoice-to-accounting job worker called")
    .isEqualTo(1);

assertThat(addInvoiceJobWorkerMock.getActivatedJobs().get(0).getVariablesAsMap())
    .containsEntry("invoiceId", "INV-1001");
```

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/testing-process-definitions
