# Zeebe Process Engine — Architecture Reference for TypeScript Implementation

## 1. Core Architecture & Design Philosophy

### Event-Sourced, Deterministic State Machine

Zeebe is a **replicated state machine** built on **event sourcing**. Every state change is captured
as an immutable record in an append-only log. State is derived by replaying events, never stored as
the primary source of truth.

**Key principles:**
- **Single-threaded per partition** — no locks, no races, deterministic execution
- **Command → Event model** — clients submit commands; the engine validates and emits events
- **Separation of concerns** — Processors read state and produce events; Event Appliers mutate state
- **Composition over inheritance** — Shared logic lives in Behavior classes, not base classes

### Processing Pipeline

```
Client → Gateway (gRPC/REST) → Broker → LogStream (append) → StreamProcessor → Engine
                                                                     │
                                                     ┌───────────────┴───────────────┐
                                                     │                               │
                                              [REPLAY mode]                   [PROCESSING mode]
                                              Events only →                   Commands → Processors
                                              EventAppliers →                     → Events
                                              Rebuild state                        → EventAppliers
                                                                                   → Update state
                                                                                   → Side effects
```

### Two Modes of Operation

| Mode | Used By | Processes | Purpose |
|------|---------|-----------|---------|
| **Replay** | Followers + startup | Events only | Rebuild state from log |
| **Processing** | Leader | Commands + events | Accept new work, produce events |

---

## 2. Main Components & Responsibilities

### 2.1 Module Map

| Module | Responsibility |
|--------|---------------|
| `zeebe/engine` | Core process execution engine (processors, state, behaviors) |
| `zeebe/broker` | Server runtime, partition management, cluster coordination |
| `zeebe/gateway-grpc` | gRPC API gateway for client commands |
| `zeebe/gateway-rest` | REST API gateway |
| `zeebe/protocol` | SBE-encoded message definitions (records, intents, value types) |
| `zeebe/bpmn-model` | BPMN XML parser and in-memory model |
| `zeebe/logstreams` | Append-only log abstraction over disk journal |
| `zeebe/zb-db` | RocksDB wrapper for state storage |
| `zeebe/feel` | FEEL expression language integration |
| `zeebe/exporter-api` | SPI for exporting records to external systems |
| `zeebe/scheduler` | Actor-based task scheduler (single-threaded execution) |
| `zeebe/atomix` | Raft consensus, cluster membership, transport |
| `zeebe/snapshot` | Periodic RocksDB checkpoint management |

### 2.2 Engine Internals

#### StreamProcessor (Actor)
- Reads records from the LogStream sequentially
- Manages the processing state machine: Read → Process → Write → Side Effects → Commit
- Single-threaded actor model — one per partition

#### Engine (RecordProcessor)
- Dispatches records to the correct `TypedRecordProcessor` based on `ValueType`
- Entry point: `Engine.process(record)` → returns `ProcessingResult`

#### EngineProcessors (Registry)
- Registers all processor types: Job, ProcessInstance, Message, Deployment, Timer, etc.
- Maps `(ValueType, Intent)` → `TypedRecordProcessor`

#### BpmnStreamProcessor
- Top-level processor for all BPMN-related records
- Delegates to element-specific `BpmnElementProcessor` implementations

#### BpmnElementProcessors (Registry)
Maps `BpmnElementType` → `BpmnElementProcessor`:

| Category | Element Types |
|----------|--------------|
| **Tasks** | SERVICE_TASK, USER_TASK, SCRIPT_TASK, SEND_TASK, RECEIVE_TASK, BUSINESS_RULE_TASK, MANUAL_TASK |
| **Gateways** | EXCLUSIVE_GATEWAY, PARALLEL_GATEWAY, INCLUSIVE_GATEWAY, EVENT_BASED_GATEWAY |
| **Events** | START_EVENT, END_EVENT, INTERMEDIATE_CATCH_EVENT, INTERMEDIATE_THROW_EVENT, BOUNDARY_EVENT |
| **Containers** | PROCESS, SUB_PROCESS, EVENT_SUB_PROCESS, MULTI_INSTANCE_BODY, CALL_ACTIVITY, AD_HOC_SUB_PROCESS |
| **Flow** | SEQUENCE_FLOW |

#### Behavior Classes (Shared Logic)
| Behavior | Responsibility |
|----------|---------------|
| `BpmnStateTransitionBehavior` | Writes state transition events (ACTIVATING→ACTIVATED, etc.) |
| `BpmnStateBehavior` | Queries/updates element instance state |
| `BpmnVariableMappingBehavior` | Input/output variable mappings via FEEL |
| `BpmnJobBehavior` | Creates and manages jobs for task elements |
| `BpmnEventSubscriptionBehavior` | Manages message/signal/timer subscriptions |
| `BpmnIncidentBehavior` | Creates incidents on failures |
| `BpmnUserTaskBehavior` | User task lifecycle |

