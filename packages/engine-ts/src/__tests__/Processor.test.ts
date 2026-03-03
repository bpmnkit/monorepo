/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import { describe, expect, it } from "vitest";
import { TransitionOutcome } from "../processor/TransitionOutcome.js";
import { Failure, ErrorType } from "../processor/Failure.js";
import { AbstractBpmnElementProcessor } from "../processor/BpmnElementProcessor.js";
import { AbstractBpmnElementContainerProcessor } from "../processor/BpmnElementContainerProcessor.js";
import { isRight } from "../types/Either.js";
import type { BpmnElementContext } from "../processor/BpmnElementContext.js";

describe("TransitionOutcome", () => {
  it("should have CONTINUE and AWAIT values", () => {
    expect(TransitionOutcome.CONTINUE).toBe("CONTINUE");
    expect(TransitionOutcome.AWAIT).toBe("AWAIT");
  });
});

describe("Failure", () => {
  it("should create a failure with message only", () => {
    const failure = new Failure("something went wrong");
    expect(failure.message).toBe("something went wrong");
    expect(failure.errorType).toBeUndefined();
    expect(failure.variableScopeKey).toBe(-1);
  });

  it("should create a failure with message and error type", () => {
    const failure = new Failure("bad mapping", ErrorType.IO_MAPPING_ERROR);
    expect(failure.message).toBe("bad mapping");
    expect(failure.errorType).toBe(ErrorType.IO_MAPPING_ERROR);
    expect(failure.variableScopeKey).toBe(-1);
  });

  it("should create a failure with all fields", () => {
    const failure = new Failure(
      "condition error",
      ErrorType.CONDITION_ERROR,
      42
    );
    expect(failure.message).toBe("condition error");
    expect(failure.errorType).toBe(ErrorType.CONDITION_ERROR);
    expect(failure.variableScopeKey).toBe(42);
  });

  it("should produce a readable toString", () => {
    const failure = new Failure("test", ErrorType.UNKNOWN, 7);
    expect(failure.toString()).toContain("test");
    expect(failure.toString()).toContain("UNKNOWN");
    expect(failure.toString()).toContain("7");
  });
});

describe("AbstractBpmnElementProcessor", () => {
  // Minimal concrete subclass for testing defaults
  class TestProcessor extends AbstractBpmnElementProcessor<unknown> {}

  const processor = new TestProcessor();
  const ctx: BpmnElementContext = {
    elementInstanceKey: 1,
    flowScopeKey: 0,
    processInstanceKey: 100,
    processDefinitionKey: 200,
    elementId: "Task_1",
    bpmnProcessId: "test-process",
  };

  it("should return success from default onActivate", () => {
    const result = processor.onActivate({}, ctx);
    expect(isRight(result)).toBe(true);
  });

  it("should return success from default finalizeActivation", () => {
    const result = processor.finalizeActivation({}, ctx);
    expect(isRight(result)).toBe(true);
  });

  it("should return success from default onComplete", () => {
    const result = processor.onComplete({}, ctx);
    expect(isRight(result)).toBe(true);
  });

  it("should return success from default finalizeCompletion", () => {
    const result = processor.finalizeCompletion({}, ctx);
    expect(isRight(result)).toBe(true);
  });

  it("should return CONTINUE from default onTerminate", () => {
    const result = processor.onTerminate({}, ctx);
    expect(result).toBe(TransitionOutcome.CONTINUE);
  });

  it("should not throw from default finalizeTermination", () => {
    expect(() => processor.finalizeTermination({}, ctx)).not.toThrow();
  });
});

describe("AbstractBpmnElementContainerProcessor", () => {
  // Concrete subclass implementing the two abstract methods
  class TestContainerProcessor extends AbstractBpmnElementContainerProcessor<unknown> {
    afterExecutionPathCompleted(): void {
      // concrete implementation required by abstract class
    }

    onChildTerminated(): void {
      // concrete implementation required by abstract class
    }
  }

  const processor = new TestContainerProcessor();
  const ctx: BpmnElementContext = {
    elementInstanceKey: 1,
    flowScopeKey: 0,
    processInstanceKey: 100,
    processDefinitionKey: 200,
    elementId: "SubProcess_1",
    bpmnProcessId: "test-process",
  };
  const childCtx: BpmnElementContext = {
    elementInstanceKey: 2,
    flowScopeKey: 1,
    processInstanceKey: 100,
    processDefinitionKey: 200,
    elementId: "Task_1",
    bpmnProcessId: "test-process",
  };

  // Inherited BpmnElementProcessor defaults

  it("should return success from default onActivate", () => {
    expect(isRight(processor.onActivate({}, ctx))).toBe(true);
  });

  it("should return success from default finalizeActivation", () => {
    expect(isRight(processor.finalizeActivation({}, ctx))).toBe(true);
  });

  it("should return success from default onComplete", () => {
    expect(isRight(processor.onComplete({}, ctx))).toBe(true);
  });

  it("should return success from default finalizeCompletion", () => {
    expect(isRight(processor.finalizeCompletion({}, ctx))).toBe(true);
  });

  it("should return CONTINUE from default onTerminate", () => {
    expect(processor.onTerminate({}, ctx)).toBe(TransitionOutcome.CONTINUE);
  });

  it("should not throw from default finalizeTermination", () => {
    expect(() => processor.finalizeTermination({}, ctx)).not.toThrow();
  });

  // Container-specific defaults

  it("should return success from default onChildActivating", () => {
    expect(isRight(processor.onChildActivating({}, ctx, childCtx))).toBe(true);
  });

  it("should return success from default onChildCompleting", () => {
    expect(isRight(processor.onChildCompleting({}, ctx, childCtx))).toBe(true);
  });

  it("should return success from default beforeExecutionPathCompleted", () => {
    expect(isRight(processor.beforeExecutionPathCompleted({}, ctx, childCtx))).toBe(true);
  });

  it("should not throw from afterExecutionPathCompleted", () => {
    expect(() =>
      processor.afterExecutionPathCompleted({}, ctx, childCtx, undefined)
    ).not.toThrow();
  });

  it("should not throw from onChildTerminated", () => {
    expect(() => processor.onChildTerminated({}, ctx, childCtx)).not.toThrow();
  });
});
