# casen connector — What gets generated

Each operation in the spec becomes one Camunda element template JSON file. The template
pre-configures a `bpmn:ServiceTask` with job type `io.camunda:http-json:1` and wires up:

- **Method** and **URL** — hidden fixed fields; path parameters become FEEL expressions
  (e.g. `="https://api.example.com/users/"+userId`)
- **Path parameters** — individual `String` input fields
- **Query parameters** — mapped to a FEEL context object
- **Headers** — mapped to a FEEL context object
- **Request body** — single FEEL `Text` field, or individual typed fields with `--expand-body`
- **Authentication** — full 5-type auth block with visibility conditions; pre-selected to the
  detected or specified auth type
- **Output mapping**, **error expression**, **retries**, and **timeout** — standard connector fields

Import the generated `.json` files into Camunda Modeler via
**File → Import Element Templates** or by placing them in your `.camunda/element-templates/` directory.

---
Source: https://docs.bpmnkit.com/cli/connector/
