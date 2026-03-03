/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import type { BpmnTaskElement } from "../task/BpmnTaskElement.js";
import type { BpmnElementContext } from "../processor/BpmnElementContext.js";
import type { TaskBehaviors } from "../processor/TaskBehaviors.js";
import { TaskProcessor } from "../processor/TaskProcessor.js";
import { ServiceTaskProcessor } from "../processor/ServiceTaskProcessor.js";
import { BusinessRuleTaskProcessor } from "../processor/BusinessRuleTaskProcessor.js";
import { SendTaskProcessor } from "../processor/SendTaskProcessor.js";
import { ReceiveTaskProcessor } from "../processor/ReceiveTaskProcessor.js";
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
    elementId: "Task_1",
    bpmnProcessId: "test-process",
    ...overrides,
  };
}

function makeTask(overrides?: Partial<BpmnTaskElement>): BpmnTaskElement {
  return {
    elementId: "Task_1",
    ...overrides,
  };
}

function makeMockBehaviors(): TaskBehaviors & {
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
    createJob: vi.fn(() => {
      calls.push("createJob");
      return right(undefined);
    }),
    cancelJob: vi.fn(() => {
      calls.push("cancelJob");
    }),
    subscribeToMessage: vi.fn(() => {
      calls.push("subscribeToMessage");
      return right(undefined);
    }),
    unsubscribeFromMessage: vi.fn(() => {
      calls.push("unsubscribeFromMessage");
    }),
  };
}

// --- Tests ---

describe("TaskProcessor", () => {
  let behaviors: ReturnType<typeof makeMockBehaviors>;
  let processor: TaskProcessor;
  const ctx = makeContext();

  beforeEach(() => {
    behaviors = makeMockBehaviors();
    processor = new TaskProcessor(behaviors);
  });

  describe("Activation", () => {
    it("should return success from onActivate", () => {
      const result = processor.onActivate(makeTask(), ctx);
      expect(isRight(result)).toBe(true);
    });

    it("should call completeElement on finalizeActivation (passthrough)", () => {
      const result = processor.finalizeActivation(makeTask(), ctx);
      expect(isRight(result)).toBe(true);
      expect(behaviors.completeElement).toHaveBeenCalledWith(ctx);
    });

    it("should NOT create a job", () => {
      processor.finalizeActivation(makeTask(), ctx);
      expect(behaviors.createJob).not.toHaveBeenCalled();
    });
  });

  describe("Completion", () => {
    it("should return success from onComplete", () => {
      const result = processor.onComplete(makeTask(), ctx);
      expect(isRight(result)).toBe(true);
    });

    it("should take outgoing sequence flows on finalizeCompletion", () => {
      const element = makeTask();
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
      const outcome = processor.onTerminate(makeTask(), ctx);
      expect(outcome).toBe(TransitionOutcome.CONTINUE);
    });

    it("should not throw from finalizeTermination", () => {
      expect(() =>
        processor.finalizeTermination(makeTask(), ctx)
      ).not.toThrow();
    });
  });

  describe("Registration", () => {
    it("should be registerable for TASK type", () => {
      const registry = new BpmnElementProcessors();
      registry.register(BpmnElementType.TASK, processor);
      expect(registry.hasProcessor(BpmnElementType.TASK)).toBe(true);
      expect(registry.getProcessor(BpmnElementType.TASK)).toBe(processor);
    });
  });
});

