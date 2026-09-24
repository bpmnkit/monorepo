# Process documentation

A process model answers "what happens next?" for the people who drew it. Everyone else — the
auditor, the team lead signing it off, the new colleague — wants a document: the diagram, then
each step spelled out. Camunda Modeler and Signavio users know this as a *process report*.
BPMNKit builds one from the model itself, so it never drifts from what is deployed.


## What the document contains

1. **Title and summary** — the pool or process name, and the process documentation text.
2. **Table of contents**, linking every section.
3. **The diagram**, as vector graphics, on a landscape page when printed.
4. **One section per process or pool**:
   - **Lanes and performers** — each lane and the steps it owns.
   - **Steps at a glance** — a numbered table: name, type, lane.
   - **Step details** — for every element, in *flow order* (start events first, then the order a
     token travels; each branch stays together up to its join, loops are not followed twice,
     boundary events follow their host's normal path, sub-process steps are numbered `3.1`,
     `3.2`…):
     type (e.g. *Timer boundary event (non-interrupting)*), documentation text, lane, job type
     and retries, task headers, input/output mappings, called decision and result variable,
     called process, form, assignee and candidate groups, due dates, priority, script,
     multi-instance settings, timers (`PT48H (48 hours)`), messages and correlation keys,
     errors and escalations, and the next steps — with the condition on each outgoing flow and
     the default flow marked.
5. **Message flows** between pools.
6. **Decisions** — each DMN decision table passed in: hit policy, a *When … / Then …* rule
   table, and which steps call it.
7. **Forms** — each form passed in: fields, the variable each binds, type, whether it is
   required and its options, and which user tasks show it.

The same model always produces the same bytes: nothing time-dependent is added unless you pass
a `subtitle`. All model text is escaped, so a name like `<script>` prints as text.

---
Source: https://bpmnkit.com/docs/guides/process-documentation
