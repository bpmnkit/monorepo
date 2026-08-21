# casen generate — Typical AI workflow

```sh
# 1. Inspect the existing file — AI learns element IDs
casen generate bpmn --input order.bpmn --dump-compact

# 2. Check the schema if needed
casen generate bpmn --help-schema

# 3. AI generates patch JSON and pipes it in
echo '{"elements":[...],"flows":[...]}' | casen generate bpmn --input order.bpmn

# 4. Verify the result
casen view bpmn order.bpmn
```

---
Source: https://docs.bpmnkit.com/cli/generate/
