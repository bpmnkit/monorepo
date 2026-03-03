/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { BpmnEventDefinitionType } from "../event/BpmnEventDefinitionType.js";
import type { BpmnEventElement } from "../event/BpmnEventElement.js";
import type { BpmnElementContext } from "../processor/BpmnElementContext.js";
import type { EventBehaviors } from "../processor/EventBehaviors.js";
import { StartEventProcessor } from "../processor/StartEventProcessor.js";
import { EndEventProcessor } from "../processor/EndEventProcessor.js";
import { IntermediateCatchEventProcessor } from "../processor/IntermediateCatchEventProcessor.js";
import { IntermediateThrowEventProcessor } from "../processor/IntermediateThrowEventProcessor.js";
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
    elementId: "Event_1",
    bpmnProcessId: "test-process",
    ...overrides,
  };
}

function makeEvent(
  overrides?: Partial<BpmnEventElement>
): BpmnEventElement {
  return {
    elementId: "Event_1",
    eventDefinitionType: BpmnEventDefinitionType.NONE,
    ...overrides,
  };
}

function makeMockBehaviors(): EventBehaviors & {
  calls: string[];
} {
  const calls: string[] = [];
  return {
    calls,
    completeElement: vi.fn(() => {
      calls.push("completeElement");
    }),
    takeOutgoingSequenceFlows: vi.fn(() => {
      calls.push("takeOutgoingSequenceFlows");
    }),
    activateElement: vi.fn((_targetId: string) => {
      calls.push("activateElement");
    }),
    subscribeToEvents: vi.fn(() => {
      calls.push("subscribeToEvents");
      return right(undefined);
    }),
    unsubscribeFromEvents: vi.fn(() => {
      calls.push("unsubscribeFromEvents");
    }),
    throwErrorEvent: vi.fn((_errorCode: string) => {
      calls.push("throwErrorEvent");
      return right(undefined);
    }),
    terminateChildInstances: vi.fn(() => {
      calls.push("terminateChildInstances");
    }),
  };
}

// --- Tests ---

describe("StartEventProcessor", () => {
  let behaviors: ReturnType<typeof makeMockBehaviors>;
  let processor: StartEventProcessor;
  const ctx = makeContext();

  beforeEach(() => {
    behaviors = makeMockBehaviors();
    processor = new StartEventProcessor(behaviors);
  });

  describe("Activation", () => {
    it("should return success from onActivate", () => {
      const result = processor.onActivate(makeEvent(), ctx);
      expect(isRight(result)).toBe(true);
    });

    it("should call completeElement on finalizeActivation", () => {
      const result = processor.finalizeActivation(makeEvent(), ctx);
      expect(isRight(result)).toBe(true);
      expect(behaviors.completeElement).toHaveBeenCalledWith(ctx);
    });
  });

  describe("Completion", () => {
    it("should return success from onComplete", () => {
      const result = processor.onComplete(makeEvent(), ctx);
      expect(isRight(result)).toBe(true);
    });

    it("should take outgoing sequence flows on finalizeCompletion", () => {
      const element = makeEvent();
      const result = processor.finalizeCompletion(element, ctx);
      expect(isRight(result)).toBe(true);
      expect(behaviors.takeOutgoingSequenceFlows).toHaveBeenCalledWith(
        element,
        ctx
      );
    });
  });

  describe("Termination", () => {
    it("should return CONTINUE from onTerminate", () => {
      const outcome = processor.onTerminate(makeEvent(), ctx);
      expect(outcome).toBe(TransitionOutcome.CONTINUE);
    });

    it("should not throw from finalizeTermination", () => {
      expect(() =>
        processor.finalizeTermination(makeEvent(), ctx)
      ).not.toThrow();
    });
  });

  describe("Registration", () => {
    it("should be registerable for START_EVENT type", () => {
      const registry = new BpmnElementProcessors();
      registry.register(BpmnElementType.START_EVENT, processor);
      expect(registry.hasProcessor(BpmnElementType.START_EVENT)).toBe(true);
      expect(registry.getProcessor(BpmnElementType.START_EVENT)).toBe(
        processor
      );
    });
  });
});

