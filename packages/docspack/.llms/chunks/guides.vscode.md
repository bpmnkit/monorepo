# VS Code Extension

**BPMN Kit for VS Code** puts the toolkit where the code already is. It renders `.bpmn`,
`.dmn` and `.form` files, reports the same findings `casen lint` reports, compares a diagram
against `HEAD`, runs the process without a cluster, and edits the file without reformatting
it.

The renderer is [`@bpmnkit/canvas`](/docs/packages/canvas), the same from-scratch BPMN 2.0
implementation the website and the browser editor use. There is no bpmn.io anywhere in the
extension, which is the point: the files it shows you are the files git has, byte for byte.

---
Source: https://bpmnkit.com/docs/guides/vscode
