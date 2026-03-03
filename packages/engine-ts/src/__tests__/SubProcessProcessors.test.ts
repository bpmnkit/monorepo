/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import type { BpmnSubProcessElement } from "../container/BpmnSubProcessElement.js";
import type { BpmnAdHocSubProcessElement } from "../container/BpmnSubProcessElement.js";
import type { BpmnElementContext } from "../processor/BpmnElementContext.js";
import type { SubProcessBehaviors } from "../processor/SubProcessBehaviors.js";
import { SubProcessProcessor } from "../processor/SubProcessProcessor.js";
import { AdHocSubProcessProcessor } from "../processor/AdHocSubProcessProcessor.js";
import { AdHocSubProcessInnerInstanceProcessor } from "../processor/AdHocSubProcessInnerInstanceProcessor.js";
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
    elementId: "SubProcess_1",
    bpmnProcessId: "test-process",
    ...overrides,
  };
}

function makeChildContext(
  overrides?: Partial<BpmnElementContext>
): BpmnElementContext {
  return {
    elementInstanceKey: 2,
    flowScopeKey: 1,
    processInstanceKey: 100,
    processDefinitionKey: 200,
    elementId: "Task_1",
    bpmnProcessId: "test-process",
    ...overrides,
  };
}

function makeSubProcess(
  overrides?: Partial<BpmnSubProcessElement>
): BpmnSubProcessElement {
  return {
    elementId: "SubProcess_1",
    startEventId: "StartEvent_Sub",
    ...overrides,
  };
}

function makeAdHocSubProcess(
  overrides?: Partial<BpmnAdHocSubProcessElement>
): BpmnAdHocSubProcessElement {
  return {
    elementId: "AdHocSubProcess_1",
    ...overrides,
  };
}

function makeMockBehaviors(): SubProcessBehaviors & {
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
    terminateChildInstances: vi.fn(() => {
      calls.push("terminateChildInstances");
      return true;
    }),
    activateChildInstance: vi.fn(
      (_context: BpmnElementContext, _childId: string) => {
        calls.push("activateChildInstance");
      }
    ),
    applyInputMappings: vi.fn(() => {
      calls.push("applyInputMappings");
      return right(undefined);
    }),
    applyOutputMappings: vi.fn(() => {
      calls.push("applyOutputMappings");
      return right(undefined);
    }),
    unsubscribeFromEvents: vi.fn(() => {
      calls.push("unsubscribeFromEvents");
    }),
    canBeCompleted: vi.fn(() => {
      calls.push("canBeCompleted");
      return true;
    }),
    canBeTerminated: vi.fn(() => {
      calls.push("canBeTerminated");
      return true;
    }),
    isTerminating: vi.fn(() => {
      calls.push("isTerminating");
      return false;
    }),
  };
}

// --- Tests ---

