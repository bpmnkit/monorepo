# Beginner tutorial — Delete a role (DELETE)

1. Outline your function:

```javascript
async function deleteRole([roleKey]) {
  const accessToken = await getAccessToken(authorizationConfiguration);
  const camundaApiUrl = process.env.CAMUNDA_REST_ADDRESS;
  const url = `${camundaApiUrl}/roles/${roleKey}`;
}
```

2. Configure the API call:

```javascript
const options = {
  method: "DELETE",
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
  if (response.status === 204) {
    console.log("Role deleted!");
  } else {
    console.error("Unable to delete this role!");
  }
} catch (error) {
  console.error(error.message);
}
```

4. Run in your terminal `node cli.js camunda8 delete <role>`.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/tutorial