describe("EndEventProcessor", () => {
  let behaviors: ReturnType<typeof makeMockBehaviors>;
  let processor: EndEventProcessor;
  const ctx = makeContext();

  beforeEach(() => {
    behaviors = makeMockBehaviors();
    processor = new EndEventProcessor(behaviors);
  });

  describe("NoneEndEvent", () => {
    const noneEvent = makeEvent({
      eventDefinitionType: BpmnEventDefinitionType.NONE,
    });

    it("should return success from onActivate", () => {
      const result = processor.onActivate(noneEvent, ctx);
      expect(isRight(result)).toBe(true);
    });

    it("should call completeElement on finalizeActivation", () => {
      const result = processor.finalizeActivation(noneEvent, ctx);
      expect(isRight(result)).toBe(true);
      expect(behaviors.completeElement).toHaveBeenCalledWith(ctx);
    });

    it("should return success from onComplete", () => {
      const result = processor.onComplete(noneEvent, ctx);
      expect(isRight(result)).toBe(true);
    });

    it("should take outgoing sequence flows on finalizeCompletion", () => {
      const result = processor.finalizeCompletion(noneEvent, ctx);
      expect(isRight(result)).toBe(true);
      expect(behaviors.takeOutgoingSequenceFlows).toHaveBeenCalledWith(
        noneEvent,
        ctx
      );
    });
  });

  describe("ErrorEndEvent", () => {
    const errorEvent = makeEvent({
      eventDefinitionType: BpmnEventDefinitionType.ERROR,
      errorCode: "ERR_PAYMENT",
    });

    it("should throw error event on finalizeActivation", () => {
      const result = processor.finalizeActivation(errorEvent, ctx);
      expect(isRight(result)).toBe(true);
      expect(behaviors.throwErrorEvent).toHaveBeenCalledWith(
        "ERR_PAYMENT",
        ctx
      );
    });

    it("should fail if error code is missing", () => {
      const noCodeEvent = makeEvent({
        eventDefinitionType: BpmnEventDefinitionType.ERROR,
      });
      const result = processor.finalizeActivation(noCodeEvent, ctx);
      expect(isLeft(result)).toBe(true);
      if (isLeft(result)) {
        expect(result.value.message).toContain("error code");
        expect(result.value.errorType).toBe(
          ErrorType.UNHANDLED_ERROR_EVENT
        );
      }
    });

    it("should propagate throwErrorEvent failure", () => {
      const failingBehaviors = makeMockBehaviors();
      failingBehaviors.throwErrorEvent = vi.fn(() =>
        left(new Failure("No matching catch event", ErrorType.UNHANDLED_ERROR_EVENT))
      );
      const failProcessor = new EndEventProcessor(failingBehaviors);

      const result = failProcessor.finalizeActivation(errorEvent, ctx);
      expect(isLeft(result)).toBe(true);
      if (isLeft(result)) {
        expect(result.value.message).toContain("No matching catch event");
      }
    });
  });

  describe("TerminateEndEvent", () => {
    const terminateEvent = makeEvent({
      eventDefinitionType: BpmnEventDefinitionType.TERMINATE,
    });

    it("should call completeElement on finalizeActivation", () => {
      const result = processor.finalizeActivation(terminateEvent, ctx);
      expect(isRight(result)).toBe(true);
      expect(behaviors.completeElement).toHaveBeenCalledWith(ctx);
    });

    it("should terminate child instances on finalizeCompletion", () => {
      const result = processor.finalizeCompletion(terminateEvent, ctx);
      expect(isRight(result)).toBe(true);
      expect(behaviors.terminateChildInstances).toHaveBeenCalledWith(ctx);
    });

    it("should NOT take outgoing sequence flows", () => {
      processor.finalizeCompletion(terminateEvent, ctx);
      expect(behaviors.takeOutgoingSequenceFlows).not.toHaveBeenCalled();
    });
  });

  describe("CommonTermination", () => {
    it("should return CONTINUE from onTerminate for none end event", () => {
      const outcome = processor.onTerminate(
        makeEvent({ eventDefinitionType: BpmnEventDefinitionType.NONE }),
        ctx
      );
      expect(outcome).toBe(TransitionOutcome.CONTINUE);
    });

    it("should return CONTINUE from onTerminate for error end event", () => {
      const outcome = processor.onTerminate(
        makeEvent({ eventDefinitionType: BpmnEventDefinitionType.ERROR, errorCode: "E" }),
        ctx
      );
      expect(outcome).toBe(TransitionOutcome.CONTINUE);
    });

    it("should return CONTINUE from onTerminate for terminate end event", () => {
      const outcome = processor.onTerminate(
        makeEvent({ eventDefinitionType: BpmnEventDefinitionType.TERMINATE }),
        ctx
      );
      expect(outcome).toBe(TransitionOutcome.CONTINUE);
    });
  });

  describe("UnsupportedType", () => {
    it("should throw for unsupported event definition types", () => {
      const signalEvent = makeEvent({
        eventDefinitionType: BpmnEventDefinitionType.SIGNAL,
      });
      expect(() => processor.onActivate(signalEvent, ctx)).toThrow(
        "Unsupported end event definition type"
      );
    });
  });

  describe("Registration", () => {
    it("should be registerable for END_EVENT type", () => {
      const registry = new BpmnElementProcessors();
      registry.register(BpmnElementType.END_EVENT, processor);
      expect(registry.hasProcessor(BpmnElementType.END_EVENT)).toBe(true);
    });
  });
});