describe("SubProcessProcessor", () => {
  let behaviors: ReturnType<typeof makeMockBehaviors>;
  let processor: SubProcessProcessor;
  const ctx = makeContext();

  beforeEach(() => {
    behaviors = makeMockBehaviors();
    processor = new SubProcessProcessor(behaviors);
  });

  describe("Activation", () => {
    it("should apply input mappings on onActivate", () => {
      const element = makeSubProcess();
      const result = processor.onActivate(element, ctx);
      expect(isRight(result)).toBe(true);
      expect(behaviors.applyInputMappings).toHaveBeenCalledWith(element, ctx);
    });

    it("should propagate input mapping failure", () => {
      const failingBehaviors = makeMockBehaviors();
      failingBehaviors.applyInputMappings = vi.fn(() =>
        left(new Failure("Input mapping failed", ErrorType.IO_MAPPING_ERROR))
      );
      const failProcessor = new SubProcessProcessor(failingBehaviors);

      const result = failProcessor.onActivate(makeSubProcess(), ctx);
      expect(isLeft(result)).toBe(true);
      if (isLeft(result)) {
        expect(result.value.message).toBe("Input mapping failed");
        expect(result.value.errorType).toBe(ErrorType.IO_MAPPING_ERROR);
      }
    });

    it("should activate the none start event on finalizeActivation", () => {
      const element = makeSubProcess({ startEventId: "StartEvent_Sub" });
      const result = processor.finalizeActivation(element, ctx);
      expect(isRight(result)).toBe(true);
      expect(behaviors.activateChildInstance).toHaveBeenCalledWith(
        ctx,
        "StartEvent_Sub"
      );
    });

    it("should fail if no none start event is found", () => {
      const element = makeSubProcess({ startEventId: undefined });
      const result = processor.finalizeActivation(element, ctx);
      expect(isLeft(result)).toBe(true);
      if (isLeft(result)) {
        expect(result.value.message).toContain(
          "no none start event found in sub process"
        );
      }
    });
  });

  describe("Completion", () => {
    it("should apply output mappings on onComplete", () => {
      const element = makeSubProcess();
      const result = processor.onComplete(element, ctx);
      expect(isRight(result)).toBe(true);
      expect(behaviors.applyOutputMappings).toHaveBeenCalledWith(element, ctx);
    });

    it("should unsubscribe from events on onComplete", () => {
      processor.onComplete(makeSubProcess(), ctx);
      expect(behaviors.unsubscribeFromEvents).toHaveBeenCalledWith(ctx);
    });

    it("should propagate output mapping failure", () => {
      const failingBehaviors = makeMockBehaviors();
      failingBehaviors.applyOutputMappings = vi.fn(() =>
        left(new Failure("Output mapping failed", ErrorType.IO_MAPPING_ERROR))
      );
      const failProcessor = new SubProcessProcessor(failingBehaviors);

      const result = failProcessor.onComplete(makeSubProcess(), ctx);
      expect(isLeft(result)).toBe(true);
      if (isLeft(result)) {
        expect(result.value.message).toBe("Output mapping failed");
      }
    });

    it("should NOT unsubscribe if output mapping fails", () => {
      const failingBehaviors = makeMockBehaviors();
      failingBehaviors.applyOutputMappings = vi.fn(() =>
        left(new Failure("Output mapping failed", ErrorType.IO_MAPPING_ERROR))
      );
      const failProcessor = new SubProcessProcessor(failingBehaviors);

      failProcessor.onComplete(makeSubProcess(), ctx);
      expect(failingBehaviors.unsubscribeFromEvents).not.toHaveBeenCalled();
    });

    it("should take outgoing sequence flows on finalizeCompletion", () => {
      const element = makeSubProcess();
      const result = processor.finalizeCompletion(element, ctx);
      expect(isRight(result)).toBe(true);
      expect(behaviors.takeOutgoingSequenceFlows).toHaveBeenCalledWith(
        element,
        ctx
      );
    });
  });

  describe("Termination", () => {
    it("should unsubscribe from events on onTerminate", () => {
      processor.onTerminate(makeSubProcess(), ctx);
      expect(behaviors.unsubscribeFromEvents).toHaveBeenCalledWith(ctx);
    });

    it("should terminate child instances on onTerminate", () => {
      processor.onTerminate(makeSubProcess(), ctx);
      expect(behaviors.terminateChildInstances).toHaveBeenCalledWith(ctx);
    });

    it("should return CONTINUE from onTerminate", () => {
      const outcome = processor.onTerminate(makeSubProcess(), ctx);
      expect(outcome).toBe(TransitionOutcome.CONTINUE);
    });

    it("should not throw from finalizeTermination", () => {
      expect(() =>
        processor.finalizeTermination(makeSubProcess(), ctx)
      ).not.toThrow();
    });
  });

  describe("Container hooks", () => {
    it("should return success from onChildActivating", () => {
      const result = processor.onChildActivating(
        makeSubProcess(),
        ctx,
        makeChildContext()
      );
      expect(isRight(result)).toBe(true);
    });

    it("should return success from onChildCompleting", () => {
      const result = processor.onChildCompleting(
        makeSubProcess(),
        ctx,
        makeChildContext()
      );
      expect(isRight(result)).toBe(true);
    });

    it("should return success from beforeExecutionPathCompleted", () => {
      const result = processor.beforeExecutionPathCompleted(
        makeSubProcess(),
        ctx,
        makeChildContext()
      );
      expect(isRight(result)).toBe(true);
    });

    it("should complete element when canBeCompleted in afterExecutionPathCompleted", () => {
      behaviors.canBeCompleted = vi.fn(() => true);
      const childCtx = makeChildContext();

      processor.afterExecutionPathCompleted(
        makeSubProcess(),
        ctx,
        childCtx,
        undefined
      );

      expect(behaviors.canBeCompleted).toHaveBeenCalledWith(childCtx);
      expect(behaviors.completeElement).toHaveBeenCalledWith(ctx);
    });

    it("should NOT complete element when canBeCompleted is false", () => {
      behaviors.canBeCompleted = vi.fn(() => false);

      processor.afterExecutionPathCompleted(
        makeSubProcess(),
        ctx,
        makeChildContext(),
        undefined
      );

      expect(behaviors.completeElement).not.toHaveBeenCalled();
    });

    it("should check canBeTerminated in onChildTerminated", () => {
      const childCtx = makeChildContext();
      processor.onChildTerminated(makeSubProcess(), ctx, childCtx);
      expect(behaviors.canBeTerminated).toHaveBeenCalledWith(childCtx);
    });

    it("should check isTerminating when canBeTerminated", () => {
      behaviors.canBeTerminated = vi.fn(() => true);
      processor.onChildTerminated(makeSubProcess(), ctx, makeChildContext());
      expect(behaviors.isTerminating).toHaveBeenCalledWith(ctx);
    });

    it("should NOT check isTerminating when canBeTerminated is false", () => {
      behaviors.canBeTerminated = vi.fn(() => false);
      processor.onChildTerminated(makeSubProcess(), ctx, makeChildContext());
      expect(behaviors.isTerminating).not.toHaveBeenCalled();
    });
  });

  describe("Registration", () => {
    it("should be registerable for SUB_PROCESS type", () => {
      const registry = new BpmnElementProcessors();
      registry.register(BpmnElementType.SUB_PROCESS, processor);
      expect(registry.hasProcessor(BpmnElementType.SUB_PROCESS)).toBe(true);
      expect(registry.getProcessor(BpmnElementType.SUB_PROCESS)).toBe(
        processor
      );
    });

    it("should be retrievable as a container processor", () => {
      const registry = new BpmnElementProcessors();
      registry.register(BpmnElementType.SUB_PROCESS, processor);
      const containerProcessor = registry.getContainerProcessor(
        BpmnElementType.SUB_PROCESS
      );
      expect(containerProcessor).toBe(processor);
    });
  });
});

