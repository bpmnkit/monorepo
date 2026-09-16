# Service integration patterns with BPMN — Integrating services with BPMN tasks — Service task vs. send/receive task combo

For asynchronous request/response calls, you can use a send task for the request, and a following receive task to wait for the response:

![Send and receive task](service-integration-patterns-assets/send-and-receive-task.png)

You can also use a service task, which is sometimes unknown even to advanced users. A service task can technically wait for a response that happens at any time, a process instance will wait in the service task, as it would in the receive task.

![Service task](service-integration-patterns-assets/service-task.png)

Deciding between these options is not completely straightforward. You can find a table listing the decision criteria below.

As a general rule-of-thumb, we recommend using **the service task as the default option for synchronous _and_ asynchronous request/response** calls. The beauty of service tasks is that you remove visual clutter from the diagram, which makes it easier to read for most stakeholders.

This is ideal if the business problem requires a logically synchronous service invocation. It allows you to ignore the technical details about the protocol on the process model level.

The typical counter-argument is that asynchronous technical protocols might lead to different failure scenarios that you have to care about. For example, when using a separate receive task, readers of the diagram almost immediately start to think about what happens if the response will not be received. But this also has the drawback that now business people might start discussing technical concerns, which is not necessarily good.

Furthermore, this is a questionable argument, as synchronous REST service calls could also timeout. This is exactly the same situation, just hidden deeper in network abstraction layers, as every form of remote communication uses asynchronous messaging somewhere down in the network stack. On a technical level, you should always think about these failure scenarios. The talk [3 common pitfalls in microservice integration and how to avoid them](https://blog.bernd-ruecker.com/3-common-pitfalls-in-microservice-integration-and-how-to-avoid-them-3f27a442cd07) goes into more detail on this.

On a business level, you should be aware of the business implications of technical failures, but not discuss or model all the nuts and bolts around it.

However, there are also technical implications of this design choice that need to be considered.

**Technical implications of using service tasks**

You can keep a service task open and just complete it later when the response arrives, but in **to complete the service task, you need the _job instance key_** from Zeebe. This is an internal ID from the workflow engine. You can either:

- Pass it around to the third party service which sends it back as part of the response message.
- Build some kind of lookup table, where you map your own correlation information to the right job key.

**Note**
Later versions of Zeebe might provide query possibilities for this job key based on user controlled data, which might open up more possibilities.

Using workflow engine internal IDs can lead to problems. For example, you might cancel and restart a process instance because of operational failures, which can lead to a new ID. Outstanding responses cannot be correlated anymore in such instances.

Or, you might run multiple workflow engines which can lead to internal IDs only being unique within one workflow engine. All of this might not happen, but the nature of an internal ID is that it is internal and you have no control over it — which bears some risk.

In practice, however, using the internal job instance key is not a big problem if you get responses in very short time frames (milliseconds). Whenever you have more long-running interactions, you should consider using send and receive tasks, or build your own lookup table that can also address the problems mentioned above.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/service-integration-patterns
