# Handling data in processes — Storing just the relevant data

Do not excessively use process variables. Process variables are subject to [size limitations](https://docs.camunda.io/docs/next/components/concepts/variables#variable-size-limitation), so as a rule of thumb, store _as few variables as possible_ within Camunda.

Keep this limitation in mind when designing your BPMN processes. For example, an AI agent’s context is stored in a process variable by default and counts toward this size limit. Alternatively, you can store the conversation in document storage. See [choose a memory storage backend](https://docs.camunda.io/docs/next/components/connectors/out-of-the-box-connectors/agentic-ai-aiagent-subprocess#choose-a-memory-storage-backend).

### Storing references only

If you have leading systems already storing the business relevant data...

![Hold references only](handling-data-in-processes-assets/hold-references-only.svg)

...then we suggest you store references only (e.g. ID's) to the objects stored there. So instead of holding the `tweet` and the `approved` variable, the process variables would now, for example, look more like the following:

| Variable name | Variable type | Value |
| ------------- | ------------- | ----- |
| `tweetId`     | Long          | 8213  |

### Use cases for storing payload

Store _payload_ (actual business data) as process variables, if you....

- ...have data only of interest within the process itself (e.g. for gateway decisions).

In case of the tweet approval process, even if you are using a tweet domain object, it might still be meaningful to hold the approved value explicitly as a process variable, because it serves the purpose to guide the gateway decision in the process. It might not be true if you want to keep track in the tweet domain objects regarding the approval.

| Variable name | Variable type | Value |
| ------------- | ------------- | ----- |
| `tweetId`     | Long          | 8213  |
| `approved`    | Boolean       | true  |

- ...communicate in a _message oriented_ style. For example, retrieving data from one system and handing it over to another system via a process.

When receiving external messages, consider storing just those parts of the payload relevant for you, and not the whole response. This not only serves the goal of having a lean process variables map, it also makes you more independent of changes in the service's message interface.

- ...want to use the process engine as kind of _cache_. For example, you cannot query relevant customer data in every step for performance reasons.

- ...need to _postpone data changes_ in the leading system to a later step in the process. For example, you only want to insert the Tweet in the Tweet Management Application if it is approved.

- ...want to track the _historical development_ of the data going through your process.

- ...don't have a leading system for this data.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/handling-data-in-processes