describe("IntermediateCatchEventProcessor", () => {
  let behaviors: ReturnType<typeof makeMockBehaviors>;
  let processor: IntermediateCatchEventProcessor;
  const ctx = makeContext();

  beforeEach(() => {
    behaviors = makeMockBehaviors();
    processor = new IntermediateCatchEventProcessor(behaviors);
  });

  describe("DefaultCatchEvent (message/timer/signal)", () => {
    const messageEvent = makeEvent({
      eventDefinitionType: BpmnEventDefinitionType.MESSAGE,
      messageName: "order-received",
      correlationKey: "order-123",
    });

    const timerEvent = makeEvent({
      eventDefinitionType: BpmnEventDefinitionType.TIMER,
      timerDefinition: { type: "DURATION" as any, value: "PT30S" },
    });

    it("should return success from onActivate", () => {
      const result = processor.onActivate(messageEvent, ctx);
      expect(isRight(result)).toBe(true);
    });

    it("should subscribe to events on finalizeActivation", () => {
      const result = processor.finalizeActivation(messageEvent, ctx);
      expect(isRight(result)).toBe(true);
      expect(behaviors.subscribeToEvents).toHaveBeenCalledWith(
        messageEvent,
        ctx
      );
    });

    it("should subscribe to timer events on finalizeActivation", () => {
      processor.finalizeActivation(timerEvent, ctx);
      expect(behaviors.subscribeToEvents).toHaveBeenCalledWith(
        timerEvent,
        ctx
      );
    });

    it("should NOT call completeElement on activation (wait state)", () => {
      processor.finalizeActivation(messageEvent, ctx);
      expect(behaviors.completeElement).not.toHaveBeenCalled();
    });

    it("should propagate subscription failure", () => {
      const failingBehaviors = makeMockBehaviors();
      failingBehaviors.subscribeToEvents = vi.fn(() =>
        left(new Failure("Subscription failed", ErrorType.UNKNOWN))
      );
      const failProcessor = new IntermediateCatchEventProcessor(
        failingBehaviors
      );

      const result = failProcessor.finalizeActivation(messageEvent, ctx);
      expect(isLeft(result)).toBe(true);
      if (isLeft(result)) {
        expect(result.value.message).toBe("Subscription failed");
      }
    });
  });

  describe("LinkCatchEvent", () => {
    const linkEvent = makeEvent({
      eventDefinitionType: BpmnEventDefinitionType.LINK,
      linkName: "GoToPayment",
    });

    it("should return success from onActivate", () => {
      const result = processor.onActivate(linkEvent, ctx);
      expect(isRight(result)).toBe(true);
    });

    it("should call completeElement on finalizeActivation (passthrough)", () => {
      const result = processor.finalizeActivation(linkEvent, ctx);
      expect(isRight(result)).toBe(true);
      expect(behaviors.completeElement).toHaveBeenCalledWith(ctx);
    });

    it("should NOT subscribe to events", () => {
      processor.finalizeActivation(linkEvent, ctx);
      expect(behaviors.subscribeToEvents).not.toHaveBeenCalled();
    });
  });

  describe("Completion", () => {
    const event = makeEvent({
      eventDefinitionType: BpmnEventDefinitionType.MESSAGE,
    });

    it("should unsubscribe from events on onComplete", () => {
      const result = processor.onComplete(event, ctx);
      expect(isRight(result)).toBe(true);
      expect(behaviors.unsubscribeFromEvents).toHaveBeenCalledWith(ctx);
    });

    it("should take outgoing sequence flows on finalizeCompletion", () => {
      const result = processor.finalizeCompletion(event, ctx);
      expect(isRight(result)).toBe(true);
      expect(behaviors.takeOutgoingSequenceFlows).toHaveBeenCalledWith(
        event,
        ctx
      );
    });
  });

  describe("Termination", () => {
    const event = makeEvent({
      eventDefinitionType: BpmnEventDefinitionType.TIMER,
    });

    it("should unsubscribe from events and return CONTINUE", () => {
      const outcome = processor.onTerminate(event, ctx);
      expect(outcome).toBe(TransitionOutcome.CONTINUE);
      expect(behaviors.unsubscribeFromEvents).toHaveBeenCalledWith(ctx);
    });

    it("should not throw from finalizeTermination", () => {
      expect(() =>
        processor.finalizeTermination(event, ctx)
      ).not.toThrow();
    });
  });

  describe("Registration", () => {
    it("should be registerable for INTERMEDIATE_CATCH_EVENT type", () => {
      const registry = new BpmnElementProcessors();
      registry.register(
        BpmnElementType.INTERMEDIATE_CATCH_EVENT,
        processor
      );
      expect(
        registry.hasProcessor(BpmnElementType.INTERMEDIATE_CATCH_EVENT)
      ).toBe(true);
    });
  });
});

