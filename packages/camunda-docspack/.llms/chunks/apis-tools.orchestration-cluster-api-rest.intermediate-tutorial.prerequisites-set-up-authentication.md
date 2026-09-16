# Intermediate tutorial — Prerequisites — Set up authentication

If you're interested in how we use a library to handle auth for our code, or to get started, examine the `auth.js` file in the GitHub repository. This file contains a function named `getAccessToken` which executes an OAuth 2.0 protocol to retrieve authentication credentials based on your client ID and client secret. Then, we return the actual token that can be passed as an authorization header in each request.

To set up your credentials, create an `.env` file which will be protected by the `.gitignore` file. Add the following environment variables:

- `CAMUNDA_CLIENT_ID`
- `CAMUNDA_CLIENT_SECRET`
- `CAMUNDA_REST_ADDRESS` (after creating a client and downloading the .env variables, this is reflected in the Console UI as `ZEEBE_REST_ADDRESS`)
- `CAMUNDA_TOKEN_AUDIENCE` (represented as `ZEEBE_TOKEN_AUDIENCE` in the Console UI), which is `zeebe.camunda.io` in a Camunda 8 SaaS environment. For example, your audience may be defined as `CAMUNDA_TOKEN_AUDIENCE=zeebe.camunda.io`.

These keys will be consumed by the `auth.js` file to execute the OAuth protocol, and should be saved when you generate your client credentials in [prerequisites](#prerequisites).

See the existing `.env.example` file for an example of how your `.env` file should look upon completion. Do not place your credentials in the `.env.example` file, as this example file is not protected by the `.gitignore`.

**Note**

In this tutorial, we will execute arguments to deploy a resource, create and start a process instance, and view a process instance by its key. You can examine the framework for processing these arguments in the `cli.js` file before getting started.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/intermediate-tutorial
