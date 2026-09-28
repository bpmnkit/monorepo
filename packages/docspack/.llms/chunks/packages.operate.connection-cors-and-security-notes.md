# @bpmnkit/operate — Connection, CORS and security notes

- **The browser never sees Camunda credentials.** They stay in the proxy's profile
  store. Operate sends only the profile name (`?profile=` on the monitoring poll and the
  `x-profile` header on API calls).
- **CORS.** The proxy answers only allowed origins: bpmnkit.com, Studio, the desktop app,
  and any `localhost`, `127.0.0.1` or `[::1]` origin on any port (for example a Vite dev
  server on `:5173`). It sends that origin back in `Access-Control-Allow-Origin`, never
  `*`. A page on any other origin gets `403`. To embed Operate in an app on another
  origin, start the proxy with `casen proxy start --allow-origin https://your.app`. You do
  not need to configure CORS on the cluster, because the browser does not call it.
- **Same-origin reverse proxy.** `proxyUrl` can be relative. If your dev server forwards
  `/bpmnkit-proxy/*` to `http://localhost:3033/*`, use `proxyUrl: "/bpmnkit-proxy"`. Keep
  the forwarded `Host` header a loopback name (the default for the Vite proxy), or allow
  your host name with `--allow-host`.
- **Keep the proxy on a trusted machine.** It acts with the stored credentials for any
  caller it lets in. By default it listens only on loopback; `--host` exposes it to the
  network. See [Local proxy](/docs/cli/casen#local-proxy).
- **Errors.** When a poll fails, Operate shows the reason above the view, for example
  `HTTP 401: No active profile` (no profile with a base URL) or
  `Connection error. Retrying…` (the proxy is not running). The last good data stays on
  screen, and the message goes away after the next good poll.

---
Source: https://bpmnkit.com/docs/packages/operate