describe("IntermediateThrowEventProcessor", () => {
  let behaviors: ReturnType<typeof makeMockBehaviors>;
  let processor: IntermediateThrowEventProcessor;
  const ctx = makeContext();

  beforeEach(() => {
    behaviors = makeMockBehaviors();
    processor = new IntermediateThrowEventProcessor(behaviors);
  });

  describe("NoneThrowEvent", () => {
    const noneEvent = makeEvent({
      eventDefinitionType: BpmnEventDefinitionType.NONE,
    });

    it("should return success from onActivate", () => {
      const result = processor.onActivate(noneEvent, ctx);
      expect(isRight(result)).toBe(true);
    });

    it("should call completeElement on finalizeActivation (passthrough)", () => {
      const result = processor.finalizeActivation(noneEvent, ctx);
      expect(isRight(result)).toBe(true);
      expect(behaviors.completeElement).toHaveBeenCalledWith(ctx);
    });

    it("should return success from onComplete", () => {
      const result = processor.onComplete(noneEvent, ctx);
      expect(isRight(result)).toBe(true);
    });

    it("should take outgoing sequence flows on finalizeCompletion", () => {
      const result = processor.finalizeCompletion(noneEvent, ctx);
      expect(isRight(result)).toBe(true);
      expect(behaviors.takeOutgoingSequenceFlows).toHaveBeenCalledWith(
        noneEvent,
        ctx
      );
    });
  });

  describe("LinkThrowEvent", () => {
    const linkEvent = makeEvent({
      eventDefinitionType: BpmnEventDefinitionType.LINK,
      linkName: "GoToPayment",
      linkTargetElementId: "LinkCatch_Payment",
    });

    it("should call completeElement on finalizeActivation", () => {
      const result = processor.finalizeActivation(linkEvent, ctx);
      expect(isRight(result)).toBe(true);
      expect(behaviors.completeElement).toHaveBeenCalledWith(ctx);
    });

    it("should activate target link catch event on finalizeCompletion", () => {
      const result = processor.finalizeCompletion(linkEvent, ctx);
      expect(isRight(result)).toBe(true);
      expect(behaviors.activateElement).toHaveBeenCalledWith(
        "LinkCatch_Payment",
        ctx
      );
    });

    it("should NOT take outgoing sequence flows", () => {
      processor.finalizeCompletion(linkEvent, ctx);
      expect(behaviors.takeOutgoingSequenceFlows).not.toHaveBeenCalled();
    });

    it("should fail if link target is missing", () => {
      const noTargetEvent = makeEvent({
        eventDefinitionType: BpmnEventDefinitionType.LINK,
        linkName: "GoToPayment",
      });
      const result = processor.finalizeCompletion(noTargetEvent, ctx);
      expect(isLeft(result)).toBe(true);
      if (isLeft(result)) {
        expect(result.value.message).toContain("target link catch event");
      }
    });
  });

  describe("EscalationThrowEvent", () => {
    const escalationEvent = makeEvent({
      eventDefinitionType: BpmnEventDefinitionType.ESCALATION,
    });

    it("should call completeElement on finalizeActivation", () => {
      const result = processor.finalizeActivation(escalationEvent, ctx);
      expect(isRight(result)).toBe(true);
      expect(behaviors.completeElement).toHaveBeenCalledWith(ctx);
    });

    it("should take outgoing sequence flows on finalizeCompletion", () => {
      const result = processor.finalizeCompletion(escalationEvent, ctx);
      expect(isRight(result)).toBe(true);
      expect(behaviors.takeOutgoingSequenceFlows).toHaveBeenCalledWith(
        escalationEvent,
        ctx
      );
    });
  });

  describe("Termination", () => {
    it("should return CONTINUE from onTerminate for none throw", () => {
      const outcome = processor.onTerminate(
        makeEvent({ eventDefinitionType: BpmnEventDefinitionType.NONE }),
        ctx
      );
      expect(outcome).toBe(TransitionOutcome.CONTINUE);
    });

    it("should return CONTINUE from onTerminate for link throw", () => {
      const outcome = processor.onTerminate(
        makeEvent({
          eventDefinitionType: BpmnEventDefinitionType.LINK,
          linkTargetElementId: "X",
        }),
        ctx
      );
      expect(outcome).toBe(TransitionOutcome.CONTINUE);
    });
  });

  describe("UnsupportedType", () => {
    it("should throw for unsupported event definition types", () => {
      const compensationEvent = makeEvent({
        eventDefinitionType: BpmnEventDefinitionType.COMPENSATION,
      });
      expect(() =>
        processor.onActivate(compensationEvent, ctx)
      ).toThrow("Unsupported intermediate throw event definition type");
    });
  });

  describe("Registration", () => {
    it("should be registerable for INTERMEDIATE_THROW_EVENT type", () => {
      const registry = new BpmnElementProcessors();
      registry.register(
        BpmnElementType.INTERMEDIATE_THROW_EVENT,
        processor
      );
      expect(
        registry.hasProcessor(BpmnElementType.INTERMEDIATE_THROW_EVENT)
      ).toBe(true);
    });
  });
});

