# Connecting the workflow engine with your world — Technology examples

Most projects want to connect to specific technologies. Currently, most people ask for REST, messaging, or Kafka.

REST and messaging are common core integration patterns. Kafka is different: it is optional infrastructure that you would typically introduce for event streaming or broader event-driven architectures, not because Zeebe requires it to execute workflows.

### REST

You could build a piece of code that provides a REST endpoint in the language of choice and then starts a process instance.

The [Ticket Booking Example](https://github.com/berndruecker/ticket-booking-camunda-cloud) contains an example using Java and Spring Boot for the [REST endpoint](https://github.com/berndruecker/ticket-booking-camunda-cloud/blob/master/booking-service-java/src/main/java/io/berndruecker/ticketbooking/rest/TicketBookingRestController.java#L35).

Similarly, you can leverage the [Spring Boot extension](https://github.com/zeebe-io/spring-zeebe/) to startup job workers that will [execute outgoing REST calls](https://github.com/berndruecker/ticket-booking-camunda-cloud/blob/master/booking-service-java/src/main/java/io/berndruecker/ticketbooking/adapter/GenerateTicketAdapter.java#L29).

![REST example](connecting-the-workflow-engine-with-your-world-assets/rest-example.png)

You can find [Spring Boot sample code for the REST endpoint](https://github.com/berndruecker/flowing-retail/blob/master/zeebe/java/checkout/src/main/java/io/flowing/retail/checkout/rest/ShopRestController.java) in the [Flowing Retail example](https://github.com/berndruecker/flowing-retail).

### Messaging

You can do the same for messages, which is often [AMQP](https://en.wikipedia.org/wiki/Advanced_Message_Queuing_Protocol) nowadays.

The [Ticket Booking Example](https://github.com/berndruecker/ticket-booking-camunda-cloud) contains an example for RabbitMQ, Java, and Spring Boot. It provides a message listener to correlate incoming messages with waiting process instances, and [glue code to send outgoing messages onto the message broker](https://github.com/berndruecker/ticket-booking-camunda-cloud/blob/master/booking-service-java/src/main/java/io/berndruecker/ticketbooking/adapter/RetrievePaymentAdapter.java).

![Messaging example](connecting-the-workflow-engine-with-your-world-assets/messaging-example.png)

[Service integration patterns](https://docs.camunda.io/docs/next/components/best-practices/development/service-integration-patterns) goes into details of if you want to use a send and receive task here, or prefer simply one service task (spoiler alert: send and receive tasks are used here because the payment service might be long-running; think about expired credit cards that need to be updated or wire transfers that need to happen).

<!-- The same concept will apply to other programming languages. For example, you could use the [Node.js client for RabbitMQ](https://www.rabbitmq.com/tutorials/tutorial-one-javascript.html) and the [Node.js client for Zeebe](https://github.com/camunda-community-hub/zeebe-client-node-js) to create the same type of glue code as shown above. -->

### Apache Kafka

Kafka is not required for Camunda 8 or Zeebe to work. Zeebe executes workflows itself, while Kafka can optionally be used as an event backbone around the workflow engine.

Typical Kafka-based patterns are:

- **Kafka to Zeebe**: Consume records from a Kafka topic and translate them into Zeebe API calls, such as starting a process instance or correlating a message.
- **Zeebe to Kafka**: When a workflow reaches a service task or other integration point, write a record to Kafka so downstream systems can react asynchronously.

You can implement these patterns with custom glue code. The [Flowing Retail example](https://github.com/berndruecker/flowing-retail) shows this using Java, Spring Boot, and Spring Cloud Streams. There is [code to subscribe to a Kafka topic and start new process instances for new records](https://github.com/berndruecker/flowing-retail/blob/master/kafka/java/order-zeebe/src/main/java/io/flowing/retail/kafka/order/messages/MessageListener.java#L39), and there is some glue code to create new records when a process instance executes a service task. Of course, you could also use other frameworks to achieve the same result.

This means Kafka is a good fit if you already use Kafka, need loose coupling, or want to broadcast workflow-related events to multiple consumers. If you simply need to call a remote system from a workflow, a job worker or connector is often the more direct option.

![Kafka Example](connecting-the-workflow-engine-with-your-world-assets/kafka-example.png)

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/connecting-the-workflow-engine-with-your-world
