# Intermediate tutorial — Deploy resources (POST)

First, let's script an API call to deploy a resource.

To do this, take the following steps:

1. In the file named `camunda-process-instances.js`, outline the authentication and authorization configuration in the first few lines. This will pull in your `.env` variables to obtain an access token before making any API calls:

```javascript
const authorizationConfiguration = {
  clientId: process.env.CAMUNDA_CLIENT_ID,
  clientSecret: process.env.CAMUNDA_CLIENT_SECRET,
  // These settings come from your .env file. Note that CAMUNDA_TOKEN_AUDIENCE is represented by ZEEBE_TOKEN_AUDIENCE in the Console UI.
  audience: process.env.CAMUNDA_TOKEN_AUDIENCE,
};
```

2. Examine the function `async function deployResources()` below this configuration. This is where you will script out your API call.
3. Within the function, you must first generate an access token for this request, so your function should now look like the following:

```javascript
async function deployResources() {
  const accessToken = await getAccessToken(authorizationConfiguration);
}
```

4. Using your generated client credentials from [prerequisites](#prerequisites), capture your Orchestration Cluster REST API URL beneath your call for an access token by defining `camundaApiUrl`:

```javascript
const camundaApiUrl = process.env.CAMUNDA_REST_ADDRESS;
```

5. On the next line, script the API endpoint to deploy the resources:

```javascript
const url = `${camundaApiUrl}/deployments`;
```

6. We will now configure the variables representing the BPMN file and its form data. This may look different depending on which resources you choose to deploy, but reflects the block-scoped local variables and append method to insert a set of objects for the BPMN resource of this tutorial:

```javascript
const formData = new FormData();
// Read the BPMN file and add it to the form data
const bpmnFilePath = path.resolve("resources/calculate-sales-tax.bpmn");
const fileContent = fs.readFileSync(bpmnFilePath);
formData.append("resources", fileContent, {
  filename: "calculate-sales-tax.bpmn",
  contentType: "application/xml",
});
```

**Note**
The `resources` name must be exact according to the API requirements, the path to the file (`const bpmnFilePath = path.resolve("resources/calculate-sales-tax.bpmn");`) must be correct, and `contentType` must be `application/xml` to ensure the upload will not fail.

7. Call the endpoint, process the results from the API call, and emit an error message from the server if necessary:

```javascript
try {
  const response = await axios.post(url, formData, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...formData.getHeaders(),
    },
  });

  const deployedResources = response.data.deployments || [];

  // Emit deployed resources
  deployedResources.forEach((x) =>
    console.log(
      `Process Definition Key: ${x.processDefinition.processDefinitionKey}; Process Definition Id: ${x.processDefinition.processDefinitionId}`
    )
  );
} catch (error) {
  // Emit an error from the server.
  console.error(`Error deploying resources: ${error.message}`);
}
```

8. In your terminal, run `node cli.js processInstances deploy`.

**Note**
This `deploy` command is connected to the `deployResources` function at the bottom of the `camunda-process-instances.js` file, and executed by the `cli.js` file. While we will work with process instances in this tutorial, you may add additional arguments depending on the API requests you want to make.

The existing process definition key and ID will now output. If you have an invalid API name or action name, or no arguments provided, or improper/insufficient credentials configured, an error message will output as outlined in the `cli.js` file.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/intermediate-tutorial