describe("ServiceTaskProcessor", () => {
  let behaviors: ReturnType<typeof makeMockBehaviors>;
  let processor: ServiceTaskProcessor;
  const ctx = makeContext();

  beforeEach(() => {
    behaviors = makeMockBehaviors();
    processor = new ServiceTaskProcessor(behaviors);
  });

  describe("Activation", () => {
    it("should return success from onActivate", () => {
      const result = processor.onActivate(
        makeTask({ jobType: "payment-service" }),
        ctx
      );
      expect(isRight(result)).toBe(true);
    });

    it("should create a job on finalizeActivation", () => {
      const element = makeTask({ jobType: "payment-service" });
      const result = processor.finalizeActivation(element, ctx);
      expect(isRight(result)).toBe(true);
      expect(behaviors.createJob).toHaveBeenCalledWith(element, ctx);
    });

    it("should NOT call completeElement (wait state)", () => {
      processor.finalizeActivation(
        makeTask({ jobType: "payment-service" }),
        ctx
      );
      expect(behaviors.completeElement).not.toHaveBeenCalled();
    });

    it("should propagate job creation failure", () => {
      const failingBehaviors = makeMockBehaviors();
      failingBehaviors.createJob = vi.fn(() =>
        left(new Failure("Job creation failed", ErrorType.UNKNOWN))
      );
      const failProcessor = new ServiceTaskProcessor(failingBehaviors);

      const result = failProcessor.finalizeActivation(
        makeTask({ jobType: "payment-service" }),
        ctx
      );
      expect(isLeft(result)).toBe(true);
      if (isLeft(result)) {
        expect(result.value.message).toBe("Job creation failed");
      }
    });
  });

  describe("Completion", () => {
    it("should return success from onComplete", () => {
      const result = processor.onComplete(
        makeTask({ jobType: "payment-service" }),
        ctx
      );
      expect(isRight(result)).toBe(true);
    });

    it("should take outgoing sequence flows on finalizeCompletion", () => {
      const element = makeTask({ jobType: "payment-service" });
      const result = processor.finalizeCompletion(element, ctx);
      expect(isRight(result)).toBe(true);
      expect(behaviors.takeOutgoingSequenceFlows).toHaveBeenCalledWith(
        element,
        ctx
      );
    });
  });

  describe("Termination", () => {
    it("should cancel the job and return CONTINUE", () => {
      const outcome = processor.onTerminate(
        makeTask({ jobType: "payment-service" }),
        ctx
      );
      expect(outcome).toBe(TransitionOutcome.CONTINUE);
      expect(behaviors.cancelJob).toHaveBeenCalledWith(ctx);
    });

    it("should not throw from finalizeTermination", () => {
      expect(() =>
        processor.finalizeTermination(
          makeTask({ jobType: "payment-service" }),
          ctx
        )
      ).not.toThrow();
    });
  });

  describe("Registration", () => {
    it("should be registerable for SERVICE_TASK type", () => {
      const registry = new BpmnElementProcessors();
      registry.register(BpmnElementType.SERVICE_TASK, processor);
      expect(registry.hasProcessor(BpmnElementType.SERVICE_TASK)).toBe(true);
      expect(registry.getProcessor(BpmnElementType.SERVICE_TASK)).toBe(
        processor
      );
    });
  });
});

describe("BusinessRuleTaskProcessor", () => {
  let behaviors: ReturnType<typeof makeMockBehaviors>;
  let processor: BusinessRuleTaskProcessor;
  const ctx = makeContext();

  beforeEach(() => {
    behaviors = makeMockBehaviors();
    processor = new BusinessRuleTaskProcessor(behaviors);
  });

  describe("Activation", () => {
    it("should return success from onActivate", () => {
      const result = processor.onActivate(
        makeTask({ jobType: "dmn-evaluation" }),
        ctx
      );
      expect(isRight(result)).toBe(true);
    });

    it("should create a job on finalizeActivation", () => {
      const element = makeTask({ jobType: "dmn-evaluation" });
      const result = processor.finalizeActivation(element, ctx);
      expect(isRight(result)).toBe(true);
      expect(behaviors.createJob).toHaveBeenCalledWith(element, ctx);
    });

    it("should NOT call completeElement (wait state)", () => {
      processor.finalizeActivation(
        makeTask({ jobType: "dmn-evaluation" }),
        ctx
      );
      expect(behaviors.completeElement).not.toHaveBeenCalled();
    });

    it("should propagate job creation failure", () => {
      const failingBehaviors = makeMockBehaviors();
      failingBehaviors.createJob = vi.fn(() =>
        left(new Failure("Job creation failed", ErrorType.UNKNOWN))
      );
      const failProcessor = new BusinessRuleTaskProcessor(failingBehaviors);

      const result = failProcessor.finalizeActivation(
        makeTask({ jobType: "dmn-evaluation" }),
        ctx
      );
      expect(isLeft(result)).toBe(true);
      if (isLeft(result)) {
        expect(result.value.message).toBe("Job creation failed");
      }
    });
  });

  describe("Completion", () => {
    it("should return success from onComplete", () => {
      const result = processor.onComplete(
        makeTask({ jobType: "dmn-evaluation" }),
        ctx
      );
      expect(isRight(result)).toBe(true);
    });

    it("should take outgoing sequence flows on finalizeCompletion", () => {
      const element = makeTask({ jobType: "dmn-evaluation" });
      const result = processor.finalizeCompletion(element, ctx);
      expect(isRight(result)).toBe(true);
      expect(behaviors.takeOutgoingSequenceFlows).toHaveBeenCalledWith(
        element,
        ctx
      );
    });
  });

  describe("Termination", () => {
    it("should cancel the job and return CONTINUE", () => {
      const outcome = processor.onTerminate(
        makeTask({ jobType: "dmn-evaluation" }),
        ctx
      );
      expect(outcome).toBe(TransitionOutcome.CONTINUE);
      expect(behaviors.cancelJob).toHaveBeenCalledWith(ctx);
    });

    it("should not throw from finalizeTermination", () => {
      expect(() =>
        processor.finalizeTermination(
          makeTask({ jobType: "dmn-evaluation" }),
          ctx
        )
      ).not.toThrow();
    });
  });

  describe("Registration", () => {
    it("should be registerable for BUSINESS_RULE_TASK type", () => {
      const registry = new BpmnElementProcessors();
      registry.register(BpmnElementType.BUSINESS_RULE_TASK, processor);
      expect(registry.hasProcessor(BpmnElementType.BUSINESS_RULE_TASK)).toBe(
        true
      );
      expect(registry.getProcessor(BpmnElementType.BUSINESS_RULE_TASK)).toBe(
        processor
      );
    });
  });
});

