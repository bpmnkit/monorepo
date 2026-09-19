# Try with Swagger — Using Swagger UI effectively

### Making your first API call

1. **Test connectivity**: Try the `GET /topology` endpoint to verify your connection and authentication
2. **Explore endpoints**: Browse the available operations organized by category (processes, user tasks, variables, etc.)
3. **Try sample requests**: Click "Try it out" on any endpoint to see the request form
4. **Execute requests**: Fill in parameters and click "Execute" to see real responses

### Understanding the interface

- **Endpoints are grouped by resource type** - Find process-related operations under "Process Instances", task operations under "User Tasks", etc.
- **Required parameters are marked** - Look for the red asterisk (\*) next to required fields
- **Example values are provided** - Use the "Example Value" links to populate request bodies quickly
- **Response schemas are documented** - Expand the response sections to understand the data structure

### Testing workflows

Use Swagger UI to test complete workflows:

1. **Deploy a process** - Use `POST /deployments` to upload a BPMN file
2. **Start a process instance** - Use `POST /process-instances` with your process definition
3. **Query and manage** - Use search endpoints to find and interact with your data
4. **Complete tasks** - Use `POST /user-tasks/{userTaskKey}/completion` to progress workflows

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/orchestration-cluster-api-rest-swagger
