# Naming BPMN elements — Naming processes

A _pool_ should be given the same name as the process the pool contains using an object and a nominalized verb. Optionally, add the organizational role responsible for the process shown in the pool as a whole.

Diagram (BPMN):
  start "Dinner time" → "Prepare dinner" → end "Dinner prepared"

If you have more than one lane in a pool, name each _lane_ using the organizational role or technical system responsible for carrying out the activities shown in the lane.

Diagram (BPMN): Dinner preparation and intake
  start "Dinner time" → "Prepare dinner" → "Have dinner" → end "Dinner finished"
  lanes: Family member, Chef
  note: Every family member

Name a _diagram_ (file) with same name as the process shown in the diagram. In case of a collaboration diagram, use a name reflecting the end-to-end perspective shown in that diagram.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/naming-bpmn-elements
