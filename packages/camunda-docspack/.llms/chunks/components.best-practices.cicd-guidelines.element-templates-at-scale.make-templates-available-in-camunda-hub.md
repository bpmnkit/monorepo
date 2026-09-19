# Element templates at scale — Make templates available in Camunda Hub

Make templates available in Camunda Hub with the Camunda Hub API ([SaaS](https://docs.camunda.io/docs/next/apis-tools/hub-api-saas/overview) or [Self-Managed](https://docs.camunda.io/docs/next/apis-tools/hub-api-sm/overview)).

### Get the workspace key

Search for your workspace to get the `workspaceKey`:

```bash
POST /api/v2/workspaces/search
{
    "filter": {
        "name": "(WORKSPACE NAME)"
    }
}
```

You'll use the `workspaceKey` to filter projects to the target workspace.

### Get projects

With the `workspaceKey`, retrieve the projects that belong to the workspace:

```bash
GET /api/v2/workspaces/(WORKSPACE KEY)
```

Under `content`, get the `projectKey` for the project you want to update.

### Get file metadata

With the `projectKey`, retrieve a list of files and metadata:

```bash
GET /api/v2/projects/(PROJECT KEY)
```

Using `content`, compare the files in Camunda Hub to the files in your repository.

### Create or update files

For each file in your repository that doesn't match the content in Camunda Hub, [create](https://docs.camunda.io/docs/next/apis-tools/hub-api-saas/specifications/create-file.api) or [update](https://docs.camunda.io/docs/next/apis-tools/hub-api-saas/specifications/update-file.api) the appropriate file resource.

### Create new file versions

If desired, [create a new file version](https://modeler.camunda.io/swagger-ui/index.html#/Versions) for each of the affected files:

```bash
POST /api/v2/versions
{
  "fileKey": "(FILE KEY)",
  "name": "(VERSION NAME)"
}
```

---
Source: https://docs.camunda.io/docs/next/components/best-practices/cicd-guidelines/element-templates-at-scale
