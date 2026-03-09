export interface DocEntry {
	/** Display title */
	title: string
	/** Short subtitle, e.g. "Event · Start" */
	subtitle: string
	/** Markdown body — supports ## headings, **bold**, _italic_, `code`, - lists, > callouts, --- rules */
	body: string
}

/** Map key: elementType, or elementType:eventDefinitionType for typed events. */
export const ENTRIES: Record<string, DocEntry> = {
	// ── Start Events ────────────────────────────────────────────────────────────
	startEvent: {
		title: "Start Event",
		subtitle: "Event · Start · Plain",
		body: `## What is it?
The plain start event marks where a process instance begins. It fires immediately when the process is triggered — there is no condition or correlation needed.

## When to use
Use the plain start event when:
- The process is started manually by a user
- The process is started programmatically via API
- You don't need to correlate an incoming message or schedule

> Every process must have **at least one** start event. A process cannot have more than one plain start event without using event sub-processes.

## Best practices
- Give the start event a meaningful name using past-participle form: _"Order Received"_, _"Request Submitted"_
- Place it at the far left of the diagram (BPMN flows left to right)

## See also
Timer Start, Message Start, Signal Start`,
	},

	"startEvent:message": {
		title: "Message Start Event",
		subtitle: "Event · Start · Message",
		body: `## What is it?
A message start event starts a new process instance when a specific **named message** is received. The engine correlates the message by its name and optionally a correlation key.

## When to use
- Process is triggered by an incoming API call, webhook, or platform message
- Multiple processes listen for different message types
- You need to pass an initial payload into the process via the message

## In Camunda
Publish a message via the Camunda API:
\`\`\`
POST /api/v1/messages/publish
{ "messageName": "order-received", "correlationKey": "order-123" }
\`\`\`
The message name in the BPMN **must match** the published message name exactly.

> Unlike signals, messages are point-to-point — they target a specific process or instance.

## Best practices
- Name the message in a business-readable way: _"Order Received"_, _"Payment Confirmed"_
- Always include a correlation key when correlating to existing instances`,
	},

	"startEvent:timer": {
		title: "Timer Start Event",
		subtitle: "Event · Start · Timer",
		body: `## What is it?
A timer start event starts a new process instance on a schedule — either at a specific date/time or repeatedly on a cycle.

## Timer types
| Type | Example | Description |
|------|---------|-------------|
| Duration | \`PT1H\` | Wait 1 hour, then start (relative) |
| Date | \`2026-01-01T09:00:00Z\` | Start at a specific ISO 8601 date |
| Cycle | \`R/PT24H\` | Repeat every 24 hours |

## When to use
- Daily batch processing jobs
- Scheduled reminders or escalations
- Regular data synchronization tasks

> Timer start events require the Camunda Job Worker infrastructure to be running. The timer is evaluated by the engine's internal scheduler.

## Best practices
- Use cycles (\`R/\`) for recurring processes
- Prefer duration timers over absolute dates for portability`,
	},

	"startEvent:signal": {
		title: "Signal Start Event",
		subtitle: "Event · Start · Signal",
		body: `## What is it?
A signal start event starts a new process instance when a named **signal is broadcast**. Unlike messages, signals are delivered to **all** processes that are listening for that signal — it is a broadcast, not point-to-point.

## When to use
- Multiple independent processes should react to the same event
- You want a "pub/sub" broadcast pattern
- Coordinating across process definitions (e.g., all instances react to a "shutdown" signal)

## In Camunda
Broadcast a signal via the Camunda API:
\`\`\`
POST /api/v1/signals/broadcast
{ "signalName": "daily-close" }
\`\`\`

> Signals are **broadcast** — every process definition with a matching signal start event will create a new instance. If that is not intended, use a message start event instead.`,
	},

	"startEvent:error": {
		title: "Error Start Event",
		subtitle: "Event · Start · Error",
		body: `## What is it?
An error start event can **only be used inside an event sub-process**. It catches an error thrown within the enclosing scope (by an Error End Event or a system error) and starts the sub-process to handle it.

## When to use
- Centralized error handling within a sub-process scope
- Compensating or cleaning up when a specific business error occurs
- Separating error-handling logic from the happy path

> **Only valid inside an event sub-process.** Cannot be used as a top-level start event.

## Best practices
- Name the error in both the throw and catch to ensure correct correlation
- Use _interrupting_ mode to cancel the parent scope on error
- Use _non-interrupting_ mode to add error logging without stopping the parent`,
	},

	"startEvent:escalation": {
		title: "Escalation Start Event",
		subtitle: "Event · Start · Escalation",
		body: `## What is it?
An escalation start event is used **only inside an event sub-process** to catch escalations raised within the enclosing scope. Escalations differ from errors — they represent expected, business-level situations requiring attention (not failures).

## When to use
- A task raises an escalation that needs special handling within the same sub-process
- Non-critical issues that should be handled without terminating the main flow

> Escalations are non-fatal by nature. Unlike errors, they do not necessarily stop the raising activity.`,
	},

	// ── End Events ──────────────────────────────────────────────────────────────
	endEvent: {
		title: "End Event",
		subtitle: "Event · End · Plain",
		body: `## What is it?
The plain end event marks the completion of **one path** through the process. When the token reaches an end event, that path is finished. If all paths have reached end events, the process instance completes.

## When to use
- Terminate any path in the process
- Use multiple end events to represent different outcomes (success, rejection, timeout)

## Best practices
- Give end events descriptive names representing the outcome: _"Order Fulfilled"_, _"Request Rejected"_, _"Payment Failed"_
- Do **not** leave nodes without outgoing flows — always connect to an end event
- Use different end event types (error, terminate) when the outcome carries semantics`,
	},

	"endEvent:terminate": {
		title: "Terminate End Event",
		subtitle: "Event · End · Terminate",
		body: `## What is it?
A terminate end event **immediately cancels the entire process instance** — all parallel branches, tokens, and active jobs are stopped. This is in contrast to the plain end event which only ends one path.

## When to use
- Any one path reaching this event should abort the entire process
- Failure of a critical step should stop all parallel work
- "Cancel" actions where you want to stop everything

> **Use carefully.** Terminating ends all active parallel branches — incomplete work will not be compensated or rolled back unless you add compensation logic.

## vs. Plain End Event
| | Plain End | Terminate End |
|---|---|---|
| Other parallel paths | Continue | **Stopped immediately** |
| Sub-process scope | Ends this path | **Cancels everything** |`,
	},

	"endEvent:error": {
		title: "Error End Event",
		subtitle: "Event · End · Error",
		body: `## What is it?
An error end event **throws a named error** when the flow reaches it. The error propagates up through the element hierarchy until it is caught by a matching Error Boundary Event or Error Start Event on an Event Sub-Process.

## When to use
- Business exceptions that need to be handled by a parent scope
- Signaling that a sub-process has failed in a recoverable way
- Propagating validation failures out of a sub-process

## Error correlation
The error is matched by its **error code**. Set the same error code in both the throw and the catch for reliable correlation.

> If no matching catch exists in any enclosing scope, the process instance terminates with an error.

## Best practices
- Always name errors clearly: _"Payment Declined"_, _"Validation Failed"_
- Catch errors at the appropriate level — not too high, not too low`,
	},

	"endEvent:message": {
		title: "Message End Event",
		subtitle: "Event · End · Message",
		body: `## What is it?
A message end event **sends a named message** when the path completes. It is semantically equivalent to a message throw event followed by a plain end event.

## When to use
- Notify external systems or downstream processes when a path completes
- Trigger another process upon completion
- Integration patterns where completion must be communicated`,
	},

	"endEvent:signal": {
		title: "Signal End Event",
		subtitle: "Event · End · Signal",
		body: `## What is it?
A signal end event **broadcasts a named signal** to all listening processes and sub-processes when this path completes.

## When to use
- Broadcast completion to multiple downstream listeners
- Fan-out notification when one process completes

> Because signals are broadcast, ensure no unintended processes react to the signal.`,
	},

	"endEvent:escalation": {
		title: "Escalation End Event",
		subtitle: "Event · End · Escalation",
		body: `## What is it?
An escalation end event **raises a named escalation** within an enclosing sub-process scope. The escalation is caught by an Escalation Boundary Event on the sub-process or an Escalation Start Event on an Event Sub-Process.

## When to use
- A sub-process path reaches a business condition that needs parent-level attention
- Non-critical situations that require escalation without terminating the sub-process`,
	},

	"endEvent:compensation": {
		title: "Compensation End Event",
		subtitle: "Event · End · Compensation",
		body: `## What is it?
A compensation end event **triggers compensation** for the current scope — executing all compensation handlers associated with completed activities in reverse order.

## When to use
- Undo previously completed work (e.g., reverse a charge, cancel a booking)
- Saga pattern: compensate each completed step when a later step fails

> Compensation handlers are attached to activities via Compensation Boundary Events. When compensation is triggered, each handler runs for its associated activity.`,
	},

	// ── Intermediate Catch Events ────────────────────────────────────────────────
	intermediateCatchEvent: {
		title: "Intermediate Catch Event",
		subtitle: "Event · Intermediate · Catch · Plain",
		body: `## What is it?
A plain intermediate catch event **pauses the flow** and waits for something unspecified. Because a plain catch event has no trigger semantics, it is rarely useful on its own.

## When to use
Prefer typed intermediate catch events (Timer, Message, Signal) which have defined trigger conditions.

> A plain intermediate catch event can serve as a visual waypoint or "wait state" marker, but has no actual triggering mechanism in most engines.`,
	},

	"intermediateCatchEvent:message": {
		title: "Message Intermediate Catch",
		subtitle: "Event · Intermediate · Catch · Message",
		body: `## What is it?
A message intermediate catch event **pauses the process flow** and waits for a specific named message to arrive before continuing. When the message is received, execution resumes.

## When to use
- Asynchronous callback patterns (send a request, wait for a response)
- Human-in-the-loop: wait for external confirmation
- Webhook integration: the process parks here until a callback arrives

## In Camunda
When a process instance is waiting at a message catch event, publish the message:
\`\`\`
POST /api/v1/messages/publish
{ "messageName": "payment-confirmed", "correlationKey": "order-123" }
\`\`\`
Use the correlation key to target the correct waiting instance.

## Best practices
- Always add a Timer Boundary Event on the catch event for timeouts
- Use meaningful message names that describe the expected event`,
	},

	"intermediateCatchEvent:timer": {
		title: "Timer Intermediate Catch",
		subtitle: "Event · Intermediate · Catch · Timer",
		body: `## What is it?
A timer intermediate catch event **pauses execution** for a specified duration or until a specific date/time, then continues.

## Timer types
- **Duration**: \`PT30M\` — pause for 30 minutes
- **Date**: \`2026-06-01T08:00:00Z\` — resume at a specific time

## When to use
- Introduce a delay between steps (cooling-off period, retry delay)
- Send a reminder after N hours if a task is not completed
- Schedule future processing

> Use FEEL expressions for dynamic durations: \`= duration(timePeriod)\`

## Best practices
- Label timer events with the duration: _"Wait 24h"_, _"Retry in 5 min"_
- Combine with boundary events on tasks for SLA monitoring`,
	},

	"intermediateCatchEvent:signal": {
		title: "Signal Intermediate Catch",
		subtitle: "Event · Intermediate · Catch · Signal",
		body: `## What is it?
A signal intermediate catch event **pauses the flow** and waits for a named signal to be broadcast. When the signal arrives, execution resumes.

## When to use
- Wait for a cross-process or system-wide broadcast
- Coordinate parallel processes that need to synchronize
- React to operational events (e.g., _"deploy signal"_ triggers all waiting instances)

> Unlike message catch, signal catch does NOT use a correlation key — the signal goes to ALL waiting instances with matching signal name.`,
	},

	"intermediateCatchEvent:link": {
		title: "Link Intermediate Catch",
		subtitle: "Event · Intermediate · Catch · Link",
		body: `## What is it?
A link catch event is the **target** of a link throw event. Together, they form an "off-page connector" — visually connecting two distant parts of a large diagram without drawing a long sequence flow line.

## When to use
- Large diagrams where sequence flows would cross many elements and reduce readability
- Connect a throw point at the bottom of the diagram to a catch point elsewhere

> Links are purely cosmetic connectors — they do **not** pause execution or wait for anything. The flow passes through instantly.

## Usage
1. Place a **Link Throw** event where you want to jump from
2. Place a **Link Catch** event where you want to land
3. Give both the **same link name**

A throw + catch pair with the same name acts as a single invisible sequence flow.`,
	},

	// ── Intermediate Throw Events ────────────────────────────────────────────────
	intermediateThrowEvent: {
		title: "Intermediate Throw Event",
		subtitle: "Event · Intermediate · Throw · Plain",
		body: `## What is it?
A plain intermediate throw event passes through without doing anything. It can serve as a **visual milestone** in the diagram.

## When to use
Use typed throw events (Message, Signal, Escalation, Link) for actual behavior. A plain throw is primarily cosmetic.

> Consider using a Text Annotation instead of a plain throw event to mark milestones — it communicates intent more clearly without adding fake BPMN semantics.`,
	},

	"intermediateThrowEvent:message": {
		title: "Message Intermediate Throw",
		subtitle: "Event · Intermediate · Throw · Message",
		body: `## What is it?
A message intermediate throw event **sends a named message** to a target participant or process and immediately continues. Unlike a send task, it has no retry or job semantics.

## When to use
- Notify another process or participant during execution
- Fire-and-forget messaging (no need to wait for a reply)

> For request/reply patterns, use a **Send Task** followed by a **Message Catch** event.`,
	},

	"intermediateThrowEvent:signal": {
		title: "Signal Intermediate Throw",
		subtitle: "Event · Intermediate · Throw · Signal",
		body: `## What is it?
A signal intermediate throw event **broadcasts a named signal** to all signal catch events with the matching name. All waiting instances and catch events in the engine receive it simultaneously.

## When to use
- Broadcast a state change to multiple processes
- Trigger all waiting parallel processes at once
- System-wide events ("end of day", "batch started")`,
	},

	"intermediateThrowEvent:escalation": {
		title: "Escalation Intermediate Throw",
		subtitle: "Event · Intermediate · Throw · Escalation",
		body: `## What is it?
An escalation throw event **raises a named escalation** within the current scope, caught by an Escalation Boundary Event or Event Sub-Process in the enclosing context.

## When to use
- Raise a non-fatal business issue that needs parent-level attention
- Trigger escalation handling without stopping the current flow (non-interrupting)`,
	},

	"intermediateThrowEvent:compensation": {
		title: "Compensation Intermediate Throw",
		subtitle: "Event · Intermediate · Throw · Compensation",
		body: `## What is it?
A compensation throw event **triggers compensation handlers** for completed activities in the current scope. Used in the Saga pattern to undo previously completed work.

## When to use
- Undo specific completed activities (optionally targeted to one activity)
- Implement business-level rollback

## How it works
1. Mark activities with a **Compensation Boundary Event** and connect a compensation handler
2. When the throw event fires, each marked activity's handler executes
3. Handlers run for activities that have _already completed_`,
	},

	"intermediateThrowEvent:link": {
		title: "Link Intermediate Throw",
		subtitle: "Event · Intermediate · Throw · Link",
		body: `## What is it?
A link throw event **jumps the flow** to the matching Link Catch event elsewhere in the diagram. They form an off-page connector pair.

## When to use
- Connect distant parts of a diagram without crossing flow lines
- Improve readability of large diagrams

## Usage
Give the throw and catch events the **same link name**. The flow passes through instantly with no wait state.`,
	},

	// ── Boundary Events ──────────────────────────────────────────────────────────
	"boundaryEvent:message": {
		title: "Message Boundary Event",
		subtitle: "Event · Boundary · Message",
		body: `## What is it?
A message boundary event attaches to an activity and **intercepts a named message** while that activity is active. When the message arrives, the boundary event fires and the flow leaves the activity.

## Interrupting vs. Non-Interrupting
| Mode | Marker | Behavior |
|------|--------|----------|
| Interrupting | Solid border | Cancels the activity, follows boundary path |
| Non-interrupting | Dashed border | Activity continues, boundary path runs in parallel |

## When to use
- **Interrupting**: Cancel an approval task when the request is withdrawn
- **Non-interrupting**: Start a parallel notification when a task is running too long

> When the boundary event fires (interrupting), any sub-process or multi-instance work inside the activity is cancelled.`,
	},

	"boundaryEvent:timer": {
		title: "Timer Boundary Event",
		subtitle: "Event · Boundary · Timer",
		body: `## What is it?
A timer boundary event fires after a duration or at a specific time while its host activity is executing. The most common boundary event — used for SLA monitoring and timeouts.

## Interrupting vs. Non-Interrupting
| Mode | Use case |
|------|----------|
| Interrupting | Timeout: cancel task and escalate |
| Non-interrupting | Reminder: send a reminder but keep the task active |

## Example: SLA Escalation
\`\`\`
Review Task ──── [Timer 24h, non-interrupting] ──► Send Reminder
             └── [Timer 72h, interrupting]     ──► Escalate to Manager
\`\`\`

## In Camunda
Timer boundary events create time-based jobs handled by the Camunda scheduler. Use ISO 8601 durations (\`PT24H\`) or FEEL expressions.

## Best practices
- Add timer boundaries to all user tasks that must complete within an SLA
- Label the timer with the threshold: _"After 24h"_`,
	},

	"boundaryEvent:error": {
		title: "Error Boundary Event",
		subtitle: "Event · Boundary · Error",
		body: `## What is it?
An error boundary event **catches an error thrown** inside the attached activity (or its sub-processes). It is always interrupting — the activity is cancelled and flow continues on the error path.

## When to use
- Handle errors thrown by service tasks (API failures, validation errors)
- Catch errors propagated from sub-processes
- Provide graceful degradation when a task fails

## Example
\`\`\`
Call Payment API ─── [Error: "payment-failed"] ──► Handle Payment Error
\`\`\`

> Error boundaries on **Call Activities** catch errors thrown by the called process. Errors on **Sub-Processes** catch errors from inside the sub-process.

## Best practices
- Match the error code between the throw and catch for precise error handling
- Leave the error code empty to catch **any** error`,
	},

	"boundaryEvent:signal": {
		title: "Signal Boundary Event",
		subtitle: "Event · Boundary · Signal",
		body: `## What is it?
A signal boundary event fires when a named signal is broadcast while the attached activity is executing.

## Interrupting vs. Non-Interrupting
| Mode | Use case |
|------|----------|
| Interrupting | Cancel the activity when the signal arrives |
| Non-interrupting | Start a parallel path when the signal arrives |

## When to use
- React to system-wide events while a task is running
- Cancel or redirect work when an operational signal fires`,
	},

	"boundaryEvent:timer_escalation": {
		title: "Escalation Boundary Event",
		subtitle: "Event · Boundary · Escalation",
		body: `## What is it?
An escalation boundary event catches escalations raised inside the attached activity's scope. Unlike error boundaries, escalation boundaries can be **non-interrupting** — the sub-process continues while the boundary path handles the escalation.

## When to use
- Handle business-level escalations from sub-processes without stopping them
- Route escalated cases to a manager while the original task continues

> Escalation boundaries are commonly **non-interrupting** to allow the sub-process to continue normally after the escalation is handled.`,
	},

	"boundaryEvent:compensation": {
		title: "Compensation Boundary Event",
		subtitle: "Event · Boundary · Compensation",
		body: `## What is it?
A compensation boundary event marks an activity as **compensatable**. It connects the activity to a compensation handler — a task or sub-process that undoes the activity's effects when compensation is triggered.

## When to use
- Implement the Saga pattern: each compensatable step has a corresponding undo step
- Undo completed booking, charge, or allocation when a later step fails

## How it works
1. Attach a compensation boundary event to an activity (e.g., _"Charge Card"_)
2. Connect it with a **compensation association** (dashed arrow) to a handler activity (e.g., _"Refund Card"_)
3. When a Compensation Throw Event fires, the handler runs for all completed compensatable activities

> Compensation boundaries are **not interrupting** and do **not** use sequence flows — they use associations.`,
	},

	"boundaryEvent:cancel": {
		title: "Cancel Boundary Event",
		subtitle: "Event · Boundary · Cancel",
		body: `## What is it?
A cancel boundary event **only applies to Transaction sub-processes**. It fires when the transaction is cancelled (via a Cancel End Event inside the transaction), allowing cleanup work.

## When to use
- Clean up after a cancelled transaction (e.g., release reservations)
- Only valid on Transaction sub-processes — not regular tasks or sub-processes`,
	},

	// ── Tasks ────────────────────────────────────────────────────────────────────
	serviceTask: {
		title: "Service Task",
		subtitle: "Task · Service",
		body: `## What is it?
A service task represents an **automated activity** performed by a software system, without human interaction. The process engine executes it by invoking a service — an external worker, a REST API, or a script.

## In Camunda (Job Workers)
Service tasks in Camunda use the **Job Worker** pattern:

1. Set the **Job Type** (\`jobType\`) on the task
2. Deploy a worker that polls for jobs of that type
3. The worker completes (or fails) the job

\`\`\`
jobType: "process-payment"
inputVariables: { orderId, amount }
outputVariables: { transactionId, status }
\`\`\`

## HTTP Connector
For HTTP/REST calls, use the built-in connector:
- Set \`jobType\` to \`io.camunda:http-json:1\`
- Configure \`taskHeaders\`: \`url\`, \`method\`, \`body\`
- Set \`resultVariable\` for the response

## When to use
- Any automated step: API calls, data processing, messaging
- Integration with external systems
- Any step where no human input is needed

## Best practices
- Name service tasks with _Verb Object_: _"Validate Order"_, _"Send Notification"_
- Keep worker logic simple; use a sub-process for complex multi-step logic
- Always handle errors with a boundary event`,
	},

	userTask: {
		title: "User Task",
		subtitle: "Task · User",
		body: `## What is it?
A user task represents work that must be **performed by a human**. When execution reaches a user task, the engine creates a task in the task list, assigns it (by user, group, or expression), and waits for completion.

## In Camunda
- Assign using \`assignee\`, \`candidateGroups\`, or \`candidateUsers\` (FEEL expressions supported)
- Optionally link a **Form** (by form ID) to provide a structured UI
- Task is completed via the Tasklist app or via API

## Properties
| Property | Description |
|----------|-------------|
| Assignee | Direct user assignment |
| Candidate Groups | Groups that can claim the task |
| Candidate Users | Users that can claim the task |
| Due Date | ISO 8601 date/time for the SLA |
| Follow-up Date | When to follow up |
| Priority | Numeric priority (default 50) |
| Form | Form schema to render |

## When to use
- Manual review, approval, or data-entry steps
- Any step that requires a human decision
- Forms for structured input collection

## Best practices
- Always set candidate groups or assignees — avoid leaving tasks unassigned
- Add a timer boundary event for SLA enforcement
- Link a form for structured data capture`,
	},

	businessRuleTask: {
		title: "Business Rule Task",
		subtitle: "Task · Business Rule",
		body: `## What is it?
A business rule task **evaluates a decision** (typically a DMN decision table) and stores the result in a process variable. It is fully automated — no human interaction required.

## In Camunda
Link to a DMN decision:
- Set **Decision ID** to the DMN decision key
- Set **Result Variable** to store the output
- Optionally set **Result Type** (single, list, collect)

## Example
Decision: _"Determine Risk Level"_ (DMN table)
Input variables: \`customerAge\`, \`creditScore\`
Output: \`riskLevel\` = _"low"_ | _"medium"_ | _"high"_

## When to use
- Credit scoring, risk assessment, eligibility checks
- Tax calculation, pricing rules
- Any rule that is best modeled as a decision table (separate from the process)

## Best practices
- Keep decision logic in DMN, not in FEEL expressions on gateways
- Decision tables are easier to maintain and audit separately from the process`,
	},

	scriptTask: {
		title: "Script Task",
		subtitle: "Task · Script",
		body: `## What is it?
A script task executes an **inline script** within the process engine. In Camunda, script tasks use FEEL expressions to transform data.

## When to use
- Lightweight data transformation (e.g., map a response to a variable)
- Compute derived values from existing variables
- Simple string/number manipulations

> For complex logic or anything that needs testing in isolation, use a **Service Task** with a job worker instead.

## In Camunda
Set the **Script Expression** using FEEL:
\`\`\`feel
= { fullName: firstName + " " + lastName,
    totalAmount: items |> sum(item.price) }
\`\`\`

## Best practices
- Keep scripts short — one responsibility per task
- Avoid side effects or I/O operations in scripts
- Prefer service tasks for logic that needs unit testing`,
	},

	sendTask: {
		title: "Send Task",
		subtitle: "Task · Send",
		body: `## What is it?
A send task **sends a message** to another participant or process. It is equivalent to a service task with messaging semantics, and conceptually represents _"we are sending something to someone else"_.

## When to use
- Model inter-process or inter-participant communication explicitly
- Send notifications to external systems as a named business activity
- Collaboration diagrams where participants exchange messages

> In practice, Camunda treats send tasks similarly to service tasks. You still configure a job type and use a worker to implement the actual sending.`,
	},

	receiveTask: {
		title: "Receive Task",
		subtitle: "Task · Receive",
		body: `## What is it?
A receive task **waits for a named message** to arrive. It is semantically equivalent to a Message Intermediate Catch Event, but modeled as a task (rectangular shape).

## When to use
- Represent the act of "receiving" something as a named business step
- Async request-reply patterns: send a request, then wait at a receive task
- Collaboration diagrams where receiving a message is a notable activity

## In Camunda
Correlate the message using the Camunda API just as with message catch events.

> Prefer **Message Intermediate Catch Events** for most cases — they communicate waiting semantics more clearly on the diagram.`,
	},

	manualTask: {
		title: "Manual Task",
		subtitle: "Task · Manual",
		body: `## What is it?
A manual task represents work performed by a human **outside** the process engine — no system interaction, no task list entry. It documents a step that happens in the physical world.

## When to use
- Document steps that happen offline (phone call, physical inspection, paper signing)
- Show human steps in a process that aren't tracked in the system
- Model as-is processes that include manual work before automation

> The engine does **not** create a task for manual tasks and does **not** wait — it passes through immediately. Manual tasks are documentation only.

## vs. User Task
| | Manual Task | User Task |
|---|---|---|
| Task list entry | No | Yes |
| System tracking | No | Yes |
| Automated routing | No | Yes |`,
	},

	callActivity: {
		title: "Call Activity",
		subtitle: "Activity · Call",
		body: `## What is it?
A call activity **invokes a separately defined process** as a reusable sub-process. When the call activity starts, a new child process instance is created. When that child instance completes, the call activity completes and the parent continues.

## When to use
- Reuse a common sub-flow across multiple parent processes (e.g., _"KYC Check"_, _"Payment"_)
- Break a large complex process into smaller, independently deployable processes
- Versioned sub-processes that can be updated independently

## In Camunda
- Set **Called Process ID** to the BPMN process ID of the child process
- Map input variables from parent → child using **Input Mappings**
- Map output variables from child → parent using **Output Mappings**

## Best practices
- Call activities should be _independent_ — the child process should not depend on parent variables directly
- Use I/O mappings to pass only what's needed
- Version the called process ID if you want to call a specific version`,
	},

	subProcess: {
		title: "Sub-Process",
		subtitle: "Activity · Sub-Process (Embedded)",
		body: `## What is it?
An embedded sub-process **groups flow elements** into a collapsible container within the parent process. Unlike a call activity, it is part of the same process — it shares variables, can catch boundary events, and is not independently deployed.

## When to use
- Group related steps to improve diagram readability
- Apply a boundary event to an entire group of activities
- Create a scope for event sub-processes, compensation, or loops

## vs. Call Activity
| | Sub-Process | Call Activity |
|---|---|---|
| Definition | Embedded in parent | Separate BPMN process |
| Variable scope | Shared with parent | Independent (mapped) |
| Reuse | No (inline only) | Yes (multiple callers) |
| Boundary events | Yes | Yes |

## Collapsed vs. Expanded
- **Expanded**: contents visible in the diagram
- **Collapsed**: shown as a single task-like box (content hidden)

## Best practices
- Use sub-processes to scope error and timer boundary events over multiple tasks
- Collapse sub-processes in high-level diagrams for readability`,
	},

	adHocSubProcess: {
		title: "Ad-Hoc Sub-Process",
		subtitle: "Activity · Ad-Hoc Sub-Process",
		body: `## What is it?
An ad-hoc sub-process contains activities that can be **executed in any order, any number of times, or skipped entirely**. Activities inside are not connected by sequence flows — participants choose what to do and when.

## When to use
- Discretionary, case-based workflows where the sequence is not predetermined
- Knowledge work (research, investigation, consulting)
- Situations where the process depends heavily on context and professional judgment

> Ad-hoc sub-processes are rarely used in automated processes. They model human-driven, flexible work where the exact sequence is not known upfront.

## Camunda support
Ad-hoc support varies by engine version. Check your engine's documentation for the level of ad-hoc execution support.`,
	},

	// ── Gateways ─────────────────────────────────────────────────────────────────
	exclusiveGateway: {
		title: "Exclusive Gateway (XOR)",
		subtitle: "Gateway · Exclusive",
		body: `## What is it?
An exclusive gateway (XOR) **routes the flow to exactly one** outgoing path based on conditions. Each outgoing sequence flow has a condition; the first condition that evaluates to _true_ wins. One path has no condition or is the **default flow**.

## Split vs. Join
| Role | Incoming | Outgoing |
|------|----------|----------|
| Split (fork) | 1 | 2+ |
| Join (merge) | 2+ | 1 |

A single gateway should perform only one role — never both simultaneously.

## In Camunda
Conditions use FEEL expressions on outgoing sequence flows:
\`\`\`feel
= amount > 1000
= status = "approved"
\`\`\`

Always set a **default flow** (marked with a slash on the arrow) to handle the else-case.

## Best practices
- Name split gateways as a yes/no question: _"Invoice valid?"_
- Label outgoing flows with condition names: _"Yes"_ / _"No"_
- Always include a default flow to prevent unhandled cases
- Separate split and join gateways — don't combine`,
	},

	parallelGateway: {
		title: "Parallel Gateway (AND)",
		subtitle: "Gateway · Parallel",
		body: `## What is it?
A parallel gateway (AND) **splits the flow into multiple parallel branches** (all branches execute) or **waits for all branches to complete** before continuing.

## Split vs. Join
- **Split (+)**: Creates N parallel tokens — all paths execute concurrently
- **Join (+)**: Waits until ALL incoming branches have arrived, then releases one token

> Always pair a parallel split with a parallel join of the same type. The join holds tokens until all parallel branches complete.

## When to use
- Steps that can run concurrently to reduce elapsed time
- Fan-out: notify multiple systems simultaneously
- Fan-in: wait for all parallel work to complete before proceeding

## Example
\`\`\`
Order ──(+)── Ship Item ─────────────────────(+)── Confirm
        └─── Charge Card ──────────────────┘
        └─── Send Confirmation Email ──────┘
\`\`\`

## Best practices
- Do **not** add conditions to outgoing flows from a parallel split — all branches always execute
- Parallel gateways do **not** need a label`,
	},

	inclusiveGateway: {
		title: "Inclusive Gateway (OR)",
		subtitle: "Gateway · Inclusive",
		body: `## What is it?
An inclusive gateway (OR) **splits the flow into one or more paths** based on conditions. Unlike the exclusive gateway, **multiple conditions can be true**, activating multiple branches simultaneously.

## Split vs. Join
- **Split**: Evaluates all conditions; activates every true branch (at least one must be true)
- **Join**: Waits for **all activated branches** to complete (not all incoming — only those that were started)

> The join is smart — it only waits for branches that were actually activated by the matching split, not all possible incoming paths.

## When to use
- Multiple optional paths that may run in parallel
- Feature flags or optional processing steps
- When you need AND + XOR combined (some paths always, some conditionally)

## Best practices
- Always set a default flow to ensure at least one branch fires
- The matching split and join should be of the **same type** (both inclusive)
- Use parallel gateway when ALL branches should always run`,
	},

	eventBasedGateway: {
		title: "Event-Based Gateway",
		subtitle: "Gateway · Event-Based",
		body: `## What is it?
An event-based gateway **routes based on which event occurs first** — a race condition. Each outgoing path connects to an event (message catch, timer catch, signal catch). The first event to fire activates its path; all other paths are discarded.

## When to use
- Wait for one of several possible external responses
- Timeout pattern: wait for a callback OR a timer, whichever comes first
- Choose between different incoming messages

## Example
\`\`\`
Event-based gateway ─── Message: "Order Confirmed" ──► Continue
                    └── Timer: after 24h ────────────► Send Reminder → Cancel
\`\`\`

## Rules
- Outgoing paths must connect to **intermediate catch events** (message, timer, signal) or **receive tasks**
- Exactly one path fires — others are cancelled when one event triggers
- Do **not** use with plain sequence flows or tasks on outgoing paths

## Best practices
- Label the event-based gateway: _"Awaiting response"_
- One outgoing path should always be a timer (to handle the no-response case)`,
	},

	// ── Sequence Flows ────────────────────────────────────────────────────────────
	sequenceFlow: {
		title: "Sequence Flow",
		subtitle: "Connector · Sequence Flow",
		body: `## What is it?
A sequence flow is the **arrow** connecting flow elements. It defines the order of execution in a process.

## Types
| Type | Marker | Description |
|------|--------|-------------|
| Regular | Plain arrow | Unconditional flow |
| Default | Arrow with slash at source | Taken when all other conditions are false |
| Conditional | Arrow with mini-diamond at source | Has a FEEL condition expression |

## Conditions (FEEL)
Add a condition expression to control which path is taken from a gateway:
\`\`\`feel
= amount > 1000
= status = "approved" and risk = "low"
\`\`\`

## Default Flow
Set one outgoing flow from an exclusive or inclusive gateway as the default. It fires when no other condition is true. The default flow **never has a condition expression** — it is the else-case.

## Best practices
- Label conditional flows with their condition: _"Approved"_, _"Amount > €1000"_
- Always set a default flow on exclusive/inclusive gateways
- Flows should generally go left-to-right; backwards flows indicate loops`,
	},
}

