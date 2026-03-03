/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import type { BpmnGatewayElement, SequenceFlow } from "../gateway/BpmnGatewayElement.js";
import type { BpmnElementContext } from "../processor/BpmnElementContext.js";
import type { GatewayBehaviors } from "../processor/GatewayBehaviors.js";
import { ExclusiveGatewayProcessor } from "../processor/ExclusiveGatewayProcessor.js";
import { ParallelGatewayProcessor } from "../processor/ParallelGatewayProcessor.js";
import { InclusiveGatewayProcessor } from "../processor/InclusiveGatewayProcessor.js";
import { EventBasedGatewayProcessor } from "../processor/EventBasedGatewayProcessor.js";
import { BpmnElementProcessors } from "../processor/BpmnElementProcessors.js";
import { BpmnElementType } from "../types/BpmnElementType.js";
import { isLeft, isRight, left, right } from "../types/Either.js";
import { Failure, ErrorType } from "../processor/Failure.js";
import { TransitionOutcome } from "../processor/TransitionOutcome.js";

// --- Test Helpers ---

function makeContext(
  overrides?: Partial<BpmnElementContext>
): BpmnElementContext {
  return {
    elementInstanceKey: 1,
    flowScopeKey: 0,
    processInstanceKey: 100,
    processDefinitionKey: 200,
    elementId: "Gateway_1",
    bpmnProcessId: "test-process",
    ...overrides,
  };
}

function makeFlow(overrides?: Partial<SequenceFlow>): SequenceFlow {
  return {
    flowId: "Flow_1",
    targetElementId: "Task_1",
    hasCondition: false,
    ...overrides,
  };
}

function makeGateway(
  overrides?: Partial<BpmnGatewayElement>
): BpmnGatewayElement {
  return {
    elementId: "Gateway_1",
    outgoingFlows: [],
    ...overrides,
  };
}

function makeMockBehaviors(): GatewayBehaviors & {
  calls: string[];
  takenFlows: SequenceFlow[];
  conditionResults: Map<string, boolean>;
} {
  const calls: string[] = [];
  const takenFlows: SequenceFlow[] = [];
  const conditionResults = new Map<string, boolean>();

  return {
    calls,
    takenFlows,
    conditionResults,
    completeElement: vi.fn(() => {
      calls.push("completeElement");
    }),
    takeSequenceFlow: vi.fn((flow: SequenceFlow) => {
      calls.push(`takeSequenceFlow:${flow.flowId}`);
      takenFlows.push(flow);
    }),
    takeAllOutgoingFlows: vi.fn(() => {
      calls.push("takeAllOutgoingFlows");
    }),
    evaluateCondition: vi.fn((flow: SequenceFlow) => {
      calls.push(`evaluateCondition:${flow.flowId}`);
      const result = conditionResults.get(flow.flowId);
      if (result === undefined) {
        return right(false);
      }
      return right(result);
    }),
    subscribeToEvents: vi.fn(() => {
      calls.push("subscribeToEvents");
      return right(undefined);
    }),
    unsubscribeFromEvents: vi.fn(() => {
      calls.push("unsubscribeFromEvents");
    }),
    activateTriggeredEvent: vi.fn(() => {
      calls.push("activateTriggeredEvent");
    }),
  };
}

// --- Tests ---

