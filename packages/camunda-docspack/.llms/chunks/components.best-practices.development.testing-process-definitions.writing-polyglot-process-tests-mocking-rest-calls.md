# Testing process definitions — Writing polyglot process tests — Mocking REST calls

Especially when using the Connector framework, there might be relevant logic to test in configuration of a connector, especially the input and output data mapping. To test those, you typically want to mock the endpoint, rather than the job worker.

In the invoice approval example, the `Send invoice rejection` task leverages an outbound REST connector. The service task might look like this in the BPMN XML:

```xml
<bpmn:serviceTask id="ServiceTask_SendRejection" name="Send invoice rejection" zeebe:modelerTemplate="io.camunda.connectors.HttpJson.v2">
  <bpmn:extensionElements>
    <zeebe:taskDefinition type="io.camunda:http-json:1" retries="3" />
    <zeebe:ioMapping>
      <zeebe:input target="method" source="POST" />
      <zeebe:input target="url"    source="{{secrets.INVOICE_REJECTION_URL}}/reject" />
      <zeebe:input target="body"   source="={ &#10;  &#34;invoiceId&#34; : invoice.id, &#10;  &#34;rejectionReason&#34;: rejectionReason&#10;}" />
      <!--. .. -->
  </bpmn:extensionElements>
</bpmn:serviceTask>
```

You can mock the REST endpoint using the Spring Boot integration of [WireMock](http://wiremock.org/), allowing you to stub the endpoint in your JUnit test and make it accessible to the TestContainers runtime.

1. Add the required [WireMock Spring Boot](https://wiremock.org/docs/spring-boot/) dependency to your project (`org.wiremock.integrations:wiremock-spring-boot`).
2. Add the annotation `@EnableWireMock` to your test class to start the WireMock server.
3. Use the secrets in Camunda to configure the endpoint of the REST call, which is best practice anyway to configure the URL in the environment. In the test you need to set it to the URL containing of the hostname `host.testcontainers.internal` and the WireMock server port.
4. Make sure the connector runtime is enabled in the test case, so that the out-of-the-box REST connector is executed.
5. Expose the WireMock server port to the TestContainers runtime before running the test case.

Here is the relevant source code:

```java
import static com.github.tomakehurst.wiremock.client.WireMock.*;

@EnableWireMock
@SpringBootTest(
    properties = {
        "camunda.client.worker.defaults.enabled=false",
        "camunda.process-test.connectors-enabled=true",
        "camunda.process-test.connectors-secrets.INVOICE_REJECTION_URL="
            + "http://host.testcontainers.internal:${wiremock.server.port}"
    })
@CamundaSpringProcessTest
public class InvoiceApprovalIntegrationTest {

  @Value("${wiremock.server.port}")
  private int wireMockPort;

  @BeforeEach
  void setup() {
    Testcontainers.exposeHostPorts(wireMockPort);
  }

  @Test
  public void testRejectionPath() throws Exception {
    // configure mock behavior
    stubFor(post("/reject").willReturn(aResponse().withStatus(200).withBody("ok")));

    // Now drive the test case as in a unit test shown above ...

    // Verify the mock was called
    verify(
        postRequestedFor(urlEqualTo("/reject"))
            .withRequestBody(
                equalToJson(
                    """
                    {
                      "invoiceId": "INV-1001",
                      "rejectionReason": "it is a test case :-)"
                    }""")));
  }
```

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/testing-process-definitions