describe("AdHocSubProcessProcessor", () => {
  let behaviors: ReturnType<typeof makeMockBehaviors>;
  let processor: AdHocSubProcessProcessor;
  const ctx = makeContext({ elementId: "AdHocSubProcess_1" });

  beforeEach(() => {
    behaviors = makeMockBehaviors();
    processor = new AdHocSubProcessProcessor(behaviors);
  });

  describe("Activation", () => {
    it("should apply input mappings on onActivate", () => {
      const element = makeAdHocSubProcess();
      const result = processor.onActivate(element, ctx);
      expect(isRight(result)).toBe(true);
      expect(behaviors.applyInputMappings).toHaveBeenCalledWith(element, ctx);
    });

    it("should propagate input mapping failure", () => {
      const failingBehaviors = makeMockBehaviors();
      failingBehaviors.applyInputMappings = vi.fn(() =>
        left(new Failure("Input mapping failed", ErrorType.IO_MAPPING_ERROR))
      );
      const failProcessor = new AdHocSubProcessProcessor(failingBehaviors);

      const result = failProcessor.onActivate(makeAdHocSubProcess(), ctx);
      expect(isLeft(result)).toBe(true);
      if (isLeft(result)) {
        expect(result.value.message).toBe("Input mapping failed");
      }
    });

    it("should activate configured initial elements on finalizeActivation", () => {
      const element = makeAdHocSubProcess({
        activeElements: ["Task_A", "Task_B"],
      });
      const result = processor.finalizeActivation(element, ctx);
      expect(isRight(result)).toBe(true);
      expect(behaviors.activateChildInstance).toHaveBeenCalledTimes(2);
      expect(behaviors.activateChildInstance).toHaveBeenCalledWith(
        ctx,
        "Task_A"
      );
      expect(behaviors.activateChildInstance).toHaveBeenCalledWith(
        ctx,
        "Task_B"
      );
    });

    it("should succeed with no initial elements", () => {
      const element = makeAdHocSubProcess({ activeElements: undefined });
      const result = processor.finalizeActivation(element, ctx);
      expect(isRight(result)).toBe(true);
      expect(behaviors.activateChildInstance).not.toHaveBeenCalled();
    });

    it("should succeed with empty initial elements", () => {
      const element = makeAdHocSubProcess({ activeElements: [] });
      const result = processor.finalizeActivation(element, ctx);
      expect(isRight(result)).toBe(true);
      expect(behaviors.activateChildInstance).not.toHaveBeenCalled();
    });
  });

  describe("Completion", () => {
    it("should apply output mappings on onComplete", () => {
      const element = makeAdHocSubProcess();
      const result = processor.onComplete(element, ctx);
      expect(isRight(result)).toBe(true);
      expect(behaviors.applyOutputMappings).toHaveBeenCalledWith(element, ctx);
    });

    it("should unsubscribe from events on onComplete", () => {
      processor.onComplete(makeAdHocSubProcess(), ctx);
      expect(behaviors.unsubscribeFromEvents).toHaveBeenCalledWith(ctx);
    });

    it("should propagate output mapping failure", () => {
      const failingBehaviors = makeMockBehaviors();
      failingBehaviors.applyOutputMappings = vi.fn(() =>
        left(new Failure("Output mapping failed", ErrorType.IO_MAPPING_ERROR))
      );
      const failProcessor = new AdHocSubProcessProcessor(failingBehaviors);

      const result = failProcessor.onComplete(makeAdHocSubProcess(), ctx);
      expect(isLeft(result)).toBe(true);
    });

    it("should NOT unsubscribe if output mapping fails", () => {
      const failingBehaviors = makeMockBehaviors();
      failingBehaviors.applyOutputMappings = vi.fn(() =>
        left(new Failure("Output mapping failed", ErrorType.IO_MAPPING_ERROR))
      );
      const failProcessor = new AdHocSubProcessProcessor(failingBehaviors);

      failProcessor.onComplete(makeAdHocSubProcess(), ctx);
      expect(failingBehaviors.unsubscribeFromEvents).not.toHaveBeenCalled();
    });

    it("should take outgoing sequence flows on finalizeCompletion", () => {
      const element = makeAdHocSubProcess();
      const result = processor.finalizeCompletion(element, ctx);
      expect(isRight(result)).toBe(true);
      expect(behaviors.takeOutgoingSequenceFlows).toHaveBeenCalledWith(
        element,
        ctx
      );
    });
  });

  describe("Termination", () => {
    it("should unsubscribe from events on onTerminate", () => {
      processor.onTerminate(makeAdHocSubProcess(), ctx);
      expect(behaviors.unsubscribeFromEvents).toHaveBeenCalledWith(ctx);
    });

    it("should terminate child instances on onTerminate", () => {
      processor.onTerminate(makeAdHocSubProcess(), ctx);
      expect(behaviors.terminateChildInstances).toHaveBeenCalledWith(ctx);
    });

    it("should return CONTINUE from onTerminate", () => {
      const outcome = processor.onTerminate(makeAdHocSubProcess(), ctx);
      expect(outcome).toBe(TransitionOutcome.CONTINUE);
    });

    it("should not throw from finalizeTermination", () => {
      expect(() =>
        processor.finalizeTermination(makeAdHocSubProcess(), ctx)
      ).not.toThrow();
    });
  });

  describe("Container hooks — afterExecutionPathCompleted", () => {
    it("should complete when no condition and canBeCompleted", () => {
      behaviors.canBeCompleted = vi.fn(() => true);
      const childCtx = makeChildContext();

      processor.afterExecutionPathCompleted(
        makeAdHocSubProcess(),
        ctx,
        childCtx,
        undefined // no completion condition
      );

      expect(behaviors.canBeCompleted).toHaveBeenCalledWith(childCtx);
      expect(behaviors.completeElement).toHaveBeenCalledWith(ctx);
    });

    it("should NOT complete when no condition and canBeCompleted is false", () => {
      behaviors.canBeCompleted = vi.fn(() => false);

      processor.afterExecutionPathCompleted(
        makeAdHocSubProcess(),
        ctx,
        makeChildContext(),
        undefined
      );

      expect(behaviors.completeElement).not.toHaveBeenCalled();
    });

    it("should terminate remaining and NOT complete immediately when condition true and cancelRemaining", () => {
      const element = makeAdHocSubProcess({ cancelRemainingInstances: true });

      processor.afterExecutionPathCompleted(
        element,
        ctx,
        makeChildContext(),
        true
      );

      expect(behaviors.terminateChildInstances).toHaveBeenCalledWith(ctx);
      expect(behaviors.completeElement).not.toHaveBeenCalled();
    });

    it("should default cancelRemainingInstances to true", () => {
      const element = makeAdHocSubProcess(); // cancelRemainingInstances undefined → defaults to true

      processor.afterExecutionPathCompleted(
        element,
        ctx,
        makeChildContext(),
        true
      );

      expect(behaviors.terminateChildInstances).toHaveBeenCalledWith(ctx);
      expect(behaviors.completeElement).not.toHaveBeenCalled();
    });

    it("should complete immediately when condition true and cancelRemaining false", () => {
      const element = makeAdHocSubProcess({ cancelRemainingInstances: false });

      processor.afterExecutionPathCompleted(
        element,
        ctx,
        makeChildContext(),
        true
      );

      expect(behaviors.terminateChildInstances).not.toHaveBeenCalled();
      expect(behaviors.completeElement).toHaveBeenCalledWith(ctx);
    });

    it("should do nothing when condition is false", () => {
      processor.afterExecutionPathCompleted(
        makeAdHocSubProcess(),
        ctx,
        makeChildContext(),
        false
      );

      expect(behaviors.completeElement).not.toHaveBeenCalled();
      expect(behaviors.terminateChildInstances).not.toHaveBeenCalled();
    });
  });

  describe("Container hooks — onChildTerminated", () => {
    it("should check isTerminating when terminating", () => {
      behaviors.isTerminating = vi.fn(() => true);
      behaviors.canBeTerminated = vi.fn(() => true);
      const childCtx = makeChildContext();

      processor.onChildTerminated(makeAdHocSubProcess(), ctx, childCtx);

      expect(behaviors.isTerminating).toHaveBeenCalledWith(ctx);
      expect(behaviors.canBeTerminated).toHaveBeenCalledWith(childCtx);
    });

    it("should complete when not terminating and canBeCompleted", () => {
      behaviors.isTerminating = vi.fn(() => false);
      behaviors.canBeCompleted = vi.fn(() => true);

      processor.onChildTerminated(
        makeAdHocSubProcess(),
        ctx,
        makeChildContext()
      );

      expect(behaviors.completeElement).toHaveBeenCalledWith(ctx);
    });

    it("should NOT complete when not terminating and canBeCompleted is false", () => {
      behaviors.isTerminating = vi.fn(() => false);
      behaviors.canBeCompleted = vi.fn(() => false);

      processor.onChildTerminated(
        makeAdHocSubProcess(),
        ctx,
        makeChildContext()
      );

      expect(behaviors.completeElement).not.toHaveBeenCalled();
    });
  });

  describe("Container hooks — default hooks", () => {
    it("should return success from onChildActivating", () => {
      const result = processor.onChildActivating(
        makeAdHocSubProcess(),
        ctx,
        makeChildContext()
      );
      expect(isRight(result)).toBe(true);
    });

    it("should return success from onChildCompleting", () => {
      const result = processor.onChildCompleting(
        makeAdHocSubProcess(),
        ctx,
        makeChildContext()
      );
      expect(isRight(result)).toBe(true);
    });

    it("should return success from beforeExecutionPathCompleted", () => {
      const result = processor.beforeExecutionPathCompleted(
        makeAdHocSubProcess(),
        ctx,
        makeChildContext()
      );
      expect(isRight(result)).toBe(true);
    });
  });

  describe("Registration", () => {
    it("should be registerable for AD_HOC_SUB_PROCESS type", () => {
      const registry = new BpmnElementProcessors();
      registry.register(BpmnElementType.AD_HOC_SUB_PROCESS, processor);
      expect(registry.hasProcessor(BpmnElementType.AD_HOC_SUB_PROCESS)).toBe(
        true
      );
      expect(registry.getProcessor(BpmnElementType.AD_HOC_SUB_PROCESS)).toBe(
        processor
      );
    });

    it("should be retrievable as a container processor", () => {
      const registry = new BpmnElementProcessors();
      registry.register(BpmnElementType.AD_HOC_SUB_PROCESS, processor);
      const containerProcessor = registry.getContainerProcessor(
        BpmnElementType.AD_HOC_SUB_PROCESS
      );
      expect(containerProcessor).toBe(processor);
    });
  });
});

