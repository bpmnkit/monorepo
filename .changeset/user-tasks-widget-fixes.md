---
"@bpmnkit/user-tasks": patch
---

After a failed claim or unclaim, the widget re-enables the button so the user can try again. Before, the button stayed disabled until the task was replaced.

With `theme: "auto"`, the form now follows the resolved OS theme like the rest of the widget. Before, it was drawn dark for every theme except `"light"`, so on a light OS the widget was light and its form dark.