describe("SendTaskProcessor", () => {
  let behaviors: ReturnType<typeof makeMockBehaviors>;
  let processor: SendTaskProcessor;
  const ctx = makeContext();

  beforeEach(() => {
    behaviors = makeMockBehaviors();
    processor = new SendTaskProcessor(behaviors);
  });

  describe("Activation", () => {
    it("should return success from onActivate", () => {
      const result = processor.onActivate(
        makeTask({ jobType: "send-email" }),
        ctx
      );
      expect(isRight(result)).toBe(true);
    });

    it("should create a job on finalizeActivation", () => {
      const element = makeTask({ jobType: "send-email" });
      const result = processor.finalizeActivation(element, ctx);
      expect(isRight(result)).toBe(true);
      expect(behaviors.createJob).toHaveBeenCalledWith(element, ctx);
    });

    it("should NOT call completeElement (wait state)", () => {
      processor.finalizeActivation(makeTask({ jobType: "send-email" }), ctx);
      expect(behaviors.completeElement).not.toHaveBeenCalled();
    });

    it("should propagate job creation failure", () => {
      const failingBehaviors = makeMockBehaviors();
      failingBehaviors.createJob = vi.fn(() =>
        left(new Failure("Job creation failed", ErrorType.UNKNOWN))
      );
      const failProcessor = new SendTaskProcessor(failingBehaviors);

      const result = failProcessor.finalizeActivation(
        makeTask({ jobType: "send-email" }),
        ctx
      );
      expect(isLeft(result)).toBe(true);
      if (isLeft(result)) {
        expect(result.value.message).toBe("Job creation failed");
      }
    });
  });

  describe("Completion", () => {
    it("should return success from onComplete", () => {
      const result = processor.onComplete(
        makeTask({ jobType: "send-email" }),
        ctx
      );
      expect(isRight(result)).toBe(true);
    });

    it("should take outgoing sequence flows on finalizeCompletion", () => {
      const element = makeTask({ jobType: "send-email" });
      const result = processor.finalizeCompletion(element, ctx);
      expect(isRight(result)).toBe(true);
      expect(behaviors.takeOutgoingSequenceFlows).toHaveBeenCalledWith(
        element,
        ctx
      );
    });
  });

  describe("Termination", () => {
    it("should cancel the job and return CONTINUE", () => {
      const outcome = processor.onTerminate(
        makeTask({ jobType: "send-email" }),
        ctx
      );
      expect(outcome).toBe(TransitionOutcome.CONTINUE);
      expect(behaviors.cancelJob).toHaveBeenCalledWith(ctx);
    });

    it("should not throw from finalizeTermination", () => {
      expect(() =>
        processor.finalizeTermination(
          makeTask({ jobType: "send-email" }),
          ctx
        )
      ).not.toThrow();
    });
  });

  describe("Registration", () => {
    it("should be registerable for SEND_TASK type", () => {
      const registry = new BpmnElementProcessors();
      registry.register(BpmnElementType.SEND_TASK, processor);
      expect(registry.hasProcessor(BpmnElementType.SEND_TASK)).toBe(true);
      expect(registry.getProcessor(BpmnElementType.SEND_TASK)).toBe(
        processor
      );
    });
  });
});

