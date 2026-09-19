# Service integration patterns with BPMN — Integrating services with BPMN tasks — Send task

Technically, **send tasks behave exactly like service tasks**. However, the alternative symbol makes the meaning of sending a message easier to understand for some stakeholders.

You **should use send tasks for sending asynchronous messages**, like AMQP messages or Kafka records.

![Send task](service-integration-patterns-assets/send-task.png)

There is some gray area whenever you call a synchronous service that then sends an asynchronous message. A good example is email. Assume your process does a synchronous request/response call to a service that then sends an email to inform the customer. The call itself is synchronous because it gives you a confirmation (acknowledgement, or ACK for short) that the email has been sent. Now is the "inform customer" task in your process a service, or a send task?

![Asynchronous ACK](service-integration-patterns-assets/synchronous-ack.png)

This question is not easy to answer and **depends on what your stakeholders understand more intuitively**. The more technical people are, the more you might tend towards a service task, as this is technically correct. The more you move towards the business side, the more you might tend to use a send task, as business people will consider sending an email an asynchronous message.

In general, we tend to **let the business win** as it is vital that business stakeholders understand business processes.

However, if you follow a microservice (or service-oriented architecture) mindset, you might argue that you don’t need to know exactly how customers are informed within the process. Hiding the information if the notification is synchronous or asynchronous is good to keep your process model independent of such choices, making it more robust whenever the implementation of the notification service changes. This is a very valid concern too, and might motivate for a service task.

**Note**
In case you can’t easily reach a conclusion, save discussion time and just use a service task.

You could also argue to use send tasks to invoke synchronous request/response calls when you are not interested in the response. However, this is typically confusing, and we do not recommend this.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/service-integration-patterns