describe("EventProcessorRegistry", () => {
  it("should register all four event processors", () => {
    const behaviors = makeMockBehaviors();
    const registry = new BpmnElementProcessors();

    registry.register(
      BpmnElementType.START_EVENT,
      new StartEventProcessor(behaviors)
    );
    registry.register(
      BpmnElementType.END_EVENT,
      new EndEventProcessor(behaviors)
    );
    registry.register(
      BpmnElementType.INTERMEDIATE_CATCH_EVENT,
      new IntermediateCatchEventProcessor(behaviors)
    );
    registry.register(
      BpmnElementType.INTERMEDIATE_THROW_EVENT,
      new IntermediateThrowEventProcessor(behaviors)
    );

    const types = registry.registeredTypes();
    expect(types.size).toBe(4);
    expect(types.has(BpmnElementType.START_EVENT)).toBe(true);
    expect(types.has(BpmnElementType.END_EVENT)).toBe(true);
    expect(types.has(BpmnElementType.INTERMEDIATE_CATCH_EVENT)).toBe(true);
    expect(types.has(BpmnElementType.INTERMEDIATE_THROW_EVENT)).toBe(true);
  });

  it("should invoke full lifecycle through BpmnStreamProcessor", async () => {
    const { BpmnStreamProcessor } = await import(
      "../processor/BpmnStreamProcessor.js"
    );
    const { ProcessInstanceIntent } = await import(
      "../intent/ProcessInstanceIntent.js"
    );

    const behaviors = makeMockBehaviors();
    const registry = new BpmnElementProcessors();
    registry.register(
      BpmnElementType.START_EVENT,
      new StartEventProcessor(behaviors)
    );

    const streamProcessor = new BpmnStreamProcessor(registry);

    const result = streamProcessor.processCommand(
      ProcessInstanceIntent.ACTIVATE_ELEMENT,
      makeEvent(),
      makeContext(),
      BpmnElementType.START_EVENT
    );

    expect(isRight(result)).toBe(true);
    expect(behaviors.completeElement).toHaveBeenCalled();
  });
});