describe("ReceiveTaskProcessor", () => {
  let behaviors: ReturnType<typeof makeMockBehaviors>;
  let processor: ReceiveTaskProcessor;
  const ctx = makeContext();

  beforeEach(() => {
    behaviors = makeMockBehaviors();
    processor = new ReceiveTaskProcessor(behaviors);
  });

  describe("Activation", () => {
    it("should return success from onActivate", () => {
      const result = processor.onActivate(
        makeTask({
          messageName: "order-received",
          correlationKey: "order-123",
        }),
        ctx
      );
      expect(isRight(result)).toBe(true);
    });

    it("should subscribe to message on finalizeActivation", () => {
      const element = makeTask({
        messageName: "order-received",
        correlationKey: "order-123",
      });
      const result = processor.finalizeActivation(element, ctx);
      expect(isRight(result)).toBe(true);
      expect(behaviors.subscribeToMessage).toHaveBeenCalledWith(element, ctx);
    });

    it("should NOT call completeElement (wait state)", () => {
      processor.finalizeActivation(
        makeTask({
          messageName: "order-received",
          correlationKey: "order-123",
        }),
        ctx
      );
      expect(behaviors.completeElement).not.toHaveBeenCalled();
    });

    it("should propagate subscription failure", () => {
      const failingBehaviors = makeMockBehaviors();
      failingBehaviors.subscribeToMessage = vi.fn(() =>
        left(new Failure("Subscription failed", ErrorType.UNKNOWN))
      );
      const failProcessor = new ReceiveTaskProcessor(failingBehaviors);

      const result = failProcessor.finalizeActivation(
        makeTask({
          messageName: "order-received",
          correlationKey: "order-123",
        }),
        ctx
      );
      expect(isLeft(result)).toBe(true);
      if (isLeft(result)) {
        expect(result.value.message).toBe("Subscription failed");
      }
    });
  });

  describe("Completion", () => {
    it("should unsubscribe from message on onComplete", () => {
      const result = processor.onComplete(
        makeTask({ messageName: "order-received" }),
        ctx
      );
      expect(isRight(result)).toBe(true);
      expect(behaviors.unsubscribeFromMessage).toHaveBeenCalledWith(ctx);
    });

    it("should take outgoing sequence flows on finalizeCompletion", () => {
      const element = makeTask({ messageName: "order-received" });
      const result = processor.finalizeCompletion(element, ctx);
      expect(isRight(result)).toBe(true);
      expect(behaviors.takeOutgoingSequenceFlows).toHaveBeenCalledWith(
        element,
        ctx
      );
    });
  });

  describe("Termination", () => {
    it("should unsubscribe from message and return CONTINUE", () => {
      const outcome = processor.onTerminate(
        makeTask({ messageName: "order-received" }),
        ctx
      );
      expect(outcome).toBe(TransitionOutcome.CONTINUE);
      expect(behaviors.unsubscribeFromMessage).toHaveBeenCalledWith(ctx);
    });

    it("should not throw from finalizeTermination", () => {
      expect(() =>
        processor.finalizeTermination(
          makeTask({ messageName: "order-received" }),
          ctx
        )
      ).not.toThrow();
    });
  });

  describe("Registration", () => {
    it("should be registerable for RECEIVE_TASK type", () => {
      const registry = new BpmnElementProcessors();
      registry.register(BpmnElementType.RECEIVE_TASK, processor);
      expect(registry.hasProcessor(BpmnElementType.RECEIVE_TASK)).toBe(true);
      expect(registry.getProcessor(BpmnElementType.RECEIVE_TASK)).toBe(
        processor
      );
    });
  });
});

describe("TaskProcessorRegistry", () => {
  it("should register all five task processors", () => {
    const behaviors = makeMockBehaviors();
    const registry = new BpmnElementProcessors();

    registry.register(BpmnElementType.TASK, new TaskProcessor(behaviors));
    registry.register(
      BpmnElementType.SERVICE_TASK,
      new ServiceTaskProcessor(behaviors)
    );
    registry.register(
      BpmnElementType.BUSINESS_RULE_TASK,
      new BusinessRuleTaskProcessor(behaviors)
    );
    registry.register(
      BpmnElementType.SEND_TASK,
      new SendTaskProcessor(behaviors)
    );
    registry.register(
      BpmnElementType.RECEIVE_TASK,
      new ReceiveTaskProcessor(behaviors)
    );

    const types = registry.registeredTypes();
    expect(types.size).toBe(5);
    expect(types.has(BpmnElementType.TASK)).toBe(true);
    expect(types.has(BpmnElementType.SERVICE_TASK)).toBe(true);
    expect(types.has(BpmnElementType.BUSINESS_RULE_TASK)).toBe(true);
    expect(types.has(BpmnElementType.SEND_TASK)).toBe(true);
    expect(types.has(BpmnElementType.RECEIVE_TASK)).toBe(true);
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
    registry.register(BpmnElementType.TASK, new TaskProcessor(behaviors));

    const streamProcessor = new BpmnStreamProcessor(registry);

    const result = streamProcessor.processCommand(
      ProcessInstanceIntent.ACTIVATE_ELEMENT,
      makeTask(),
      makeContext(),
      BpmnElementType.TASK
    );

    expect(isRight(result)).toBe(true);
    expect(behaviors.completeElement).toHaveBeenCalled();
  });
});
