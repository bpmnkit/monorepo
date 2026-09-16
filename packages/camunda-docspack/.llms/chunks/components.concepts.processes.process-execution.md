# Processes — Process execution

The simplest kind of process is an ordered sequence of tasks. Whenever process execution reaches a task, [Zeebe](https://docs.camunda.io/docs/next/components/zeebe/zeebe-overview) (the workflow engine inside Camunda 8) creates a job that can be requested and completed by a job worker.

![process-sequence](assets/order-process.png)

Process orchestration typically follows the steps below:

1. A process instance reaches a task, and Zeebe creates a job that can be requested by a worker.
2. Zeebe waits for the worker to request a job and complete the work.
3. Once the work is complete, the flow continues to the next step.
4. If the worker fails to complete the work, the process remains at the current step, and the job could be retried until it's successfully completed.

As Zeebe progresses from one task to the next in a process, it can move custom data in the form of [variables](https://docs.camunda.io/docs/next/components/concepts/variables). Variables are key-value pairs and part of the process instance.

![data-flow](assets/process-data-flow.png)

Any job worker can read the variables and modify them when completing a job so data can be shared between different tasks in a process.

### Agent-driven steps

Not every step has to follow a deterministic path you model in advance. Where a decision can't be fixed up front, you can hand part of the process to an [AI agent](https://docs.camunda.io/docs/next/reference/glossary#ai-agent).

In the following order process, **Fetch items** is an AI agent rather than a fixed task.

![order process with an ai agent](assets/order-process-agent.png)

Execution works as described above, with one difference: the AI agent chooses which activity runs next.

1. The process instance reaches the AI agent, which sends the prompt and the available tool definitions to a large language model (LLM).
2. If the LLM selects a tool, Camunda activates the matching activity inside the sub-process. **Check inventory**, **Reserve stock**, **Order from supplier**, and **Ask warehouse team** are service and user tasks, completed by the same job workers and users as any other task.
3. The tool result is passed back to the LLM, which decides whether more tool calls are needed.
4. Once the LLM returns a final response, the flow continues to **Ship parcel**.

The LLM decides which tools to call and in what order. Camunda runs them, moves the same [variables](https://docs.camunda.io/docs/next/components/concepts/variables), and applies the same retries, incident handling, and audit trail as the fixed steps around them.

To learn more, see [agentic orchestration](https://docs.camunda.io/docs/next/components/agentic-orchestration/agentic-orchestration-overview).

---
Source: https://docs.camunda.io/docs/next/components/concepts/processes
