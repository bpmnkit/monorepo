# Modeling with situation patterns — Processing a batch of objects

You need to process many objects at once, which were already created before one by one, or which were updated one by one to reach a certain status.

We sometimes also call that pattern simply the **1-to-n problem**.

**Example:** A lawyer explains to a new client the way he intends to bill him: "Of course, if you need advice, you can call me whenever you want! We will agree about any work that needs to be done and my assistant will track those services which are subject to a charge. Once a month mostly you will receive a neatly-structured invoice providing you with all the details!"

### Using data stores and multi instance activities

Diagram (BPMN):
  start "Advice needed" → "Provide advice" → "Record billable hours" → end "Advice provided"

Diagram (BPMN):
  start "Monthly" → "Determine billable clients" → subprocess "Client Invoicing" → end "Billable Clients invoiced"
  note: For every billable client

**(1)**

The client asks for advice whenever they need it. Note that we create one process instance per request for advice.

**(2)**

The lawyer makes sure to record the billable hours needed for the client.

**(3)**

As he does not directly inform anybody by doing this, but rather collects data, we show this with a data store representing the time sheet and a data association pointing in its direction - representing the write operation.

**(4)**

The assistant starts their invoicing process on a monthly basis. In other words, we create one process instance per monthly billing cycle.

**(5)**

As a first step, the assistant determines all the billable clients. This are the clients for which time sheet entries exist in the respective month. Note that we have _many_ legal advice instances who have a relationship to _one_ billing instance and that the connection is implicitly shown by the read operation on the current status of data in the time sheet.

**(6)**

Now that the assistant knows the billable clients, they can iterate through them and invoice all of them. We use a sequential multi-instance subprocess to illustrate that we need to do this for every billable client.

**(7)**

On the way, the assistant is also in charge of checking and correcting time sheet entries, illustrated with a parallel multi-instance task. Note that these time sheet entries (and hence task instances) relate here 1:1 to the instances of the lawyer's "legal consulting" process. In real life, the lawyer might have created several time sheet entries per legal advice process, but this does not change the logic of the assistant's process.

**(8)**

Once the client is invoiced, the assistant starts a "payment processing" instance per invoice, the details of which are not shown in this diagram. We can imagine that the assistant needs to be prepared to follow up with reminders until the client eventually pays the bill.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/modeling-with-situation-patterns
