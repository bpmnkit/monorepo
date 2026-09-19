# Writing good workers — Thinking about transactions, exceptions and idempotency of workers

Visit [dealing with problems and exceptions](https://docs.camunda.io/docs/next/components/best-practices/development/dealing-with-problems-and-exceptions) to gain a better understanding of how workers deal with transactions and exceptions to the happy path, and find more details on how to write idempotent workers.


## Data minimization in workers

If performance or efficiency matters in your scenario, there are two rules about data in your workers you should be aware of:

1. Minimize what data you read for your job. In your job client, you can define which process variables you will need in your worker, and only these will be read and transferred, saving resources on the broker as well as network bandwidth.
2. Minimize what data you write on job completion. You should explicitly not transmit the input variables of a job upon completion, which might happen easily if you simply reuse the map of variables you received as input for submitting the result.

Not transmitting all variables saves resources and bandwidth, but serves another purpose as well: upon job completion, these variables are written to the process and might overwrite existing variables. If you have parallel paths in your process (e.g. [parallel gateway](https://docs.camunda.io/docs/next/components/modeler/bpmn/parallel-gateways/parallel-gateways), [multiple instance](https://docs.camunda.io/docs/next/components/modeler/bpmn/multi-instance/multi-instance)) this can lead to race conditions that you need to think about. The less data you write, the smaller the problem.

While the easiest way is to avoid large variables, one option to keep things light during job activation is to use the `FetchVariables` parameter.
Remember, by default, when this parameter is omitted, the job payload will contain _all_ variables visible within the scope ([see the variables documentation for more on that](https://docs.camunda.io/docs/next/components/concepts/variables).
This could mean tens or more variables, of arbitrary size, and it can be difficult to estimate how much this will represent in general.

We recommend you use the `FetchVariables` parameter, and only fetch the variables which your job handler needs. This will keep the amount of data transferred to a minimum, and will greatly help performance.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/writing-good-workers