describe("AdHocSubProcessInnerInstanceProcessor", () => {
  let behaviors: ReturnType<typeof makeMockBehaviors>;
  let processor: AdHocSubProcessInnerInstanceProcessor;
  const ctx = makeContext({
    elementId: "AdHocSubProcess_Inner_1",
  });

  beforeEach(() => {
    behaviors = makeMockBehaviors();
    processor = new AdHocSubProcessInnerInstanceProcessor(behaviors);
  });

  describe("Activation", () => {
    it("should return failure from onActivate (not supported)", () => {
      const result = processor.onActivate(makeSubProcess(), ctx);
      expect(isLeft(result)).toBe(true);
      if (isLeft(result)) {
        expect(result.value.message).toContain(
          "ACTIVATE command is not supported"
        );
        expect(result.value.message).toContain("inner instance");
      }
    });

    it("should return success from finalizeActivation", () => {
      const result = processor.finalizeActivation(makeSubProcess(), ctx);
      expect(isRight(result)).toBe(true);
    });
  });

  describe("Completion", () => {
    it("should return success from onComplete", () => {
      const result = processor.onComplete(makeSubProcess(), ctx);
      expect(isRight(result)).toBe(true);
    });

    it("should return success from finalizeCompletion", () => {
      const result = processor.finalizeCompletion(makeSubProcess(), ctx);
      expect(isRight(result)).toBe(true);
    });
  });

  describe("Termination", () => {
    it("should terminate child instances on onTerminate", () => {
      processor.onTerminate(makeSubProcess(), ctx);
      expect(behaviors.terminateChildInstances).toHaveBeenCalledWith(ctx);
    });

    it("should return CONTINUE from onTerminate", () => {
      const outcome = processor.onTerminate(makeSubProcess(), ctx);
      expect(outcome).toBe(TransitionOutcome.CONTINUE);
    });

    it("should not throw from finalizeTermination", () => {
      expect(() =>
        processor.finalizeTermination(makeSubProcess(), ctx)
      ).not.toThrow();
    });
  });

  describe("Container hooks", () => {
    it("should return success from onChildActivating", () => {
      const result = processor.onChildActivating(
        makeSubProcess(),
        ctx,
        makeChildContext()
      );
      expect(isRight(result)).toBe(true);
    });

    it("should return success from onChildCompleting", () => {
      const result = processor.onChildCompleting(
        makeSubProcess(),
        ctx,
        makeChildContext()
      );
      expect(isRight(result)).toBe(true);
    });

    it("should return success from beforeExecutionPathCompleted", () => {
      const result = processor.beforeExecutionPathCompleted(
        makeSubProcess(),
        ctx,
        makeChildContext()
      );
      expect(isRight(result)).toBe(true);
    });

    it("should complete element when canBeCompleted in afterExecutionPathCompleted", () => {
      behaviors.canBeCompleted = vi.fn(() => true);
      const childCtx = makeChildContext();

      processor.afterExecutionPathCompleted(
        makeSubProcess(),
        ctx,
        childCtx,
        undefined
      );

      expect(behaviors.canBeCompleted).toHaveBeenCalledWith(childCtx);
      expect(behaviors.completeElement).toHaveBeenCalledWith(ctx);
    });

    it("should NOT complete element when canBeCompleted is false", () => {
      behaviors.canBeCompleted = vi.fn(() => false);

      processor.afterExecutionPathCompleted(
        makeSubProcess(),
        ctx,
        makeChildContext(),
        undefined
      );

      expect(behaviors.completeElement).not.toHaveBeenCalled();
    });

    it("should check canBeTerminated in onChildTerminated", () => {
      const childCtx = makeChildContext();
      processor.onChildTerminated(makeSubProcess(), ctx, childCtx);
      expect(behaviors.canBeTerminated).toHaveBeenCalledWith(childCtx);
    });
  });

  describe("Registration", () => {
    it("should be registerable for AD_HOC_SUB_PROCESS_INNER_INSTANCE type", () => {
      const registry = new BpmnElementProcessors();
      registry.register(
        BpmnElementType.AD_HOC_SUB_PROCESS_INNER_INSTANCE,
        processor
      );
      expect(
        registry.hasProcessor(
          BpmnElementType.AD_HOC_SUB_PROCESS_INNER_INSTANCE
        )
      ).toBe(true);
      expect(
        registry.getProcessor(
          BpmnElementType.AD_HOC_SUB_PROCESS_INNER_INSTANCE
        )
      ).toBe(processor);
    });

    it("should be retrievable as a container processor", () => {
      const registry = new BpmnElementProcessors();
      registry.register(
        BpmnElementType.AD_HOC_SUB_PROCESS_INNER_INSTANCE,
        processor
      );
      const containerProcessor = registry.getContainerProcessor(
        BpmnElementType.AD_HOC_SUB_PROCESS_INNER_INSTANCE
      );
      expect(containerProcessor).toBe(processor);
    });
  });
});

