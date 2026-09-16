# Design a process using BPMN — Set up

Begin by building your BPMN diagrams with [Modeler](https://docs.camunda.io/docs/next/components/modeler/about-modeler).
To get started, ensure you’ve [created a Camunda 8 account](https://docs.camunda.io/docs/next/components/hub/organization/manage-organization-settings/manage-plan/create-account).


## Getting started with BPMN

Once logged in to your Camunda 8 account, take the following steps:

1. Within Camunda Hub, navigate to **Workspaces**, and open your workspace.
2. In the workspace, click **New project**.
3. In the project, click **Create new > BPMN diagram**.
4. In the top navigation, open the menu next to **New BPMN Diagram**, and click **Rename**.
5. Name the diagram "Bake a Cake".

### BPMN elements

Before building out the diagram to bake a cake, let's examine the significance of the components on the left side of the screen.

You can build out a BPMN diagram for a process using several elements, including the following:

- Events: The things that happen. For example, start and end events which begin and terminate the process.
- Tasks: For example, user tasks for a particular user to complete, or service tasks to invoke various web services.
- Gateways: For example, parallel gateways that move the process along between two tasks at the same time.
  - Utilize [variables](https://docs.camunda.io/docs/next/components/concepts/variables) to reflect the data of process instances.
  - Leverage [expressions](https://docs.camunda.io/docs/next/components/concepts/expressions) to access variables and calculate their value(s).
- Subprocesses: For example, a transaction subprocess which can be used to group multiple activities to a transaction.

For a complete list of BPMN elements and their capabilities, visit the [BPMN reference material](https://docs.camunda.io/docs/next/components/modeler/bpmn/bpmn).

### BPMN in action

Using these elements, let's build out a BPMN diagram to examine the process of baking a cake.

Take the following steps:

1. On our diagram, we've already been given an element as a start event in the shape of a circle. Click on the element and select the **Change element** menu icon. For now, keep it as a start event. Double click on the circle to add text.
2. Drag and drop an arrow to the first task (the rectangle shape), or click the start event, and then click the task element to automatically attach it.
3. Click on the element and select the **Change element** menu icon to change the type to a user task, which will be named "Purchase Ingredients." Note that each element added has adjustable attributes. Use the properties panel on the right side of the page to adjust these attributes.
4. Click on the user task to connect a gateway to it. By clicking on the element and selecting the **Change element** menu icon and declaring it a parallel gateway, you can connect it to two tasks that can happen at the same time: mixing the ingredients, and preheating the oven.
   ![baking a cake bpmn sample](./img/bake-cake-bpmn.png)
5. Attach the next gateway once these two tasks have completed to move forward.
6. Add a user task to bake the cake, and finally a user task to ice the cake.
7. Add an end event, represented by a bold circle.
8. No need to save. Camunda Hub will autosave every change you make.

![completed bpmn diagram](./img/complete-baking-cake-bpmn.png)

**Note**
You can also import a BPMN diagram with Camunda Hub. See how to do that [here](https://docs.camunda.io/docs/next/components/hub/workspace/modeler/modeling/import-diagram).

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/automating-a-process-using-bpmn