#### EventAppliers (State Mutation)
- **Only place where state is mutated**
- Registry of `TypedEventApplier` implementations (~100+)
- Versioned — released appliers are never changed
- Each applier handles one `(ValueType, Intent)` combination

---

## 3. Key Data Structures & Models

### 3.1 Record Model (Protocol Layer)

Every interaction is a **Record** with:

```typescript
interface Record<T extends RecordValue> {
  position: number;        // Monotonically increasing per partition
  key: number;             // Entity identifier (e.g., process instance key)
  timestamp: number;       // Unix timestamp
  intent: Intent;          // Type-specific enum (e.g., ELEMENT_ACTIVATED)
  recordType: RecordType;  // COMMAND | EVENT | COMMAND_REJECTION
  valueType: ValueType;    // JOB | PROCESS_INSTANCE | MESSAGE | etc.
  partitionId: number;
  rejectionType?: RejectionType;
  sourceRecordPosition: number;  // Causal link to triggering record
  value: T;                // Type-specific payload
}
```

**RecordType taxonomy:**
- `COMMAND` — Client request (e.g., "create process instance")
- `EVENT` — Confirmed state change (e.g., "element activated")
- `COMMAND_REJECTION` — Denied command (e.g., "process not found")

### 3.2 ProcessInstanceRecord

```typescript
interface ProcessInstanceRecord {
  bpmnProcessId: string;
  version: number;
  processDefinitionKey: number;
  processInstanceKey: number;
  elementId: string;
  bpmnElementType: BpmnElementType;
  parentProcessInstanceKey: number;   // -1 for root
  parentElementInstanceKey: number;
  rootProcessInstanceKey: number;
  tenantId: string;
  businessId?: string;
}
```

### 3.3 ElementInstance (Runtime State)

```typescript
interface ElementInstance {
  key: number;
  parentKey: number;                  // -1 for root
  childCount: number;
  childActivatedCount: number;
  childCompletedCount: number;
  childTerminatedCount: number;
  jobKey: number;
  multiInstanceLoopCounter: number;
  calledChildInstanceKey: number;     // For call activities
  activeSequenceFlows: number;        // For parallel gateway joins
  activeSequenceFlowIds: string[];
  userTaskKey: number;
  executionListenerIndex: number;
  processDepth: number;               // Call activity nesting depth
  completionConditionFulfilled: boolean;
  record: ProcessInstanceRecord;      // Current state snapshot
}
```

### 3.4 Job Model

```typescript
interface JobRecord {
  type: string;              // Worker type (e.g., "send-email")
  processInstanceKey: number;
  elementInstanceKey: number;
  processDefinitionKey: number;
  elementId: string;
  bpmnProcessId: string;
  retries: number;
  deadline: number;          // Activation timeout
  variables: Record<string, any>;
  customHeaders: Record<string, string>;
  errorCode?: string;
  errorMessage?: string;
  tenantId: string;
}

// Job state machine:
// CREATED → ACTIVATED → COMPLETED
//                     → FAILED (with retries > 0 → back to CREATED)
//                     → FAILED (with retries = 0 → INCIDENT)
//                     → TIMED_OUT → back to CREATED
//                     → ERROR_THROWN
//                     → CANCELED
```

### 3.5 Variable Scoping

```typescript
// Hierarchical scope model — each element instance is a scope
// Variables resolve upward through the scope chain

interface VariableScope {
  scopeKey: number;          // = element instance key
  parentScopeKey: number;    // Parent element instance key
  variables: Map<string, any>;  // Local variables in this scope
}

// Lookup: check local scope → parent scope → ... → process instance scope
// Write: can write to local scope or propagate to parent
```

### 3.6 State Storage (Column Families in RocksDB)

| Column Family | Key | Value | Purpose |
|--------------|-----|-------|---------|
| `ELEMENT_INSTANCE_KEY` | elementInstanceKey | ElementInstance | Runtime element state |
| `ELEMENT_INSTANCE_PARENT_CHILD` | (parentKey, childKey) | nil | Parent-child hierarchy |
| `VARIABLES` | (scopeKey, varName) | varValue | Variable storage |
| `JOB_STATES` | jobKey | JobStateValue | Job lifecycle state |
| `JOB_ACTIVATABLE` | (type, tenantId) | jobKey | Worker polling index |
| `TIMER_DUE_DATES` | (dueDate, instanceKey, timerKey) | nil | Timer scheduling |
| `MESSAGE_SUBSCRIPTION` | (messageName, correlationKey) | subscription | Message correlation |
| `PROCESS_INSTANCE_KEY_BY_DEFINITION_KEY` | (defKey, instanceKey) | nil | Process lookup |

