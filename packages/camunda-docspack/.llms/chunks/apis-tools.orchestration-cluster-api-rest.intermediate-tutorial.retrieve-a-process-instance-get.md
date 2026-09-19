# Intermediate tutorial — Retrieve a process instance (GET)

To retrieve a process instance by the process instance key, take the following steps:

1. Outline your function, similar to the steps above:

```javascript
async function viewInstance([processInstanceKey]) {
  const accessToken = await getAccessToken(authorizationConfiguration);
  const camundaApiUrl = process.env.CAMUNDA_REST_ADDRESS;
  const url = `${camundaApiUrl}/process-instances/${processInstanceKey}`;
}
```

2. Call the endpoint, process the results from the API call, and emit an error message from the server if necessary:

```javascript
try {
  const response = await axios.get(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const results = response.data;

  console.log(
    `Process instance name: ${results.processDefinitionName}; State: ${results.state};`
  );
} catch (error) {
  console.error(`Error retrieving process instance: ${error.message}`);
}
```

3. In your terminal, run `node cli.js processInstances view <key>`, where `<key>` is the process instance key. The `processDefinitionName` and `state` will then display in the output.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/intermediate-tutorial
