# Dealing with problems and exceptions — Embracing business transactions and eventual consistency — Technical vs business transactions

Applications using databases can often leverage ACID (atomic, consistent, isolated, durable) capabilities of that database. This means that some business logic is either successfully committed as a whole, or rolled back completely in case of any error. It is normally referred to as "transactions".

Those ACID transactions cannot be applied to distributed systems (the talk [lost in transaction](https://www.youtube.com/watch?v=WRR26jJNh68) elaborates on this), so if you call out to multiple services from a process, you end up with separate ACID transactions at play. The following illustrations are taken from the O'Reilly book [Practical Process Automation](https://processautomationbook.com/):

![Multiple ACID transactions](dealing-with-problems-and-exceptions-assets/multiple-acid-transactions.png)

In the above example, the CRM system and the billing system have their local ACID transactions. The workflow engine itself also runs transactional. However, there cannot be a joined technical transaction. This requires a new way of dealing with consistency on the business level, which is referred to as **business transaction**:

![Businss vs technical transaction](dealing-with-problems-and-exceptions-assets/business-vs-technical-transaction.png)

A **business transaction** marks a section in a process for which 'all or nothing' semantics (similar to a technical transaction) should apply, but from a business perspective. You might encounter inconsistent states in between (for example a new customer being present in the CRM system, but not yet in the billing system).

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/dealing-with-problems-and-exceptions
