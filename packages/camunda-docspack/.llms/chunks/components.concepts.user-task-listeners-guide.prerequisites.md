# Example user task listener — Prerequisites

You must have access to a Camunda 8 SaaS account.

   Have you signed up for Camunda yet?

---
---


## Sign Up

Visit [signup.camunda.com/accounts](https://signup.camunda.com/accounts?utm_source=docs.camunda.io&utm_medium=referral) to sign up.

### Create an account

Fill out the form and click **Create account**.

When you fill out the form, you'll receive a confirmation email. Click on the link to verify your email address.


## Log in to your Camunda 8 account

Log in with the email address and password you used in the previous form, or use the social login buttons. To access the login site directly, navigate to [camunda.io](https://weblogin.cloud.camunda.io/).

![login](./../img/login.png)

After login, select the square-shaped **Camunda components** icon in the upper-left corner, and select **Console** to view the Console overview page. This is the central place to manage the clusters, diagrams, and forms you want to deploy to Camunda 8.

![overview-home](./../img/home.png)

You must also know how to model a process with a user task.  
If you haven't done this before, first follow the steps in our guide to [get started with human task orchestration](https://docs.camunda.io/docs/next/guides/getting-started-orchestrate-human-tasks).

Additionally, you need the following:

- Java ≥ 8
- Maven
- IDE (IntelliJ, VSCode, or similar)
- Download and unzip or clone the [repository](https://github.com/camunda/camunda-8-tutorials), then navigate to:  
  `camunda-8-tutorials/quick-start/task-listeners/worker-java`

For all steps in this guide, refer to the following diagram:

Diagram (BPMN): Task Listener Tutorial
  start "Task assignment needed" → user task "Assigned by creating task listener" → end "Task completed"
  note: This user task does not specify an assignee. However, on creating a listener is triggered. The listener can externally decide upon the assignee by completing the job with a correction of the assignee. This can be useful when the assignee depends on an external system.

---
Source: https://docs.camunda.io/docs/next/components/concepts/user-task-listeners-guide
