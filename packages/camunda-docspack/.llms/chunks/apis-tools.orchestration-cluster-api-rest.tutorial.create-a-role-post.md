# Beginner tutorial — Create a role (POST)

1. Outline your function:

```javascript
async function createRole([roleName]) {
  const accessToken = await getAccessToken(authorizationConfiguration);
  const camundaApiUrl = process.env.CAMUNDA_REST_ADDRESS;
  const url = `${camundaApiUrl}/roles`;
}
```

2. Configure the API call:

```javascript
const options = {
  method: "POST",
  url,
  headers: {
    Accept: "application/json",
    Authorization: `Bearer ${accessToken}`,
  },
  data: {
    name: roleName,
  },
};
```

3. Process the results:

```javascript
try {
  const response = await axios(options);
  const newRole = response.data;
  console.log(`Role added! Name: ${roleName}. Key: ${newRole.roleKey}.`);
} catch (error) {
  console.error(error.message);
}
```

4. Run in your terminal `node cli.js camunda8 create <name>`.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/tutorial
