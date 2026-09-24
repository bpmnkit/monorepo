# casen dev — Deploying and AI

`casen dev` does not start the AI bridge or connect to a cluster. For those, run the proxy
alongside it:

```sh
casen proxy start   # port 3033: AI bridge, Camunda API proxy, run history
casen deploy ...    # deploy what you built
```


## Security

The server only listens on `127.0.0.1`. It answers only requests addressed to a loopback host
name, which stops DNS-rebinding pages, and every API call needs a random token that exists only
inside the page it served, so other sites open in the same browser cannot read or write your
files. Reads and writes are limited to `.bpmn`, `.dmn`, `.form` and `.bpmn.tests.json` files
inside the project folder: paths that climb out of it, hidden paths and symlinks pointing
outside it are refused. Nothing is ever executed on your behalf.

---
Source: https://bpmnkit.com/docs/cli/dev
