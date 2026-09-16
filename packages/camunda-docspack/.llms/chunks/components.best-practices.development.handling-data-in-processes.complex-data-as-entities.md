# Handling data in processes — Complex data as entities

There are some use cases when it is clever to _introduce entities alongside the process_ to store complex data in a relational database. You can observe this logically as _typed process context_ where you create custom tables for your custom process deployment. Then, you can even use **Data** **Accessor** classes to access these entities in a convenient way.

You will only store a reference to the entity's primary key (typically an artificial UUID) as real process variable within Camunda.

Some people refer to this as **externalized process context**.

There are a couple of advantages of this approach:

- You can do very _rich queries_ on structured process variables via typical SQL.
- You can apply custom _data migration strategies_ when deploying new versions of your process or services, which require data changes.
- Data can be designed and modeled properly, even graphically by, for example, leveraging UML.

It requires additional complexity by adding the need for a relational database and code to handle this.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/handling-data-in-processes