---

## 4. Process Execution & State Transitions

### 4.1 Element Lifecycle State Machine

```
                    ┌──────────────────────────────────────────┐
                    │                                          │
                    ▼                                          │
    ┌──────────────────────┐                                   │
    │  ELEMENT_ACTIVATING  │──────────────────────┐            │
    └──────────┬───────────┘                      │            │
               │ success                          │ terminate  │
               ▼                                  ▼            │
    ┌──────────────────────┐              ┌───────────────────┐│
    │  ELEMENT_ACTIVATED   │──────────┐   │ELEMENT_TERMINATING││
    └──────────┬───────────┘          │   └───────┬───────────┘│
               │ complete             │ terminate │            │
               ▼                      │           ▼            │
    ┌──────────────────────┐          │   ┌───────────────────┐│
    │  ELEMENT_COMPLETING  │──────────┘   │ELEMENT_TERMINATED ││
    └──────────┬───────────┘              └───────────────────┘│
               │ success                   (final state)       │
               ▼                                               │
    ┌──────────────────────┐                                   │
    │  ELEMENT_COMPLETED   │───────────────────────────────────┘
    └──────────┬───────────┘        (may activate next element
               │                     via SEQUENCE_FLOW_TAKEN)
               ▼
    ┌──────────────────────┐
    │ SEQUENCE_FLOW_TAKEN  │───→ next element ELEMENT_ACTIVATING
    └──────────────────────┘
```

**Valid transitions:**
| From | To |
|------|----|
| ELEMENT_ACTIVATING | ELEMENT_ACTIVATED, ELEMENT_TERMINATING |
| ELEMENT_ACTIVATED | ELEMENT_COMPLETING, ELEMENT_TERMINATING |
| ELEMENT_COMPLETING | ELEMENT_COMPLETED, ELEMENT_TERMINATING |
| ELEMENT_TERMINATING | ELEMENT_TERMINATED |
| ELEMENT_COMPLETED | SEQUENCE_FLOW_TAKEN |
| SEQUENCE_FLOW_TAKEN | ELEMENT_ACTIVATING (next element) |

### 4.2 BpmnElementProcessor Lifecycle Methods

Each processor implements these hooks:

```typescript
interface BpmnElementProcessor<T extends ExecutableFlowElement> {
  // Called when element activation begins
  // → Initialize, create jobs, subscribe to events, apply input mappings
  onActivate(element: T, context: BpmnElementContext): void;

  // Called after START execution listeners complete
  // → Final setup, evaluate conditions, take outgoing flows
  finalizeActivation(element: T, context: BpmnElementContext): void;

  // Called when element completion begins
  // → Apply output mappings, propagate results, cleanup
  onComplete(element: T, context: BpmnElementContext): void;

  // Called when element is terminated (e.g., process cancelled)
  // → Cancel jobs, unsubscribe from events, cleanup
  onTerminate(element: T, context: BpmnElementContext): void;
}
```

### 4.3 Execution Flow Example: Service Task

```
1. Process token arrives at service task
   → ELEMENT_ACTIVATING event written
   → EventApplier creates ElementInstance in state

2. ServiceTaskProcessor.onActivate()
   → Apply input variable mappings (FEEL expressions)
   → Create Job record (JOB CREATED event)
   → Transition to ELEMENT_ACTIVATED

3. Worker polls for jobs (JOB_BATCH ACTIVATE command)
   → JobBatchActivateProcessor queries JOB_ACTIVATABLE index
   → Returns matching jobs → JOB ACTIVATED event

4. Worker completes job (JOB COMPLETE command)
   → JobCompleteProcessor validates state
   → Merges result variables into scope
   → JOB COMPLETED event
   → Triggers ELEMENT_COMPLETING

5. ServiceTaskProcessor.onComplete()
   → Apply output variable mappings
   → ELEMENT_COMPLETED event

6. BpmnStateTransitionBehavior
   → Take outgoing sequence flows
   → SEQUENCE_FLOW_TAKEN event
   → Activate next element
```

### 4.4 Gateway Mechanics

#### Exclusive Gateway
- Evaluates outgoing sequence flow conditions via FEEL (`evaluateBooleanExpression()`)
- Takes **first** condition that evaluates to `true`
- Falls back to default flow if no conditions match
- Raises incident if no path can be taken

