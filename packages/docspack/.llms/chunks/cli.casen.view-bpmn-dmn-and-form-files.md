# casen CLI — View BPMN, DMN, and Form files

`casen view` opens a local browser-based viewer. Accepts individual files, folders, or a mix.

```sh
casen view bpmn ./processes/     # all .bpmn files in a folder
casen view dmn routing.dmn       # DMN decision table
casen view open ./project/       # any mix of .bpmn/.dmn/.form
```

See [casen view](/docs/cli/view) for full documentation.


## Connection Profiles

A profile stores the connection details for a Camunda cluster:

```sh
# Add a new profile
casen profile add

# You'll be prompted for:
# Name: my-saas-cluster
# Base URL: https://api.cloud.camunda.io
# Auth type: oauth2 | bearer | none
# Client ID, Client Secret, Audience, Token URL (for oauth2)
```

Profiles are saved to `~/.casen/profiles.json`.

---
Source: https://bpmnkit.com/docs/cli/casen
