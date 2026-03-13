import type { TutorialManifest } from "../../lib/types.js"

const ORDER_PROCESS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="OrderProcess" name="Order Process" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1" name="Order received">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:task id="Task_validate" name="Validate order">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
    </bpmn:task>
    <bpmn:task id="Task_process" name="Process payment">
      <bpmn:incoming>Flow_2</bpmn:incoming>
      <bpmn:outgoing>Flow_3</bpmn:outgoing>
    </bpmn:task>
    <bpmn:endEvent id="EndEvent_1" name="Order completed">
      <bpmn:incoming>Flow_3</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Task_validate" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_validate" targetRef="Task_process" />
    <bpmn:sequenceFlow id="Flow_3" sourceRef="Task_process" targetRef="EndEvent_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="OrderProcess">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1"><dc:Bounds x="152" y="102" width="36" height="36" /><bpmndi:BPMNLabel><dc:Bounds x="130" y="145" width="82" height="14" /></bpmndi:BPMNLabel></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_validate_di" bpmnElement="Task_validate"><dc:Bounds x="250" y="80" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_process_di" bpmnElement="Task_process"><dc:Bounds x="410" y="80" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1"><dc:Bounds x="572" y="102" width="36" height="36" /><bpmndi:BPMNLabel><dc:Bounds x="548" y="145" width="85" height="14" /></bpmndi:BPMNLabel></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1"><di:waypoint x="188" y="120" /><di:waypoint x="250" y="120" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2"><di:waypoint x="350" y="120" /><di:waypoint x="410" y="120" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_3_di" bpmnElement="Flow_3"><di:waypoint x="510" y="120" /><di:waypoint x="572" y="120" /></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

export const tutorial: TutorialManifest = {
	id: "getting-started",
	title: "Your first BPMN diagram",
	tagline: "Run a process, add a task, connect it, name it — in under 10 minutes",
	description:
		"Learn the fundamentals of BPMN by working with a real process diagram. You'll run a simulation, add tasks, connect them with sequence flows, and name them — all in the browser with no installation required.",
	estimatedMinutes: 10,
	difficulty: "beginner",
	tags: ["bpmn", "basics", "no-install"],
	prerequisites: [],
	steps: [
		{
			id: "run-it",
			title: "Run the process",
			mode: "web-editor",
			estimatedSeconds: 60,
			initialXml: ORDER_PROCESS_XML,
			content: `## Your first BPMN process

You're looking at a **BPMN process diagram** — a visual map that shows how work flows through a business process.

This one is an **Order Process**:
1. An order arrives (the green circle)
2. Someone validates it (first box)
3. The payment is processed (second box)
4. The order is complete (the thick red circle)

### Let's bring it to life

Press the **▶ Play** button in the toolbar. You'll see animated dots move through the diagram — that's a simulated "token" showing how the process executes.

> 💡 In real life, these tokens represent actual work items moving through your business processes in Camunda.

When you're ready, click **"I ran it!"** below.`,
			validation: {
				type: "manual",
				successMessage: "You just ran your first BPMN process! 🎉",
			},
			hints: [
				"Look for the ▶ Play button in the toolbar at the top of the diagram",
				"Click the ▶ button and watch the colored dots move through the process",
			],
		},
		{
			id: "add-task",
			title: "Add a new task",
			mode: "web-editor",
			estimatedSeconds: 90,
			content: `## Add a new task

Every step in a business process is a **task** — a unit of work that needs to happen.

Let's add a new task to this process. Maybe we want to send a confirmation email after payment?

### How to add a task

1. Look at the **palette panel** on the left side
2. Find the **Task** shape (the plain rectangle)
3. **Drag it** onto the canvas — drop it somewhere after the "Process payment" task

Don't worry about connecting it yet — we'll do that next!

> 💡 **BPMN tip:** Tasks represent human work, system actions, or service calls. They're the building blocks of every process.`,
			validation: {
				type: "bpmn-element-count",
				elementType: "task",
				min: 3,
				successMessage: "You added a new task — the process is growing!",
				errorMessage:
					"Try dragging a task shape onto the canvas. It's the rectangle in the element palette.",
			},
			hints: [
				"Look for the panel on the left side — it has shapes you can drag onto the canvas",
				"Find the rectangle labeled 'Task' and drag it onto the canvas between the existing tasks",
				"Drag the Task shape anywhere on the canvas — it doesn't need to be connected yet",
			],
		},
		{
			id: "connect",
			title: "Connect the steps",
			mode: "web-editor",
			estimatedSeconds: 90,
			content: `## Connect the steps

A **sequence flow** (the arrows between tasks) shows the order work happens. Without connections, the process doesn't know where to go next.

### How to connect tasks

1. **Hover** over one of the existing tasks (like "Process payment")
2. You'll see a **blue arrow** appear on the edge of the shape
3. **Click and drag** from that arrow to your new task

The arrow becomes a sequence flow — the backbone of any BPMN process.

> 💡 **Think of it like a flowchart:** the arrows show "after this step, do that step."`,
			validation: {
				type: "bpmn-has-connection",
				successMessage: "You drew a sequence flow — that's how BPMN shows the order of work!",
				errorMessage:
					"Try hovering over a shape until you see the blue arrow appear, then drag to connect it.",
			},
			hints: [
				"Hover your mouse slowly over one of the existing tasks",
				"When you see a blue arrow appear on the edge of the shape, click and drag from that arrow to your new task",
				"You can also click a shape to select it, then drag the arrow that appears to another shape",
			],
		},
		{
			id: "rename",
			title: "Name your task",
			mode: "web-editor",
			estimatedSeconds: 60,
			content: `## Name your task

A task without a name is a mystery — what does it do? Good BPMN processes are **self-documenting**: reading the task names should tell the whole story.

### How to rename a task

1. **Double-click** on the task you added
2. A text editor will appear
3. Type a descriptive name — for example: **"Send confirmation email"**
4. Press **Enter** or click outside to save

> 💡 **Best practice:** Use verb + noun for task names: "Validate order", "Process payment", "Send email". This makes the process readable to anyone.`,
			validation: {
				type: "bpmn-element-labeled",
				successMessage: "Your task now has a name — the process tells a story!",
				errorMessage: "Try double-clicking on the task shape you added to edit its label.",
			},
			hints: [
				"Double-click directly on the task shape you added",
				"When you see a text cursor appear, type the name of the task (e.g. 'Send confirmation email')",
				"Press Enter or click outside to confirm the name",
			],
		},
		{
			id: "run-again",
			title: "Run your updated process",
			mode: "web-editor",
			estimatedSeconds: 60,
			content: `## Run your updated process

You've made real changes to a BPMN process. Now let's see it in action — **with your new task included**.

### What to do

Press **▶ Play** again. This time, watch the token move through **your new task** too.

### What you've accomplished

In this tutorial you:
- ✓ Ran a BPMN process and watched it execute
- ✓ Added a new task to a real process
- ✓ Connected it with a sequence flow
- ✓ Named it properly

These are the core skills of **BPMN modeling**. Everything else — gateways, events, lanes, subprocesses — builds on exactly what you just learned.

**Ready to go further?** Check out the next tutorial.`,
			validation: {
				type: "manual",
				successMessage:
					"You've completed your first BPMN tutorial! You built and ran a real process.",
			},
			hints: [
				"Press ▶ Play to run the updated process with your new task included",
				"Watch the token move through all the tasks including your new one",
			],
		},
	],
}