describe("ExclusiveGatewayProcessor", () => {
  let behaviors: ReturnType<typeof makeMockBehaviors>;
  let processor: ExclusiveGatewayProcessor;
  let context: BpmnElementContext;

  beforeEach(() => {
    behaviors = makeMockBehaviors();
    processor = new ExclusiveGatewayProcessor(behaviors);
    context = makeContext();
  });

  describe("onActivate", () => {
    it("should return success (no-op)", () => {
      const result = processor.onActivate(makeGateway(), context);
      expect(isRight(result)).toBe(true);
    });
  });

  describe("finalizeActivation", () => {
    it("should take the single unconditional flow directly", () => {
      const flow = makeFlow({ flowId: "Flow_1", hasCondition: false });
      const gateway = makeGateway({ outgoingFlows: [flow] });

      const result = processor.finalizeActivation(gateway, context);

      expect(isRight(result)).toBe(true);
      expect(behaviors.completeElement).toHaveBeenCalledWith(context);
      expect(behaviors.takeSequenceFlow).toHaveBeenCalledWith(flow, context);
      expect(behaviors.evaluateCondition).not.toHaveBeenCalled();
    });

    it("should evaluate conditions and take the first matching flow", () => {
      const flow1 = makeFlow({ flowId: "Flow_1", targetElementId: "Task_1", hasCondition: true });
      const flow2 = makeFlow({ flowId: "Flow_2", targetElementId: "Task_2", hasCondition: true });
      const gateway = makeGateway({ outgoingFlows: [flow1, flow2] });

      behaviors.conditionResults.set("Flow_1", false);
      behaviors.conditionResults.set("Flow_2", true);

      const result = processor.finalizeActivation(gateway, context);

      expect(isRight(result)).toBe(true);
      expect(behaviors.takenFlows).toHaveLength(1);
      expect(behaviors.takenFlows[0].flowId).toBe("Flow_2");
    });

    it("should short-circuit on first matching condition", () => {
      const flow1 = makeFlow({ flowId: "Flow_1", hasCondition: true });
      const flow2 = makeFlow({ flowId: "Flow_2", hasCondition: true });
      const gateway = makeGateway({ outgoingFlows: [flow1, flow2] });

      behaviors.conditionResults.set("Flow_1", true);
      behaviors.conditionResults.set("Flow_2", true);

      const result = processor.finalizeActivation(gateway, context);

      expect(isRight(result)).toBe(true);
      expect(behaviors.takenFlows).toHaveLength(1);
      expect(behaviors.takenFlows[0].flowId).toBe("Flow_1");
      // Flow_2 should not have been evaluated
      expect(behaviors.calls.filter((c) => c === "evaluateCondition:Flow_2")).toHaveLength(0);
    });

    it("should take the default flow when no condition is fulfilled", () => {
      const flow1 = makeFlow({ flowId: "Flow_1", hasCondition: true });
      const defaultFlow = makeFlow({ flowId: "Flow_Default", hasCondition: false });
      const gateway = makeGateway({
        outgoingFlows: [flow1, defaultFlow],
        defaultFlowId: "Flow_Default",
      });

      behaviors.conditionResults.set("Flow_1", false);

      const result = processor.finalizeActivation(gateway, context);

      expect(isRight(result)).toBe(true);
      expect(behaviors.takenFlows).toHaveLength(1);
      expect(behaviors.takenFlows[0].flowId).toBe("Flow_Default");
    });

    it("should skip the default flow during condition evaluation", () => {
      const flow1 = makeFlow({ flowId: "Flow_1", hasCondition: true });
      const defaultFlow = makeFlow({ flowId: "Flow_Default", hasCondition: true });
      const gateway = makeGateway({
        outgoingFlows: [defaultFlow, flow1],
        defaultFlowId: "Flow_Default",
      });

      behaviors.conditionResults.set("Flow_1", true);
      behaviors.conditionResults.set("Flow_Default", true);

      const result = processor.finalizeActivation(gateway, context);

      expect(isRight(result)).toBe(true);
      expect(behaviors.takenFlows).toHaveLength(1);
      expect(behaviors.takenFlows[0].flowId).toBe("Flow_1");
      expect(behaviors.calls.filter((c) => c === "evaluateCondition:Flow_Default")).toHaveLength(0);
    });

    it("should return CONDITION_ERROR when no condition fulfilled and no default flow", () => {
      const flow1 = makeFlow({ flowId: "Flow_1", hasCondition: true });
      const flow2 = makeFlow({ flowId: "Flow_2", hasCondition: true });
      const gateway = makeGateway({ outgoingFlows: [flow1, flow2] });

      behaviors.conditionResults.set("Flow_1", false);
      behaviors.conditionResults.set("Flow_2", false);

      const result = processor.finalizeActivation(gateway, context);

      expect(isLeft(result)).toBe(true);
      if (isLeft(result)) {
        expect(result.value.errorType).toBe(ErrorType.CONDITION_ERROR);
        expect(result.value.message).toContain("Expected at least one condition");
      }
    });

    it("should propagate condition evaluation failure", () => {
      const flow1 = makeFlow({ flowId: "Flow_1", hasCondition: true });
      const gateway = makeGateway({ outgoingFlows: [flow1] });

      const failure = new Failure("Bad expression", ErrorType.CONDITION_ERROR);
      behaviors.evaluateCondition = vi.fn(() => left(failure));

      const result = processor.finalizeActivation(gateway, context);

      expect(isLeft(result)).toBe(true);
      if (isLeft(result)) {
        expect(result.value.message).toBe("Bad expression");
      }
    });

    it("should handle implicit end (no outgoing flows)", () => {
      const gateway = makeGateway({ outgoingFlows: [] });

      const result = processor.finalizeActivation(gateway, context);

      expect(isRight(result)).toBe(true);
      expect(behaviors.completeElement).toHaveBeenCalled();
      expect(behaviors.takeSequenceFlow).not.toHaveBeenCalled();
    });
  });

  describe("finalizeCompletion", () => {
    it("should return failure (exclusive gateways complete during activation)", () => {
      const gateway = makeGateway();

      const result = processor.finalizeCompletion(gateway, context);

      expect(isLeft(result)).toBe(true);
      if (isLeft(result)) {
        expect(result.value.message).toContain("no wait state");
      }
    });
  });

  describe("onTerminate", () => {
    it("should return CONTINUE", () => {
      const outcome = processor.onTerminate(makeGateway(), context);
      expect(outcome).toBe(TransitionOutcome.CONTINUE);
    });
  });

  describe("finalizeTermination", () => {
    it("should be a no-op", () => {
      processor.finalizeTermination(makeGateway(), context);
      expect(behaviors.calls).toHaveLength(0);
    });
  });

  describe("registry", () => {
    it("should be registerable as EXCLUSIVE_GATEWAY processor", () => {
      const registry = new BpmnElementProcessors();
      registry.register(BpmnElementType.EXCLUSIVE_GATEWAY, processor);
      expect(registry.hasProcessor(BpmnElementType.EXCLUSIVE_GATEWAY)).toBe(true);
      expect(registry.getProcessor(BpmnElementType.EXCLUSIVE_GATEWAY)).toBe(processor);
    });
  });
});