describe("SubProcessProcessorRegistry", () => {
  it("should register all three container processors", () => {
    const behaviors = makeMockBehaviors();
    const registry = new BpmnElementProcessors();

    registry.register(
      BpmnElementType.SUB_PROCESS,
      new SubProcessProcessor(behaviors)
    );
    registry.register(
      BpmnElementType.AD_HOC_SUB_PROCESS,
      new AdHocSubProcessProcessor(behaviors)
    );
    registry.register(
      BpmnElementType.AD_HOC_SUB_PROCESS_INNER_INSTANCE,
      new AdHocSubProcessInnerInstanceProcessor(behaviors)
    );

    const types = registry.registeredTypes();
    expect(types.size).toBe(3);
    expect(types.has(BpmnElementType.SUB_PROCESS)).toBe(true);
    expect(types.has(BpmnElementType.AD_HOC_SUB_PROCESS)).toBe(true);
    expect(types.has(BpmnElementType.AD_HOC_SUB_PROCESS_INNER_INSTANCE)).toBe(
      true
    );
  });

  it("should invoke full lifecycle through BpmnStreamProcessor for SubProcess", async () => {
    const { BpmnStreamProcessor } = await import(
      "../processor/BpmnStreamProcessor.js"
    );
    const { ProcessInstanceIntent } = await import(
      "../intent/ProcessInstanceIntent.js"
    );

    const behaviors = makeMockBehaviors();
    const registry = new BpmnElementProcessors();
    registry.register(
      BpmnElementType.SUB_PROCESS,
      new SubProcessProcessor(behaviors)
    );

    const streamProcessor = new BpmnStreamProcessor(registry);

    const result = streamProcessor.processCommand(
      ProcessInstanceIntent.ACTIVATE_ELEMENT,
      makeSubProcess(),
      makeContext(),
      BpmnElementType.SUB_PROCESS
    );

    expect(isRight(result)).toBe(true);
    expect(behaviors.applyInputMappings).toHaveBeenCalled();
    expect(behaviors.activateChildInstance).toHaveBeenCalledWith(
      expect.anything(),
      "StartEvent_Sub"
    );
  });

  it("should invoke termination lifecycle through BpmnStreamProcessor for SubProcess", async () => {
    const { BpmnStreamProcessor } = await import(
      "../processor/BpmnStreamProcessor.js"
    );
    const { ProcessInstanceIntent } = await import(
      "../intent/ProcessInstanceIntent.js"
    );

    const behaviors = makeMockBehaviors();
    const registry = new BpmnElementProcessors();
    registry.register(
      BpmnElementType.SUB_PROCESS,
      new SubProcessProcessor(behaviors)
    );

    const streamProcessor = new BpmnStreamProcessor(registry);

    const result = streamProcessor.processCommand(
      ProcessInstanceIntent.TERMINATE_ELEMENT,
      makeSubProcess(),
      makeContext(),
      BpmnElementType.SUB_PROCESS
    );

    expect(isRight(result)).toBe(true);
    if (isRight(result)) {
      expect(result.value).toBe(TransitionOutcome.CONTINUE);
    }
    expect(behaviors.unsubscribeFromEvents).toHaveBeenCalled();
    expect(behaviors.terminateChildInstances).toHaveBeenCalled();
  });
});
