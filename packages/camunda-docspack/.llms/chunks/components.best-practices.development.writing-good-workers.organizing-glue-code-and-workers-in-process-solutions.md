# Writing good workers — Organizing glue code and workers in process solutions

Assume the following order fulfillment process, that needs to invoke three synchronous REST calls to the responsible systems (payment, inventory, and shipping) via custom glue code:

![order fulfillment example](writing-good-workers-assets/order-fulfillment-process.png)

Should you create three different applications with a worker for one task type each, or would it be better to process all task types within one application?

As a rule of thumb, we recommend implementing **all glue code in one application**, which then is the so-called **process solution** (as described in [Practical Process Automation](https://processautomationbook.com/)). This process solution might also include the BPMN process model itself, deployed during startup. Thus, you create a self-contained application that is easy to version, test, integrate, and deploy.

![Process solution](writing-good-workers-assets/process-solution.png)
Figure taken from [Practical Process Automation](https://processautomationbook.com/)

Thinking of Java, the three REST invocations might live in three classes within the same package (showing only two for brevity):

```java
public class RetrieveMoneyWorker {
  @JobWorker(type = "retrieveMoney", autoComplete = false)
  public void retrieveMoney(final JobClient client, final ActivatedJob job) {
    // ... code
  }
}
```

```java
public class FetchGoodsWorker {
  @JobWorker(type = "fetchGoods", autoComplete = false)
  public void fetchGoods(final JobClient client, final ActivatedJob job) {
    // ... code
  }
}
```

You can also pull the glue code for all task types into one class. Technically, it does not make any difference and some people find that structure in their code easier. If in doubt, the default is to create one class per task type.

There are exceptions when you might not want to have all glue code within one application:

1. You need to specifically control the load for one task type, like _scaling it out_ or _throttling it_. For example, if one service task is doing PDF generation, which is compute-intensive, you might need to scale it much more than all other glue code. On the other hand, it could also mean limiting the number of parallel generation jobs due to licensing limitations of your third-party PDF generation library.
2. You want to write glue code in different programming languages, for example, because writing specific logic in a specific language is much easier (like using Python for certain AI calculations or Java for certain mainframe integrations).

In this case, you would spread your workers into different applications. Most often, you might still have a main process solution that will also still deploy the process model. Only specific workers are carved out.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/writing-good-workers