describe("ParallelGatewayProcessor", () => {
  let behaviors: ReturnType<typeof makeMockBehaviors>;
  let processor: ParallelGatewayProcessor;
  let context: BpmnElementContext;

  beforeEach(() => {
    behaviors = makeMockBehaviors();
    processor = new ParallelGatewayProcessor(behaviors);
    context = makeContext();
  });

  describe("onActivate", () => {
    it("should return success (no-op)", () => {
      const result = processor.onActivate(makeGateway(), context);
      expect(isRight(result)).toBe(true);
    });
  });

  describe("finalizeActivation", () => {
    it("should complete immediately and take all outgoing flows", () => {
      const flow1 = makeFlow({ flowId: "Flow_1" });
      const flow2 = makeFlow({ flowId: "Flow_2" });
      const flow3 = makeFlow({ flowId: "Flow_3" });
      const gateway = makeGateway({ outgoingFlows: [flow1, flow2, flow3] });

      const result = processor.finalizeActivation(gateway, context);

      expect(isRight(result)).toBe(true);
      expect(behaviors.completeElement).toHaveBeenCalledWith(context);
      expect(behaviors.takeAllOutgoingFlows).toHaveBeenCalledWith(gateway, context);
    });

    it("should complete and fork even with no outgoing flows", () => {
      const gateway = makeGateway({ outgoingFlows: [] });

      const result = processor.finalizeActivation(gateway, context);

      expect(isRight(result)).toBe(true);
      expect(behaviors.completeElement).toHaveBeenCalled();
      expect(behaviors.takeAllOutgoingFlows).toHaveBeenCalled();
    });

    it("should not evaluate any conditions", () => {
      const flow1 = makeFlow({ flowId: "Flow_1" });
      const gateway = makeGateway({ outgoingFlows: [flow1] });

      processor.finalizeActivation(gateway, context);

      expect(behaviors.evaluateCondition).not.toHaveBeenCalled();
    });

    it("should call completeElement before takeAllOutgoingFlows", () => {
      const gateway = makeGateway({ outgoingFlows: [makeFlow()] });

      processor.finalizeActivation(gateway, context);

      const completeIdx = behaviors.calls.indexOf("completeElement");
      const forkIdx = behaviors.calls.indexOf("takeAllOutgoingFlows");
      expect(completeIdx).toBeLessThan(forkIdx);
    });
  });

  describe("finalizeCompletion", () => {
    it("should return failure (parallel gateways complete during activation)", () => {
      const gateway = makeGateway();

      const result = processor.finalizeCompletion(gateway, context);

      expect(isLeft(result)).toBe(true);
      if (isLeft(result)) {
        expect(result.value.message).toContain("already been completed on processing activate");
      }
    });
  });

  describe("onTerminate", () => {
    it("should return CONTINUE", () => {
      const outcome = processor.onTerminate(makeGateway(), context);
      expect(outcome).toBe(TransitionOutcome.CONTINUE);
    });
  });

  describe("finalizeTermination", () => {
    it("should be a no-op", () => {
      processor.finalizeTermination(makeGateway(), context);
      expect(behaviors.calls).toHaveLength(0);
    });
  });

  describe("registry", () => {
    it("should be registerable as PARALLEL_GATEWAY processor", () => {
      const registry = new BpmnElementProcessors();
      registry.register(BpmnElementType.PARALLEL_GATEWAY, processor);
      expect(registry.hasProcessor(BpmnElementType.PARALLEL_GATEWAY)).toBe(true);
    });
  });
});

