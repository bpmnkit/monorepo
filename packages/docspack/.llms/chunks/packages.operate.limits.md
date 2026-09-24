# @bpmnkit/operate — Limits

- Each list asks the proxy for at most 1000 items, newest first. Search, sort and
  paging in the tables happen in the browser, over those items.
- The instance detail loads the first page of variables and element instances that
  the search endpoints return. A very large instance can show an incomplete list.
- The browser polls. Each poll is one request to the proxy, which makes one or more
  search requests to the cluster, so keep `pollInterval` high for shared clusters.

---
Source: https://bpmnkit.com/docs/packages/operate
