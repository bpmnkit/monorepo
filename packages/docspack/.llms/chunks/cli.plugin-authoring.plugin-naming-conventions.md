# casen Plugin Authoring — Plugin naming conventions

| Convention | Reason |
|---|---|
| Name packages `casen-<feature>` | Predictable, easy to search |
| Set `id` to a reverse-domain string | Avoids conflicts across organisations |
| Keep each group name unique | casen merges all groups into one flat namespace |
| Prefix group name with your org for internal plugins | e.g. `acme-deploy` avoids clashing with a published `casen-deploy` |

---
Source: https://docs.bpmnkit.com/cli/plugin-authoring/