describe("InclusiveGatewayProcessor", () => {
  let behaviors: ReturnType<typeof makeMockBehaviors>;
  let processor: InclusiveGatewayProcessor;
  let context: BpmnElementContext;

  beforeEach(() => {
    behaviors = makeMockBehaviors();
    processor = new InclusiveGatewayProcessor(behaviors);
    context = makeContext();
  });

  describe("onActivate", () => {
    it("should return success (no-op)", () => {
      const result = processor.onActivate(makeGateway(), context);
      expect(isRight(result)).toBe(true);
    });
  });

  describe("finalizeActivation", () => {
    it("should take the single unconditional flow directly", () => {
      const flow = makeFlow({ flowId: "Flow_1", hasCondition: false });
      const gateway = makeGateway({ outgoingFlows: [flow] });

      const result = processor.finalizeActivation(gateway, context);

      expect(isRight(result)).toBe(true);
      expect(behaviors.completeElement).toHaveBeenCalled();
      expect(behaviors.takenFlows).toHaveLength(1);
      expect(behaviors.takenFlows[0].flowId).toBe("Flow_1");
    });

    it("should take ALL flows whose conditions evaluate to true", () => {
      const flow1 = makeFlow({ flowId: "Flow_1", hasCondition: true });
      const flow2 = makeFlow({ flowId: "Flow_2", hasCondition: true });
      const flow3 = makeFlow({ flowId: "Flow_3", hasCondition: true });
      const gateway = makeGateway({ outgoingFlows: [flow1, flow2, flow3] });

      behaviors.conditionResults.set("Flow_1", true);
      behaviors.conditionResults.set("Flow_2", false);
      behaviors.conditionResults.set("Flow_3", true);

      const result = processor.finalizeActivation(gateway, context);

      expect(isRight(result)).toBe(true);
      expect(behaviors.takenFlows).toHaveLength(2);
      expect(behaviors.takenFlows[0].flowId).toBe("Flow_1");
      expect(behaviors.takenFlows[1].flowId).toBe("Flow_3");
    });

    it("should take all matching flows when ALL conditions are true", () => {
      const flow1 = makeFlow({ flowId: "Flow_1", hasCondition: true });
      const flow2 = makeFlow({ flowId: "Flow_2", hasCondition: true });
      const gateway = makeGateway({ outgoingFlows: [flow1, flow2] });

      behaviors.conditionResults.set("Flow_1", true);
      behaviors.conditionResults.set("Flow_2", true);

      const result = processor.finalizeActivation(gateway, context);

      expect(isRight(result)).toBe(true);
      // Both flows should be taken (unlike exclusive which takes only the first)
      expect(behaviors.takenFlows).toHaveLength(2);
    });

    it("should take the default flow when no condition is fulfilled", () => {
      const flow1 = makeFlow({ flowId: "Flow_1", hasCondition: true });
      const defaultFlow = makeFlow({ flowId: "Flow_Default", hasCondition: false });
      const gateway = makeGateway({
        outgoingFlows: [flow1, defaultFlow],
        defaultFlowId: "Flow_Default",
      });

      behaviors.conditionResults.set("Flow_1", false);

      const result = processor.finalizeActivation(gateway, context);

      expect(isRight(result)).toBe(true);
      expect(behaviors.takenFlows).toHaveLength(1);
      expect(behaviors.takenFlows[0].flowId).toBe("Flow_Default");
    });

    it("should skip the default flow during condition evaluation", () => {
      const flow1 = makeFlow({ flowId: "Flow_1", hasCondition: true });
      const defaultFlow = makeFlow({ flowId: "Flow_Default", hasCondition: true });
      const gateway = makeGateway({
        outgoingFlows: [defaultFlow, flow1],
        defaultFlowId: "Flow_Default",
      });

      behaviors.conditionResults.set("Flow_1", true);
      behaviors.conditionResults.set("Flow_Default", true);

      const result = processor.finalizeActivation(gateway, context);

      expect(isRight(result)).toBe(true);
      // Only Flow_1 should be taken (default is skipped during evaluation)
      expect(behaviors.takenFlows).toHaveLength(1);
      expect(behaviors.takenFlows[0].flowId).toBe("Flow_1");
    });

    it("should return CONDITION_ERROR when no condition fulfilled and no default flow", () => {
      const flow1 = makeFlow({ flowId: "Flow_1", hasCondition: true });
      const gateway = makeGateway({ outgoingFlows: [flow1] });

      behaviors.conditionResults.set("Flow_1", false);

      const result = processor.finalizeActivation(gateway, context);

      expect(isLeft(result)).toBe(true);
      if (isLeft(result)) {
        expect(result.value.errorType).toBe(ErrorType.CONDITION_ERROR);
        expect(result.value.message).toContain("Expected at least one condition");
      }
    });

    it("should propagate condition evaluation failure", () => {
      const flow1 = makeFlow({ flowId: "Flow_1", hasCondition: true });
      const gateway = makeGateway({ outgoingFlows: [flow1] });

      const failure = new Failure("Bad expression", ErrorType.CONDITION_ERROR);
      behaviors.evaluateCondition = vi.fn(() => left(failure));

      const result = processor.finalizeActivation(gateway, context);

      expect(isLeft(result)).toBe(true);
      if (isLeft(result)) {
        expect(result.value.message).toBe("Bad expression");
      }
    });

    it("should handle implicit end (no outgoing flows)", () => {
      const gateway = makeGateway({ outgoingFlows: [] });

      const result = processor.finalizeActivation(gateway, context);

      expect(isRight(result)).toBe(true);
      expect(behaviors.completeElement).toHaveBeenCalled();
      expect(behaviors.takeSequenceFlow).not.toHaveBeenCalled();
    });

    it("should not take default flow when matching conditions exist", () => {
      const flow1 = makeFlow({ flowId: "Flow_1", hasCondition: true });
      const defaultFlow = makeFlow({ flowId: "Flow_Default", hasCondition: false });
      const gateway = makeGateway({
        outgoingFlows: [flow1, defaultFlow],
        defaultFlowId: "Flow_Default",
      });

      behaviors.conditionResults.set("Flow_1", true);

      const result = processor.finalizeActivation(gateway, context);

      expect(isRight(result)).toBe(true);
      expect(behaviors.takenFlows).toHaveLength(1);
      expect(behaviors.takenFlows[0].flowId).toBe("Flow_1");
    });
  });

  describe("finalizeCompletion", () => {
    it("should return failure (inclusive gateways complete during activation)", () => {
      const gateway = makeGateway();

      const result = processor.finalizeCompletion(gateway, context);

      expect(isLeft(result)).toBe(true);
      if (isLeft(result)) {
        expect(result.value.message).toContain("no wait state");
      }
    });
  });

  describe("onTerminate", () => {
    it("should return CONTINUE", () => {
      const outcome = processor.onTerminate(makeGateway(), context);
      expect(outcome).toBe(TransitionOutcome.CONTINUE);
    });
  });

  describe("finalizeTermination", () => {
    it("should be a no-op", () => {
      processor.finalizeTermination(makeGateway(), context);
      expect(behaviors.calls).toHaveLength(0);
    });
  });

  describe("registry", () => {
    it("should be registerable as INCLUSIVE_GATEWAY processor", () => {
      const registry = new BpmnElementProcessors();
      registry.register(BpmnElementType.INCLUSIVE_GATEWAY, processor);
      expect(registry.hasProcessor(BpmnElementType.INCLUSIVE_GATEWAY)).toBe(true);
    });
  });
});