// ── Index / Category list ────────────────────────────────────────────────────

export interface DocCategory {
	label: string
	items: Array<{ key: string; title: string; brief: string }>
}

export const CATEGORIES: DocCategory[] = [
	{
		label: "Start Events",
		items: [
			{ key: "startEvent", title: "Start Event", brief: "Plain start — begins the process" },
			{
				key: "startEvent:message",
				title: "Message Start",
				brief: "Triggered by an incoming message",
			},
			{ key: "startEvent:timer", title: "Timer Start", brief: "Triggered on a schedule" },
			{ key: "startEvent:signal", title: "Signal Start", brief: "Triggered by a broadcast signal" },
			{
				key: "startEvent:error",
				title: "Error Start",
				brief: "Catches errors in event sub-processes",
			},
			{
				key: "startEvent:escalation",
				title: "Escalation Start",
				brief: "Catches escalations in event sub-processes",
			},
		],
	},
	{
		label: "End Events",
		items: [
			{ key: "endEvent", title: "End Event", brief: "Ends one path in the process" },
			{ key: "endEvent:terminate", title: "Terminate End", brief: "Cancels the entire process" },
			{ key: "endEvent:error", title: "Error End", brief: "Throws a named error upwards" },
			{ key: "endEvent:message", title: "Message End", brief: "Sends a message on completion" },
			{ key: "endEvent:signal", title: "Signal End", brief: "Broadcasts a signal on completion" },
			{ key: "endEvent:escalation", title: "Escalation End", brief: "Raises an escalation" },
			{ key: "endEvent:compensation", title: "Compensation End", brief: "Triggers compensation" },
		],
	},
	{
		label: "Intermediate Events",
		items: [
			{ key: "intermediateCatchEvent", title: "Catch (Plain)", brief: "Pauses the flow" },
			{
				key: "intermediateCatchEvent:message",
				title: "Message Catch",
				brief: "Waits for a message to arrive",
			},
			{
				key: "intermediateCatchEvent:timer",
				title: "Timer Catch",
				brief: "Pauses for a duration or date",
			},
			{
				key: "intermediateCatchEvent:signal",
				title: "Signal Catch",
				brief: "Waits for a signal broadcast",
			},
			{
				key: "intermediateCatchEvent:link",
				title: "Link Catch",
				brief: "Off-page connector target",
			},
			{
				key: "intermediateThrowEvent",
				title: "Throw (Plain)",
				brief: "Visual milestone, no behavior",
			},
			{ key: "intermediateThrowEvent:message", title: "Message Throw", brief: "Sends a message" },
			{ key: "intermediateThrowEvent:signal", title: "Signal Throw", brief: "Broadcasts a signal" },
			{
				key: "intermediateThrowEvent:escalation",
				title: "Escalation Throw",
				brief: "Raises an escalation in scope",
			},
			{
				key: "intermediateThrowEvent:compensation",
				title: "Compensation Throw",
				brief: "Triggers compensation handlers",
			},
			{
				key: "intermediateThrowEvent:link",
				title: "Link Throw",
				brief: "Off-page connector source",
			},
		],
	},
	{
		label: "Boundary Events",
		items: [
			{
				key: "boundaryEvent:message",
				title: "Message Boundary",
				brief: "Catches a message on an activity",
			},
			{ key: "boundaryEvent:timer", title: "Timer Boundary", brief: "Timeout / SLA monitoring" },
			{
				key: "boundaryEvent:error",
				title: "Error Boundary",
				brief: "Catches errors from an activity",
			},
			{
				key: "boundaryEvent:signal",
				title: "Signal Boundary",
				brief: "Catches a signal on an activity",
			},
			{
				key: "boundaryEvent:timer_escalation",
				title: "Escalation Boundary",
				brief: "Catches escalations from sub-processes",
			},
			{
				key: "boundaryEvent:compensation",
				title: "Compensation Boundary",
				brief: "Marks an activity as compensatable",
			},
			{
				key: "boundaryEvent:cancel",
				title: "Cancel Boundary",
				brief: "Catches cancel in transactions",
			},
		],
	},
	{
		label: "Tasks",
		items: [
			{ key: "serviceTask", title: "Service Task", brief: "Automated task via job worker" },
			{ key: "userTask", title: "User Task", brief: "Human task in the task list" },
			{ key: "businessRuleTask", title: "Business Rule Task", brief: "Evaluates a DMN decision" },
			{ key: "scriptTask", title: "Script Task", brief: "Inline FEEL script" },
			{ key: "sendTask", title: "Send Task", brief: "Sends a message to a participant" },
			{ key: "receiveTask", title: "Receive Task", brief: "Waits for an incoming message" },
			{ key: "manualTask", title: "Manual Task", brief: "Offline human work, not tracked" },
			{ key: "callActivity", title: "Call Activity", brief: "Invokes a reusable sub-process" },
		],
	},
	{
		label: "Sub-Processes",
		items: [
			{ key: "subProcess", title: "Sub-Process", brief: "Embedded grouping container" },
			{
				key: "adHocSubProcess",
				title: "Ad-Hoc Sub-Process",
				brief: "Flexible, discretionary flow",
			},
		],
	},
	{
		label: "Gateways",
		items: [
			{ key: "exclusiveGateway", title: "Exclusive (XOR)", brief: "Route to exactly one path" },
			{ key: "parallelGateway", title: "Parallel (AND)", brief: "Split to all paths / join all" },
			{ key: "inclusiveGateway", title: "Inclusive (OR)", brief: "Route to one or more paths" },
			{ key: "eventBasedGateway", title: "Event-Based", brief: "Route to first event that fires" },
		],
	},
	{
		label: "Connectors",
		items: [{ key: "sequenceFlow", title: "Sequence Flow", brief: "Arrow connecting elements" }],
	},
]
