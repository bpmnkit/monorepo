# Beginner tutorial — List all roles (POST)

First, let's script an API call to list all existing roles.

To do this, take the following steps:

1. In the file named `camunda-8.js`, outline the authentication configuration in the first few lines. This will pull in your `.env` variables to obtain an access token before making any API calls:

```javascript
const authorizationConfiguration = {
  clientId: process.env.CAMUNDA_CLIENT_ID,
  clientSecret: process.env.CAMUNDA_CLIENT_SECRET,
  audience: process.env.CAMUNDA_TOKEN_AUDIENCE,
};
```

2. Examine the function `async function listRoles()` below this configuration. This is where you will script out your API call.

3. Within the function, you must first generate an access token for this request, so your function should now look like the following:

```javascript
async function listRoles() {
  const accessToken = await getAccessToken(authorizationConfiguration);
}
```

4. Using your generated client credentials from [prerequisites](#prerequisites), capture your Orchestration Cluster REST API URL beneath your call for an access token by defining `camundaApiUrl`:

```javascript
const camundaApiUrl = process.env.CAMUNDA_REST_ADDRESS;
```

On the next line, script the API endpoint to list the existing roles:

```javascript
const url = `${camundaApiUrl}/roles/search`;
```

5. Configure your POST request to the appropriate endpoint, including an authorization header based on the previously acquired `accessToken`:

```javascript
const options = {
  method: "POST",
  url,
  headers: {
    Accept: "application/json",
    Authorization: `Bearer ${accessToken}`,
  },
  data: {},
};
```

6. Call the endpoint, process the results from the API call, and emit an error message from the server if necessary:

```javascript
try {
  const response = await axios(options);
  const results = response.data;
  results.items.forEach((x) =>
    console.log(`Role Name: ${x.name}; key: ${x.key}`)
  );
} catch (error) {
  console.error(error.message);
}
```

7. In your terminal, run `node cli.js camunda8 list`.

**Note**
This `list` command is connected to the `listRoles` function at the bottom of the `camunda-8.js` file, and executed by the `cli.js` file. While we will work with roles in this tutorial, you may add additional arguments depending on the API calls you would like to make.

The existing roles (if any) will now output. If you have an invalid API name or action name, or no arguments provided, or improper/insufficient credentials configured, an error message will output as outlined in the `cli.js` file. If no action is provided, it will default to "assign" everywhere, except when unassigning a user.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/tutorial
