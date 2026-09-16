# Example user task listener — Step 7: Implement the listener

Next, we'll run the listener application to execute our external logic, and complete the listener job to continue the user task's creation.

### Create credentials for your Camunda client

---
---

To interact with your Camunda 8 cluster, you'll use the Camunda client. First, you'll need to create credentials.

1. In Camunda Hub, in the left navigation, under **Console**, click **Clusters**.
2. Select a cluster.
3. Click the **API** tab.
4. Click **Create new client**.
5. Provide a **Client Name** and **Scopes**.
6. Click **Create**.
7. Copy or download your client credentials.

You will need your client ID and your client secret when creating a worker in the next section, so keep this window open. Once you close or navigate away from this screen, you will not be able to see them again.

### Create a job worker to implement the task listener

Next, we’ll create a worker that listens to the user task's events by associating it with the **Listener type** we specified on the task listener in the BPMN diagram.

1. Open the downloaded or cloned project ([repo](https://github.com/camunda/camunda-8-tutorials), then `cd` into `camunda-8-tutorials/quick-start/task-listeners/worker-java`) in your IDE.
2. Add your credentials to `application.properties`. Your client ID and client secret are available from the previous section in the credential text file you downloaded or copied. [Find your **Region ID** and **Cluster ID**](https://docs.camunda.io/docs/next/components/hub/organization/manage-clusters/manage-api-clients#view-connection-informationview-connection-information).
3. In the `Listener.java` file, change the type to match what you specified in the BPMN diagram. If you followed the previous steps for this guide and entered “assign_new_task”, no action is required.
4. After making these changes, perform a Maven install, then run the Listener.java `main` method via your favorite IDE. If you prefer using a terminal, run `mvn package exec:java`.

---
Source: https://docs.camunda.io/docs/next/components/concepts/user-task-listeners-guide