#### Parallel Gateway (Fork)
- No condition evaluation
- Immediately activates **all** outgoing sequence flows
- Creates one token per outgoing flow

#### Parallel Gateway (Join)
- Tracks incoming tokens via `activeSequenceFlows` counter on ElementInstance
- Waits until all incoming flows have arrived
- Then transitions through ACTIVATING → ACTIVATED → COMPLETING → COMPLETED in one step
- Takes all outgoing flows (fork again if multiple)

#### Inclusive Gateway
- Evaluates **all** outgoing conditions (not just first)
- Takes **all** flows where condition is `true`, plus default if none match
- Join: waits for all active incoming tokens

#### Event-Based Gateway
- Subscribes to all attached events (message, timer, signal)
- Stays in ACTIVATED state waiting
- First triggered event wins → takes that path
- Unsubscribes from all other events

### 4.5 Message Correlation

```
1. Process deploys with message catch event
   → Creates MessageSubscription (messageName + correlationKey)
   → Stored in MESSAGE_SUBSCRIPTION column family

2. External system publishes message
   → MESSAGE PUBLISH command
   → MessageCorrelationProcessor matches by (name, correlationKey, tenantId)
   → If matched: MESSAGE CORRELATED event → triggers catch element
   → If unmatched: buffered with TTL for late-arriving subscriptions

3. Correlation key extracted via FEEL expression from process variables
```

### 4.6 Timer Events

```
1. Timer event activated
   → TimerInstance created with dueDate
   → Stored in TIMER_DUE_DATES index (sorted by due date)

2. DueDateTimerCheckScheduler (periodic scan)
   → Queries TIMER_DUE_DATES for expired entries
   → Emits TIMER TRIGGER command for each

3. TimerTriggerProcessor
   → Fires timer → activates attached element
   → For repeating timers: creates new TimerInstance with next due date
```

---

## 5. TypeScript Implementation Considerations

### What to Keep
- **Event sourcing pattern** — append-only log + state derived from events
- **Processor/Applier separation** — processors produce events, appliers mutate state
- **Element lifecycle state machine** — the 6-state model is well-proven
- **Behavior composition** — keeps element processors simple and focused
- **Hierarchical variable scoping** — essential for sub-processes and call activities
- **Intent-based protocol** — typed enums for every possible action

### What to Simplify
- **No Raft consensus** — unless building a distributed system
- **No SBE encoding** — use JSON or protobuf; SBE is for ultra-low-latency Java
- **No RocksDB** — use SQLite, LevelDB, or in-memory Map structures
- **No actor model** — use async/await with a single event loop (Node.js is already single-threaded)
- **No partitioning** — unless horizontal scaling is needed

### Suggested TypeScript Architecture

```typescript
// Core abstractions
interface RecordLog {
  append(record: Record): Promise<number>;  // returns position
  read(fromPosition: number): AsyncIterable<Record>;
}

interface StateStore {
  get<T>(columnFamily: string, key: Buffer): T | undefined;
  put<T>(columnFamily: string, key: Buffer, value: T): void;
  delete(columnFamily: string, key: Buffer): void;
  transaction<T>(fn: () => T): T;
}

interface ElementProcessor {
  onActivate(element: BpmnElement, context: ExecutionContext): ProcessingResult;
  onComplete(element: BpmnElement, context: ExecutionContext): ProcessingResult;
  onTerminate(element: BpmnElement, context: ExecutionContext): ProcessingResult;
}

interface EventApplier {
  applyState(intent: Intent, record: RecordValue): void;
}

// Processing loop (single-threaded, async)
async function processLoop(log: RecordLog, state: StateStore) {
  for await (const record of log.read(lastProcessedPosition)) {
    if (record.recordType === 'COMMAND') {
      const processor = getProcessor(record.valueType);
      const result = processor.process(record, state);
      for (const event of result.events) {
        await log.append(event);
        applyEvent(event, state);
      }
    } else if (record.recordType === 'EVENT') {
      applyEvent(record, state);
    }
  }
}
```

### Critical Invariants to Preserve
1. **Processors NEVER mutate state directly** — only produce events
2. **Event appliers are the single source of state mutation**
3. **Processing is deterministic** — same log → same state (for replay)
4. **One record at a time** — no concurrent processing within a partition
5. **Follow-up commands** — processors can emit commands that are processed in subsequent iterations
6. **Scope hierarchy** — variables must resolve through parent chain
7. **Element lifecycle is strict** — only valid transitions allowed (see state machine above)
