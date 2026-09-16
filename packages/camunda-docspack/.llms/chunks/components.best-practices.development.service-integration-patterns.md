# Service integration patterns with BPMN

When integrating systems and services, you can choose between various modeling possibilities in BPMN.

When integrating systems and services, you can choose between various modeling possibilities in BPMN. This practice will give you an overview and advice on how to decide between alternatives.

You will note that service tasks in general are a good choice, but there are also situations where you might want to switch to send and receive tasks or events.


## Understanding communication patterns

Let's briefly examine the three typical communication patterns to integrate systems:

- **Request/response using synchronous communication styles**: You use a synchronous protocol, like HTTP, and block for the result.
- **Request/response using asynchronous communication styles**: You use asynchronous communication, for example, by sending messages via a message broker, but wait for a response message right after. Technically, these are two independent asynchronous messages, but the sender blocks until the response is received, hence logically making it a request/response.
- **Asynchronous messages or events:** If a peer service needs a long time to process a request, the response is much later than the request, say hours instead of milliseconds. In this case, the response is typically handled as a separate message. Additionally, some of your services might also wait for messages or events that are not connected to a concrete request, especially in event-driven architectures.

The following table gives a summary of the three options:

|                                   | Synchronous request/response | Asynchronous request/response | Asynchronous messages or events |
| --------------------------------- | :--------------------------- | :---------------------------- | :------------------------------ |
| **Business level**                | Synchronous                  | Synchronous                   | Asynchronous                    |
| **Technical communication style** | Synchronous                  | Asynchronous                  | Asynchronous                    |
| **Example**                       | HTTP                         | AMQP, JMS                     | AMQP, Apache Kafka              |

You can dive more into communication styles in the webinar [Communication Between Loosely Coupled Microservices](https://page.camunda.com/wb-communication-between-microservices) ([slides](https://www.slideshare.net/BerndRuecker/webinar-communication-between-loosely-coupled-microservices), [recording](https://page.camunda.com/wb-communication-between-microservices) and [FAQ](https://blog.bernd-ruecker.com/communication-between-loosely-coupled-microservices-webinar-faq-a02708b3c8b5)).

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/service-integration-patterns
