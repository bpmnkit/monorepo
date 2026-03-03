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
import { BoundaryEventProcessor } from "../processor/BoundaryEventProcessor.js";
import { BpmnElementProcessors } from "../processor/BpmnElementProcessors.js";
import { BpmnElementType } from "../types/BpmnElementType.js";
import { isRight, right } from "../types/Either.js";
import { TransitionOutcome } from "../processor/TransitionOutcome.js";

// --- Test Helpers ---

function makeContext(
  overrides?: Partial<BpmnElementContext>
): BpmnElementContext {
  return {
    elementInstanceKey: 20,
    flowScopeKey: 1,
    processInstanceKey: 100,
    processDefinitionKey: 200,
    elementId: "BoundaryEvent_1",
    bpmnProcessId: "test-process",
    ...overrides,
  };
}

function makeEvent(
  overrides?: Partial<BpmnEventElement>
): BpmnEventElement {
  return {
    elementId: "BoundaryEvent_1",
    eventDefinitionType: BpmnEventDefinitionType.ERROR,
    errorCode: "ERR_PAYMENT",
    interrupting: true,
    attachedToRef: "Task_1",
    ...overrides,
  };
}

function makeMockBehaviors(): EventBehaviors {
  return {
    completeElement: vi.fn(),
    takeOutgoingSequenceFlows: vi.fn(),
    activateElement: vi.fn(),
    subscribeToEvents: vi.fn(() => right(undefined)),
    unsubscribeFromEvents: vi.fn(),
    throwErrorEvent: vi.fn(() => right(undefined)),
    terminateChildInstances: vi.fn(),
  };
}

// --- Tests ---

describe("BoundaryEventProcessor", () => {
  let behaviors: ReturnType<typeof makeMockBehaviors>;
  let processor: BoundaryEventProcessor;
  const ctx = makeContext();
  const element = makeEvent();

  beforeEach(() => {
    behaviors = makeMockBehaviors();
    processor = new BoundaryEventProcessor(behaviors);
  });

  describe("Activation", () => {
    it("should return success from onActivate", () => {
      const result = processor.onActivate(element, ctx);
      expect(isRight(result)).toBe(true);
    });

    it("should call completeElement on finalizeActivation (passthrough)", () => {
      const result = processor.finalizeActivation(element, ctx);
      expect(isRight(result)).toBe(true);
      expect(behaviors.completeElement).toHaveBeenCalledWith(ctx);
    });
  });

  describe("Completion", () => {
    it("should return success from onComplete", () => {
      const result = processor.onComplete(element, ctx);
      expect(isRight(result)).toBe(true);
    });

    it("should take outgoing sequence flows on finalizeCompletion", () => {
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
      const outcome = processor.onTerminate(element, ctx);
      expect(outcome).toBe(TransitionOutcome.CONTINUE);
    });

    it("should not throw from finalizeTermination", () => {
      expect(() =>
        processor.finalizeTermination(element, ctx)
      ).not.toThrow();
    });
  });

  describe("Registration", () => {
    it("should be registerable for BOUNDARY_EVENT type", () => {
      const registry = new BpmnElementProcessors();
      registry.register(BpmnElementType.BOUNDARY_EVENT, processor);
      expect(registry.hasProcessor(BpmnElementType.BOUNDARY_EVENT)).toBe(
        true
      );
      expect(registry.getProcessor(BpmnElementType.BOUNDARY_EVENT)).toBe(
        processor
      );
    });
  });
});
