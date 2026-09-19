# Intermediate tutorial — Create and start a process instance (POST)

To create and start a process instance based on the process instance key obtained in the request above, take the following steps:

1. Outline your function, similar to the steps above:

```javascript
async function createInstance([processDefinitionKey]) {
  const accessToken = await getAccessToken(authorizationConfiguration);
  const camundaApiUrl = process.env.CAMUNDA_REST_ADDRESS;
  const url = `${camundaApiUrl}/process-instances`;
}
```

2. Build the payload you will send to the endpoint:

```javascript
const payload = {
  processDefinitionKey,
  variables: {
    total: 90.0,
  },
};
```

**Note**
The request will succeed if the variable names are different, but the process instance itself will not function as expected.

3. Call the endpoint, process the results from the API call, and emit an error message from the server if necessary:

```javascript
try {
  const response = await axios.post(url, payload, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const processInstance = response.data;

  console.log(`Process Instance Key: ${processInstance.processInstanceKey}`);
} catch (error) {
  console.error(`Error creating process instance: ${error.message}`);
}
```

4. In your terminal, run `node cli.js processInstances create <key>`, where `<key>` is the process definition key. The `processInstanceKey` will now display in the output. Capture this key for a future method.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/intermediate-tutorial
