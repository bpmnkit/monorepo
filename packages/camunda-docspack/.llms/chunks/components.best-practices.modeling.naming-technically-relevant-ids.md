# Naming technically relevant IDs

For executable flows, properly name all relevant technical element IDs, like BPMN IDs, in your BPMN diagrams.

For executable flows, properly name all relevant technical element IDs in your BPMN diagrams.

**Note**
Keep technical IDs and names short enough for the target environment. Most user-defined BPMN and DMN IDs, names, deployed resource names, and form IDs support up to 32,768 characters with Elasticsearch/OpenSearch-backed storage and 256 characters with RDBMS-backed storage. If you use RDBMS, or might migrate to it later, keep these values comfortably within the 256-character limit.

Focus on process, activity, message, and error IDs, but also consider events as well as gateways and their sequence flows that carry conditional expressions. Those elements can show up regularly (e.g. in your logs) and it makes things easier if you can interpret their meaning.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/naming-technically-relevant-ids
