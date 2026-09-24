# @bpmnkit/operate — Connection, CORS and security notes

- **The browser never sees Camunda credentials.** They stay in the proxy's profile
  store. Operate sends only the profile name (`?profile=` on the monitoring poll and the
  `x-profile` header on API calls).
- **CORS.** The proxy answers every request with `Access-Control-Allow-Origin: *`, so a
  page on any origin (for example a Vite dev server on `:5173`) can call it. You do not
  need to configure CORS on the cluster, because the browser does not call it.
- **Same-origin reverse proxy.** `proxyUrl` can be relative. If your dev server forwards
  `/bpmnkit-proxy/*` to `http://localhost:3033/*`, use `proxyUrl: "/bpmnkit-proxy"`.
- **Keep the proxy on a trusted machine.** It acts with the stored credentials for any
  caller that can reach it, and it accepts requests from any origin. Do not expose port
  3033 to a network you do not trust.
- **Errors.** When a poll fails, Operate shows the reason above the view, for example
  `HTTP 401: No active profile` (no profile with a base URL) or
  `Connection error. Retrying…` (the proxy is not running). The last good data stays on
  screen, and the message goes away after the next good poll.

---
Source: https://bpmnkit.com/docs/packages/operate