describe("EventBasedGatewayProcessor", () => {
  let behaviors: ReturnType<typeof makeMockBehaviors>;
  let processor: EventBasedGatewayProcessor;
  let context: BpmnElementContext;

  beforeEach(() => {
    behaviors = makeMockBehaviors();
    processor = new EventBasedGatewayProcessor(behaviors);
    context = makeContext();
  });

  describe("onActivate", () => {
    it("should return success (no-op)", () => {
      const result = processor.onActivate(makeGateway(), context);
      expect(isRight(result)).toBe(true);
    });
  });

  describe("finalizeActivation", () => {
    it("should subscribe to events (wait state)", () => {
      const gateway = makeGateway();

      const result = processor.finalizeActivation(gateway, context);

      expect(isRight(result)).toBe(true);
      expect(behaviors.subscribeToEvents).toHaveBeenCalledWith(gateway, context);
    });

    it("should propagate subscription failure", () => {
      const gateway = makeGateway();
      const failure = new Failure("Subscription failed", ErrorType.UNKNOWN);
      behaviors.subscribeToEvents = vi.fn(() => left(failure));

      const result = processor.finalizeActivation(gateway, context);

      expect(isLeft(result)).toBe(true);
      if (isLeft(result)) {
        expect(result.value.message).toBe("Subscription failed");
      }
    });

    it("should not complete the element (remains as wait state)", () => {
      const gateway = makeGateway();

      processor.finalizeActivation(gateway, context);

      expect(behaviors.completeElement).not.toHaveBeenCalled();
    });
  });

  describe("onComplete", () => {
    it("should unsubscribe from events", () => {
      const result = processor.onComplete(makeGateway(), context);

      expect(isRight(result)).toBe(true);
      expect(behaviors.unsubscribeFromEvents).toHaveBeenCalledWith(context);
    });
  });

  describe("finalizeCompletion", () => {
    it("should activate the triggered event", () => {
      const gateway = makeGateway();

      const result = processor.finalizeCompletion(gateway, context);

      expect(isRight(result)).toBe(true);
      expect(behaviors.activateTriggeredEvent).toHaveBeenCalledWith(context);
    });

    it("should not take any sequence flows (per BPMN spec)", () => {
      const flow1 = makeFlow({ flowId: "Flow_1" });
      const gateway = makeGateway({ outgoingFlows: [flow1] });

      processor.finalizeCompletion(gateway, context);

      expect(behaviors.takeSequenceFlow).not.toHaveBeenCalled();
      expect(behaviors.takeAllOutgoingFlows).not.toHaveBeenCalled();
    });
  });

  describe("onTerminate", () => {
    it("should unsubscribe from events and return CONTINUE", () => {
      const outcome = processor.onTerminate(makeGateway(), context);

      expect(outcome).toBe(TransitionOutcome.CONTINUE);
      expect(behaviors.unsubscribeFromEvents).toHaveBeenCalledWith(context);
    });
  });

  describe("finalizeTermination", () => {
    it("should be a no-op", () => {
      processor.finalizeTermination(makeGateway(), context);
      expect(behaviors.calls).toHaveLength(0);
    });
  });

  describe("registry", () => {
    it("should be registerable as EVENT_BASED_GATEWAY processor", () => {
      const registry = new BpmnElementProcessors();
      registry.register(BpmnElementType.EVENT_BASED_GATEWAY, processor);
      expect(registry.hasProcessor(BpmnElementType.EVENT_BASED_GATEWAY)).toBe(true);
    });
  });

  describe("lifecycle order", () => {
    it("should follow activation → completion lifecycle for event-based gateway", () => {
      const gateway = makeGateway();

      // Phase 1: Activation
      processor.onActivate(gateway, context);
      processor.finalizeActivation(gateway, context);
      expect(behaviors.calls).toEqual(["subscribeToEvents"]);

      behaviors.calls.length = 0;

      // Phase 2: Completion (triggered by event)
      processor.onComplete(gateway, context);
      processor.finalizeCompletion(gateway, context);
      expect(behaviors.calls).toEqual(["unsubscribeFromEvents", "activateTriggeredEvent"]);
    });
  });
});

describe("Gateway processor registry integration", () => {
  it("should register all four gateway processors", () => {
    const behaviors = makeMockBehaviors();
    const registry = new BpmnElementProcessors();

    registry.register(BpmnElementType.EXCLUSIVE_GATEWAY, new ExclusiveGatewayProcessor(behaviors));
    registry.register(BpmnElementType.PARALLEL_GATEWAY, new ParallelGatewayProcessor(behaviors));
    registry.register(BpmnElementType.INCLUSIVE_GATEWAY, new InclusiveGatewayProcessor(behaviors));
    registry.register(BpmnElementType.EVENT_BASED_GATEWAY, new EventBasedGatewayProcessor(behaviors));

    const types = registry.registeredTypes();
    expect(types.has(BpmnElementType.EXCLUSIVE_GATEWAY)).toBe(true);
    expect(types.has(BpmnElementType.PARALLEL_GATEWAY)).toBe(true);
    expect(types.has(BpmnElementType.INCLUSIVE_GATEWAY)).toBe(true);
    expect(types.has(BpmnElementType.EVENT_BASED_GATEWAY)).toBe(true);
    expect(types.size).toBe(4);
  });
});
