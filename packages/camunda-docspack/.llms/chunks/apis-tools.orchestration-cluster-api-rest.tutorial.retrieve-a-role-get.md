# Beginner tutorial — Retrieve a role (GET)

1. Outline your function:

```javascript
async function getRole([roleKey]) {
  const accessToken = await getAccessToken(authorizationConfiguration);
  const camundaApiUrl = process.env.CAMUNDA_REST_ADDRESS;
  const url = `${camundaApiUrl}/roles/${roleKey}`;
}
```

2. Configure the API call.

```javascript
const options = {
  method: "GET",
  url,
  headers: {
    Accept: "application/json",
    Authorization: `Bearer ${accessToken}`,
  },
};
```

3. Process the results:

```javascript
try {
  const response = await axios(options);
  const results = response.data;
  console.log(`Role Name: ${results.name}; Key: ${results.key};`);
} catch (error) {
  console.error(error.message);
}
```

4. Run in your terminal `node cli.js camunda8 view <role>`.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/tutorial
