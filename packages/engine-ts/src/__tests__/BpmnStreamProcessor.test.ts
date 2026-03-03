/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { ProcessInstanceIntent } from "../intent/ProcessInstanceIntent.js";
import { BpmnElementType } from "../types/BpmnElementType.js";
import { BpmnElementProcessors } from "../processor/BpmnElementProcessors.js";
import { BpmnStreamProcessor } from "../processor/BpmnStreamProcessor.js";
import type { ContainerContext } from "../processor/BpmnStreamProcessor.js";
import { AbstractBpmnElementProcessor } from "../processor/BpmnElementProcessor.js";
import { AbstractBpmnElementContainerProcessor } from "../processor/BpmnElementContainerProcessor.js";
import type { BpmnElementContext } from "../processor/BpmnElementContext.js";
import type { Either } from "../types/Either.js";
import { left, right, isLeft, isRight } from "../types/Either.js";
import { Failure, ErrorType } from "../processor/Failure.js";
import { TransitionOutcome } from "../processor/TransitionOutcome.js";

// --- Test helpers ---

function makeContext(overrides?: Partial<BpmnElementContext>): BpmnElementContext {
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

// --- Test processor implementations ---

class TrackingProcessor extends AbstractBpmnElementProcessor<unknown> {
  readonly calls: string[] = [];

  onActivate(_element: unknown, _context: BpmnElementContext): Either<Failure, void> {
    this.calls.push("onActivate");
    return right(undefined);
  }

  finalizeActivation(_element: unknown, _context: BpmnElementContext): Either<Failure, void> {
    this.calls.push("finalizeActivation");
    return right(undefined);
  }

  onComplete(_element: unknown, _context: BpmnElementContext): Either<Failure, void> {
    this.calls.push("onComplete");
    return right(undefined);
  }

  finalizeCompletion(_element: unknown, _context: BpmnElementContext): Either<Failure, void> {
    this.calls.push("finalizeCompletion");
    return right(undefined);
  }

  onTerminate(_element: unknown, _context: BpmnElementContext): TransitionOutcome {
    this.calls.push("onTerminate");
    return TransitionOutcome.CONTINUE;
  }

  finalizeTermination(_element: unknown, _context: BpmnElementContext): void {
    this.calls.push("finalizeTermination");
  }
}

class FailOnActivateProcessor extends AbstractBpmnElementProcessor<unknown> {
  onActivate(): Either<Failure, void> {
    return left(new Failure("activation failed", ErrorType.IO_MAPPING_ERROR));
  }

  finalizeActivation(): Either<Failure, void> {
    throw new Error("should not be called");
  }
}

class FailOnFinalizeActivationProcessor extends AbstractBpmnElementProcessor<unknown> {
  finalizeActivation(): Either<Failure, void> {
    return left(new Failure("finalize failed", ErrorType.EXTRACT_VALUE_ERROR));
  }
}

class FailOnCompleteProcessor extends AbstractBpmnElementProcessor<unknown> {
  onComplete(): Either<Failure, void> {
    return left(new Failure("completion failed", ErrorType.CONDITION_ERROR));
  }

  finalizeCompletion(): Either<Failure, void> {
    throw new Error("should not be called");
  }
}

class FailOnFinalizeCompletionProcessor extends AbstractBpmnElementProcessor<unknown> {
  finalizeCompletion(): Either<Failure, void> {
    return left(new Failure("finalize completion failed", ErrorType.UNKNOWN));
  }
}

class AwaitingTerminationProcessor extends AbstractBpmnElementProcessor<unknown> {
  readonly calls: string[] = [];

  onTerminate(): TransitionOutcome {
    this.calls.push("onTerminate");
    return TransitionOutcome.AWAIT;
  }

  finalizeTermination(): void {
    this.calls.push("finalizeTermination");
  }
}

class TrackingContainerProcessor extends AbstractBpmnElementContainerProcessor<unknown> {
  readonly calls: string[] = [];

  onChildActivating(
    _element: unknown,
    _flowScopeContext: BpmnElementContext,
    _childContext: BpmnElementContext
  ): Either<Failure, void> {
    this.calls.push("onChildActivating");
    return right(undefined);
  }

  onChildCompleting(
    _element: unknown,
    _flowScopeContext: BpmnElementContext,
    _childContext: BpmnElementContext
  ): Either<Failure, void> {
    this.calls.push("onChildCompleting");
    return right(undefined);
  }

  afterExecutionPathCompleted(): void {
    this.calls.push("afterExecutionPathCompleted");
  }

  onChildTerminated(): void {
    this.calls.push("onChildTerminated");
  }
}

class FailOnChildActivatingProcessor extends AbstractBpmnElementContainerProcessor<unknown> {
  onChildActivating(): Either<Failure, void> {
    return left(new Failure("child activation rejected", ErrorType.UNKNOWN));
  }

  afterExecutionPathCompleted(): void {
    // no-op
  }

  onChildTerminated(): void {
    // no-op
  }
}

class FailOnChildCompletingProcessor extends AbstractBpmnElementContainerProcessor<unknown> {
  onChildCompleting(): Either<Failure, void> {
    return left(new Failure("child completion rejected", ErrorType.EXTRACT_VALUE_ERROR));
  }

  afterExecutionPathCompleted(): void {
    // no-op
  }

  onChildTerminated(): void {
    // no-op
  }
}

// --- Tests ---

describe("BpmnStreamProcessor", () => {
  let registry: BpmnElementProcessors;
  let streamProcessor: BpmnStreamProcessor;
  const ctx = makeContext();

  beforeEach(() => {
    registry = new BpmnElementProcessors();
    streamProcessor = new BpmnStreamProcessor(registry);
  });

  describe("processActivateElement", () => {
    it("should invoke onActivate then finalizeActivation in order", () => {
      const processor = new TrackingProcessor();
      registry.register(BpmnElementType.SERVICE_TASK, processor);

      const result = streamProcessor.processActivateElement(
        {},
        ctx,
        BpmnElementType.SERVICE_TASK
      );

      expect(isRight(result)).toBe(true);
      expect(processor.calls).toEqual(["onActivate", "finalizeActivation"]);
    });

    it("should stop at onActivate failure without calling finalizeActivation", () => {
      registry.register(
        BpmnElementType.SERVICE_TASK,
        new FailOnActivateProcessor()
      );

      const result = streamProcessor.processActivateElement(
        {},
        ctx,
        BpmnElementType.SERVICE_TASK
      );

      expect(isLeft(result)).toBe(true);
      if (isLeft(result)) {
        expect(result.value.message).toBe("activation failed");
        expect(result.value.errorType).toBe(ErrorType.IO_MAPPING_ERROR);
      }
    });

    it("should return failure from finalizeActivation", () => {
      registry.register(
        BpmnElementType.SERVICE_TASK,
        new FailOnFinalizeActivationProcessor()
      );

      const result = streamProcessor.processActivateElement(
        {},
        ctx,
        BpmnElementType.SERVICE_TASK
      );

      expect(isLeft(result)).toBe(true);
      if (isLeft(result)) {
        expect(result.value.message).toBe("finalize failed");
      }
    });

    it("should invoke container onChildActivating before processor hooks", () => {
      const taskProcessor = new TrackingProcessor();
      const containerProcessor = new TrackingContainerProcessor();
      registry.register(BpmnElementType.SERVICE_TASK, taskProcessor);
      registry.register(BpmnElementType.PROCESS, containerProcessor);

      const containerCtx: ContainerContext<unknown> = {
        containerElement: {},
        flowScopeContext: makeContext({ elementInstanceKey: 0, elementId: "Process_1" }),
        containerType: BpmnElementType.PROCESS,
      };

      const result = streamProcessor.processActivateElement(
        {},
        ctx,
        BpmnElementType.SERVICE_TASK,
        containerCtx
      );

      expect(isRight(result)).toBe(true);
      expect(containerProcessor.calls).toEqual(["onChildActivating"]);
      expect(taskProcessor.calls).toEqual(["onActivate", "finalizeActivation"]);
    });

    it("should stop processing when container onChildActivating fails", () => {
      const taskProcessor = new TrackingProcessor();
      registry.register(BpmnElementType.SERVICE_TASK, taskProcessor);
      registry.register(
        BpmnElementType.SUB_PROCESS,
        new FailOnChildActivatingProcessor()
      );

      const containerCtx: ContainerContext<unknown> = {
        containerElement: {},
        flowScopeContext: makeContext({ elementInstanceKey: 0 }),
        containerType: BpmnElementType.SUB_PROCESS,
      };

      const result = streamProcessor.processActivateElement(
        {},
        ctx,
        BpmnElementType.SERVICE_TASK,
        containerCtx
      );

      expect(isLeft(result)).toBe(true);
      if (isLeft(result)) {
        expect(result.value.message).toBe("child activation rejected");
      }
      // Task processor hooks should NOT have been called
      expect(taskProcessor.calls).toEqual([]);
    });

    it("should reject container context with non-container type", () => {
      registry.register(BpmnElementType.SERVICE_TASK, new TrackingProcessor());
      registry.register(BpmnElementType.USER_TASK, new TrackingProcessor());

      const containerCtx: ContainerContext<unknown> = {
        containerElement: {},
        flowScopeContext: makeContext(),
        containerType: BpmnElementType.USER_TASK,
      };

      const result = streamProcessor.processActivateElement(
        {},
        ctx,
        BpmnElementType.SERVICE_TASK,
        containerCtx
      );

      expect(isLeft(result)).toBe(true);
      if (isLeft(result)) {
        expect(result.value.message).toContain("not a container type");
      }
    });
  });

  describe("processCompleteElement", () => {
    it("should invoke onComplete then finalizeCompletion in order", () => {
      const processor = new TrackingProcessor();
      registry.register(BpmnElementType.SERVICE_TASK, processor);

      const result = streamProcessor.processCompleteElement(
        {},
        ctx,
        BpmnElementType.SERVICE_TASK
      );

      expect(isRight(result)).toBe(true);
      expect(processor.calls).toEqual(["onComplete", "finalizeCompletion"]);
    });

    it("should stop at onComplete failure without calling finalizeCompletion", () => {
      registry.register(
        BpmnElementType.SERVICE_TASK,
        new FailOnCompleteProcessor()
      );

      const result = streamProcessor.processCompleteElement(
        {},
        ctx,
        BpmnElementType.SERVICE_TASK
      );

      expect(isLeft(result)).toBe(true);
      if (isLeft(result)) {
        expect(result.value.message).toBe("completion failed");
        expect(result.value.errorType).toBe(ErrorType.CONDITION_ERROR);
      }
    });

    it("should return failure from finalizeCompletion", () => {
      registry.register(
        BpmnElementType.SERVICE_TASK,
        new FailOnFinalizeCompletionProcessor()
      );

      const result = streamProcessor.processCompleteElement(
        {},
        ctx,
        BpmnElementType.SERVICE_TASK
      );

      expect(isLeft(result)).toBe(true);
      if (isLeft(result)) {
        expect(result.value.message).toBe("finalize completion failed");
      }
    });

    it("should invoke container onChildCompleting before processor hooks", () => {
      const taskProcessor = new TrackingProcessor();
      const containerProcessor = new TrackingContainerProcessor();
      registry.register(BpmnElementType.USER_TASK, taskProcessor);
      registry.register(BpmnElementType.PROCESS, containerProcessor);

      const containerCtx: ContainerContext<unknown> = {
        containerElement: {},
        flowScopeContext: makeContext({ elementInstanceKey: 0, elementId: "Process_1" }),
        containerType: BpmnElementType.PROCESS,
      };

      const result = streamProcessor.processCompleteElement(
        {},
        ctx,
        BpmnElementType.USER_TASK,
        containerCtx
      );

      expect(isRight(result)).toBe(true);
      expect(containerProcessor.calls).toEqual(["onChildCompleting"]);
      expect(taskProcessor.calls).toEqual(["onComplete", "finalizeCompletion"]);
    });

    it("should stop processing when container onChildCompleting fails", () => {
      const taskProcessor = new TrackingProcessor();
      registry.register(BpmnElementType.USER_TASK, taskProcessor);
      registry.register(
        BpmnElementType.PROCESS,
        new FailOnChildCompletingProcessor()
      );

      const containerCtx: ContainerContext<unknown> = {
        containerElement: {},
        flowScopeContext: makeContext({ elementInstanceKey: 0 }),
        containerType: BpmnElementType.PROCESS,
      };

      const result = streamProcessor.processCompleteElement(
        {},
        ctx,
        BpmnElementType.USER_TASK,
        containerCtx
      );

      expect(isLeft(result)).toBe(true);
      if (isLeft(result)) {
        expect(result.value.message).toBe("child completion rejected");
        expect(result.value.errorType).toBe(ErrorType.EXTRACT_VALUE_ERROR);
      }
      // Task processor hooks should NOT have been called
      expect(taskProcessor.calls).toEqual([]);
    });

    it("should reject container context with non-container type", () => {
      registry.register(BpmnElementType.USER_TASK, new TrackingProcessor());
      registry.register(BpmnElementType.SERVICE_TASK, new TrackingProcessor());

      const containerCtx: ContainerContext<unknown> = {
        containerElement: {},
        flowScopeContext: makeContext(),
        containerType: BpmnElementType.SERVICE_TASK,
      };

      const result = streamProcessor.processCompleteElement(
        {},
        ctx,
        BpmnElementType.USER_TASK,
        containerCtx
      );

      expect(isLeft(result)).toBe(true);
      if (isLeft(result)) {
        expect(result.value.message).toContain("not a container type");
      }
    });
  });

  describe("processTerminateElement", () => {
    it("should invoke onTerminate and finalizeTermination when CONTINUE", () => {
      const processor = new TrackingProcessor();
      registry.register(BpmnElementType.SERVICE_TASK, processor);

      const outcome = streamProcessor.processTerminateElement(
        {},
        ctx,
        BpmnElementType.SERVICE_TASK
      );

      expect(outcome).toBe(TransitionOutcome.CONTINUE);
      expect(processor.calls).toEqual(["onTerminate", "finalizeTermination"]);
    });

    it("should invoke onTerminate but NOT finalizeTermination when AWAIT", () => {
      const processor = new AwaitingTerminationProcessor();
      registry.register(BpmnElementType.SERVICE_TASK, processor);

      const outcome = streamProcessor.processTerminateElement(
        {},
        ctx,
        BpmnElementType.SERVICE_TASK
      );

      expect(outcome).toBe(TransitionOutcome.AWAIT);
      expect(processor.calls).toEqual(["onTerminate"]);
    });
  });

  describe("processCommand", () => {
    it("should route ACTIVATE_ELEMENT to dual-phase activation", () => {
      const processor = new TrackingProcessor();
      registry.register(BpmnElementType.SERVICE_TASK, processor);

      const result = streamProcessor.processCommand(
        ProcessInstanceIntent.ACTIVATE_ELEMENT,
        {},
        ctx,
        BpmnElementType.SERVICE_TASK
      );

      expect(isRight(result)).toBe(true);
      if (isRight(result)) {
        expect(result.value).toBe(TransitionOutcome.CONTINUE);
      }
      expect(processor.calls).toEqual(["onActivate", "finalizeActivation"]);
    });

    it("should route COMPLETE_ELEMENT to dual-phase completion", () => {
      const processor = new TrackingProcessor();
      registry.register(BpmnElementType.USER_TASK, processor);

      const result = streamProcessor.processCommand(
        ProcessInstanceIntent.COMPLETE_ELEMENT,
        {},
        ctx,
        BpmnElementType.USER_TASK
      );

      expect(isRight(result)).toBe(true);
      if (isRight(result)) {
        expect(result.value).toBe(TransitionOutcome.CONTINUE);
      }
      expect(processor.calls).toEqual(["onComplete", "finalizeCompletion"]);
    });

    it("should route TERMINATE_ELEMENT and return TransitionOutcome", () => {
      const processor = new AwaitingTerminationProcessor();
      registry.register(BpmnElementType.SERVICE_TASK, processor);

      const result = streamProcessor.processCommand(
        ProcessInstanceIntent.TERMINATE_ELEMENT,
        {},
        ctx,
        BpmnElementType.SERVICE_TASK
      );

      expect(isRight(result)).toBe(true);
      if (isRight(result)) {
        expect(result.value).toBe(TransitionOutcome.AWAIT);
      }
    });

    it("should return failure for unsupported intents", () => {
      registry.register(BpmnElementType.SERVICE_TASK, new TrackingProcessor());

      const result = streamProcessor.processCommand(
        ProcessInstanceIntent.CANCEL,
        {},
        ctx,
        BpmnElementType.SERVICE_TASK
      );

      expect(isLeft(result)).toBe(true);
      if (isLeft(result)) {
        expect(result.value.message).toContain("Unsupported command intent");
        expect(result.value.message).toContain("CANCEL");
      }
    });

    it("should propagate activation failure through processCommand", () => {
      registry.register(
        BpmnElementType.SERVICE_TASK,
        new FailOnActivateProcessor()
      );

      const result = streamProcessor.processCommand(
        ProcessInstanceIntent.ACTIVATE_ELEMENT,
        {},
        ctx,
        BpmnElementType.SERVICE_TASK
      );

      expect(isLeft(result)).toBe(true);
      if (isLeft(result)) {
        expect(result.value.message).toBe("activation failed");
      }
    });

    it("should propagate completion failure through processCommand", () => {
      registry.register(
        BpmnElementType.SERVICE_TASK,
        new FailOnCompleteProcessor()
      );

      const result = streamProcessor.processCommand(
        ProcessInstanceIntent.COMPLETE_ELEMENT,
        {},
        ctx,
        BpmnElementType.SERVICE_TASK
      );

      expect(isLeft(result)).toBe(true);
      if (isLeft(result)) {
        expect(result.value.message).toBe("completion failed");
      }
    });

    it("should forward container context for ACTIVATE_ELEMENT", () => {
      const taskProcessor = new TrackingProcessor();
      const containerProcessor = new TrackingContainerProcessor();
      registry.register(BpmnElementType.SERVICE_TASK, taskProcessor);
      registry.register(BpmnElementType.PROCESS, containerProcessor);

      const containerCtx: ContainerContext<unknown> = {
        containerElement: {},
        flowScopeContext: makeContext({ elementInstanceKey: 0 }),
        containerType: BpmnElementType.PROCESS,
      };

      const result = streamProcessor.processCommand(
        ProcessInstanceIntent.ACTIVATE_ELEMENT,
        {},
        ctx,
        BpmnElementType.SERVICE_TASK,
        containerCtx
      );

      expect(isRight(result)).toBe(true);
      expect(containerProcessor.calls).toEqual(["onChildActivating"]);
    });

    it("should throw when processor not registered", () => {
      expect(() =>
        streamProcessor.processCommand(
          ProcessInstanceIntent.ACTIVATE_ELEMENT,
          {},
          ctx,
          BpmnElementType.UNSPECIFIED
        )
      ).toThrowError("No processor registered for element type: UNSPECIFIED");
    });
  });
});
