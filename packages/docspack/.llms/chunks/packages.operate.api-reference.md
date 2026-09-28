# @bpmnkit/operate — API reference

### `createOperate(options): OperateApi`

```typescript
interface OperateOptions {
  container: HTMLElement
  proxyUrl?: string        // default "http://localhost:3033"; may be relative
  profile?: string         // default: the proxy's active profile
  theme?: "light" | "dark" | "auto" | "neon"  // default "light"
  pollInterval?: number    // ms; default 30 000, minimum 5 000, 0 = load once, no refresh
  mock?: boolean           // fixture data, no network; default false
  onOpenInEditor?: (xml: string, name: string) => void  // shows "Open in Editor" on diagrams
}

interface OperateApi {
  readonly el: HTMLElement              // the root element appended to container
  setProfile(name: string | null): void // null = the proxy's active profile; reloads the view
  setTheme(theme: Theme): void          // also re-themes an open diagram
  navigate(path: string): void          // e.g. "/instances/2251799813690001"
  destroy(): void                       // stops polling and removes the UI
}
```

A theme the user picked in the header is saved in `localStorage` and takes precedence
over `options.theme` on the next load.

The package also exports the Camunda result types it displays (`ProcessInstanceResult`,
`IncidentResult`, `JobSearchResult`, `UserTaskResult`, `VariableResult`,
`ProcessDefinitionResult`), `ProfileInfo` (the shape of the proxy's `GET /profiles`) and
`DashboardData` (the dashboard poll payload).

`createInstanceDetailView`, `createDefinitionDetailView`, `createDecisionDetailView`,
`InstancesStore`, `DefinitionsStore` and `DecisionsStore` are also exported. They are
marked `@internal`: BPMN Kit Studio uses them, and they can change in any release.

### Routes

Operate uses hash routes, so it works from any static host:

| Route | View |
|---|---|
| `#/` | Dashboard |
| `#/definitions`, `#/definitions/:key` | Process definitions, definition detail |
| `#/decisions`, `#/decisions/:key` | Decision definitions, decision detail |
| `#/instances`, `#/instances/:key` | Process instances, instance detail |
| `#/incidents`, `#/incidents/:key` | Incidents, incident detail |
| `#/jobs` | Jobs |
| `#/tasks`, `#/tasks/:key` | User tasks, task detail |
| `#/messages` | Message and signal actions, active message subscriptions |
| `#/search` | Instance and variable search |

---
Source: https://bpmnkit.com/docs/packages/operate
