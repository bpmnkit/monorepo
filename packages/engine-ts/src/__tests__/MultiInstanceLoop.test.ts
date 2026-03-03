/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import { describe, expect, it, beforeEach, vi } from "vitest";
import { isLeft, isRight } from "../types/Either.js";
import type { Either } from "../types/Either.js";
import { TransitionOutcome } from "../processor/TransitionOutcome.js";
import { ErrorType, Failure } from "../processor/Failure.js";
import type { BpmnElementContext } from "../processor/BpmnElementContext.js";
import type { LoopCharacteristics } from "../multiinstance/LoopCharacteristics.js";
import type { MultiInstanceBody } from "../multiinstance/MultiInstanceBody.js";
import { MultiInstanceState } from "../multiinstance/MultiInstanceState.js";
import type { MultiInstanceActions } from "../multiinstance/MultiInstanceBodyProcessor.js";
import { MultiInstanceBodyProcessor } from "../multiinstance/MultiInstanceBodyProcessor.js";
import { VariableStore } from "../state/VariableStore.js";
import { VariableBehavior } from "../variable/VariableBehavior.js";
import { NO_PARENT } from "../state/VariableState.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

let nextKey = 1000;

function makeContext(overrides: Partial<BpmnElementContext> = {}): BpmnElementContext {
  const key = nextKey++;
  return {
    elementInstanceKey: key,
    flowScopeKey: 0,
    processInstanceKey: 100,
    processDefinitionKey: 200,
    elementId: `Element_${key}`,
    bpmnProcessId: "test-process",
    ...overrides,
  };
}

function makeMultiInstanceBody<T>(
  loopCharacteristics: LoopCharacteristics,
  innerActivity: T = {} as T,
  innerActivityId = "InnerTask_1"
): MultiInstanceBody<T> {
  return { loopCharacteristics, innerActivity, innerActivityId };
}

function makeMockActions(): MultiInstanceActions & {
  createdChildren: BpmnElementContext[];
  completedElements: BpmnElementContext[];
  terminatedFrom: BpmnElementContext[];
} {
  const createdChildren: BpmnElementContext[] = [];
  const completedElements: BpmnElementContext[] = [];
  const terminatedFrom: BpmnElementContext[] = [];

  return {
    createdChildren,
    completedElements,
    terminatedFrom,
    createChildInstance(
      parentContext: BpmnElementContext,
      innerActivityId: string,
      loopCounter: number
    ): BpmnElementContext {
      const child = makeContext({
        flowScopeKey: parentContext.elementInstanceKey,
        elementId: innerActivityId,
        processInstanceKey: parentContext.processInstanceKey,
        processDefinitionKey: parentContext.processDefinitionKey,
        bpmnProcessId: parentContext.bpmnProcessId,
      });
      createdChildren.push(child);
      return child;
    },
    completeElement(context: BpmnElementContext): void {
      completedElements.push(context);
    },
    terminateChildInstances(context: BpmnElementContext): boolean {
      terminatedFrom.push(context);
      return true; // default: no remaining active children
    },
  };
}

function setupProcessorAndState(): {
  store: VariableStore;
  variableBehavior: VariableBehavior;
  miState: MultiInstanceState;
  actions: ReturnType<typeof makeMockActions>;
  processor: MultiInstanceBodyProcessor<unknown>;
} {
  const store = new VariableStore();
  const variableBehavior = new VariableBehavior(store);
  const miState = new MultiInstanceState();
  const actions = makeMockActions();
  const processor = new MultiInstanceBodyProcessor(
    miState,
    variableBehavior,
    store,
    actions
  );
  return { store, variableBehavior, miState, actions, processor };
}

// ---------------------------------------------------------------------------
// Tests: LoopCharacteristics
// ---------------------------------------------------------------------------

describe("LoopCharacteristics", () => {
  it("should define sequential loop characteristics", () => {
    const lc: LoopCharacteristics = {
      isSequential: true,
      inputCollection: "items",
    };
    expect(lc.isSequential).toBe(true);
    expect(lc.inputCollection).toBe("items");
    expect(lc.inputElement).toBeUndefined();
    expect(lc.outputCollection).toBeUndefined();
    expect(lc.outputElement).toBeUndefined();
    expect(lc.completionCondition).toBeUndefined();
  });

  it("should define fully-configured loop characteristics", () => {
    const condition = vi.fn().mockReturnValue(false);
    const lc: LoopCharacteristics = {
      isSequential: false,
      inputCollection: "orders",
      inputElement: "order",
      outputCollection: "results",
      outputElement: "result",
      completionCondition: condition,
    };
    expect(lc.isSequential).toBe(false);
    expect(lc.inputElement).toBe("order");
    expect(lc.outputCollection).toBe("results");
    expect(lc.outputElement).toBe("result");
    expect(lc.completionCondition).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Tests: MultiInstanceState
// ---------------------------------------------------------------------------

describe("MultiInstanceState", () => {
  let state: MultiInstanceState;

  beforeEach(() => {
    state = new MultiInstanceState();
  });

  describe("body lifecycle", () => {
    it("should initialize body with zero counts", () => {
      state.initializeBody(1);
      const counts = state.getCounts(1);
      expect(counts).toEqual({
        totalActivated: 0,
        active: 0,
        completed: 0,
        terminated: 0,
      });
    });

    it("should return undefined for uninitialized body", () => {
      expect(state.getCounts(999)).toBeUndefined();
    });

    it("should remove body state", () => {
      state.initializeBody(1);
      state.removeBody(1);
      expect(state.getCounts(1)).toBeUndefined();
    });
  });

  describe("instance counts", () => {
    beforeEach(() => {
      state.initializeBody(1);
    });

    it("should increment activated counts", () => {
      state.incrementActivated(1);
      const counts = state.getCounts(1)!;
      expect(counts.totalActivated).toBe(1);
      expect(counts.active).toBe(1);
    });

    it("should increment completed counts", () => {
      state.incrementActivated(1);
      state.incrementCompleted(1);
      const counts = state.getCounts(1)!;
      expect(counts.active).toBe(0);
      expect(counts.completed).toBe(1);
    });

    it("should increment terminated counts", () => {
      state.incrementActivated(1);
      state.incrementTerminated(1);
      const counts = state.getCounts(1)!;
      expect(counts.active).toBe(0);
      expect(counts.terminated).toBe(1);
    });

    it("should throw for uninitialized body on increment", () => {
      expect(() => state.incrementActivated(999)).toThrow(
        "No multi-instance state initialized"
      );
    });

    it("should track multiple activations and completions", () => {
      state.incrementActivated(1);
      state.incrementActivated(1);
      state.incrementActivated(1);
      state.incrementCompleted(1);
      state.incrementTerminated(1);
      const counts = state.getCounts(1)!;
      expect(counts.totalActivated).toBe(3);
      expect(counts.active).toBe(1);
      expect(counts.completed).toBe(1);
      expect(counts.terminated).toBe(1);
    });
  });

  describe("loop counters", () => {
    it("should set and get loop counter", () => {
      state.setLoopCounter(10, 3);
      expect(state.getLoopCounter(10)).toBe(3);
    });

    it("should return 0 for unset loop counter", () => {
      expect(state.getLoopCounter(99)).toBe(0);
    });

    it("should remove loop counter", () => {
      state.setLoopCounter(10, 5);
      state.removeLoopCounter(10);
      expect(state.getLoopCounter(10)).toBe(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: MultiInstanceBodyProcessor
// ---------------------------------------------------------------------------

describe("MultiInstanceBodyProcessor", () => {
  describe("onActivate", () => {
    it("should fail if input collection variable is missing", () => {
      const { store, processor } = setupProcessorAndState();
      const ctx = makeContext();
      store.createScope(ctx.elementInstanceKey, NO_PARENT);
      const body = makeMultiInstanceBody({ isSequential: false, inputCollection: "items" });

      const result = processor.onActivate(body, ctx);
      expect(isLeft(result)).toBe(true);
      if (isLeft(result)) {
        expect(result.value.message).toContain("input collection 'items'");
        expect(result.value.errorType).toBe(ErrorType.EXTRACT_VALUE_ERROR);
      }
    });

    it("should fail if input collection is not an array", () => {
      const { store, processor } = setupProcessorAndState();
      const ctx = makeContext();
      store.createScope(ctx.elementInstanceKey, NO_PARENT);
      store.setVariableLocal(ctx.elementInstanceKey, "items", "not-an-array");
      const body = makeMultiInstanceBody({ isSequential: false, inputCollection: "items" });

      const result = processor.onActivate(body, ctx);
      expect(isLeft(result)).toBe(true);
      if (isLeft(result)) {
        expect(result.value.message).toContain("to be an array");
      }
    });

    it("should complete immediately for empty collection", () => {
      const { store, processor, actions } = setupProcessorAndState();
      const ctx = makeContext();
      store.createScope(ctx.elementInstanceKey, NO_PARENT);
      store.setVariableLocal(ctx.elementInstanceKey, "items", []);
      const body = makeMultiInstanceBody({ isSequential: false, inputCollection: "items" });

      const result = processor.onActivate(body, ctx);
      expect(isRight(result)).toBe(true);
      expect(actions.completedElements).toHaveLength(1);
      expect(actions.completedElements[0]).toBe(ctx);
    });

    it("should create one child for sequential mode", () => {
      const { store, processor, actions, miState } = setupProcessorAndState();
      const ctx = makeContext();
      store.createScope(ctx.elementInstanceKey, NO_PARENT);
      store.setVariableLocal(ctx.elementInstanceKey, "items", ["a", "b", "c"]);
      const body = makeMultiInstanceBody({
        isSequential: true,
        inputCollection: "items",
      });

      const result = processor.onActivate(body, ctx);
      expect(isRight(result)).toBe(true);
      expect(actions.createdChildren).toHaveLength(1);
      expect(actions.completedElements).toHaveLength(0);

      // Loop counter should be set for the child
      const childKey = actions.createdChildren[0].elementInstanceKey;
      expect(miState.getLoopCounter(childKey)).toBe(1);
    });

    it("should create all children for parallel mode", () => {
      const { store, processor, actions, miState } = setupProcessorAndState();
      const ctx = makeContext();
      store.createScope(ctx.elementInstanceKey, NO_PARENT);
      store.setVariableLocal(ctx.elementInstanceKey, "items", [10, 20, 30]);
      const body = makeMultiInstanceBody({
        isSequential: false,
        inputCollection: "items",
      });

      const result = processor.onActivate(body, ctx);
      expect(isRight(result)).toBe(true);
      expect(actions.createdChildren).toHaveLength(3);
      expect(miState.getLoopCounter(actions.createdChildren[0].elementInstanceKey)).toBe(1);
      expect(miState.getLoopCounter(actions.createdChildren[1].elementInstanceKey)).toBe(2);
      expect(miState.getLoopCounter(actions.createdChildren[2].elementInstanceKey)).toBe(3);
    });

    it("should initialize output collection with null values", () => {
      const { store, processor } = setupProcessorAndState();
      const ctx = makeContext();
      store.createScope(ctx.elementInstanceKey, NO_PARENT);
      store.setVariableLocal(ctx.elementInstanceKey, "items", ["a", "b"]);
      const body = makeMultiInstanceBody({
        isSequential: false,
        inputCollection: "items",
        outputCollection: "results",
      });

      processor.onActivate(body, ctx);
      const output = store.getVariableLocal(ctx.elementInstanceKey, "results");
      expect(output).toEqual([null, null]);
    });
  });

  describe("onChildActivating", () => {
    it("should set loopCounter variable on child scope", () => {
      const { store, processor, miState } = setupProcessorAndState();
      const parentCtx = makeContext();
      const childCtx = makeContext({ flowScopeKey: parentCtx.elementInstanceKey });

      store.createScope(parentCtx.elementInstanceKey, NO_PARENT);
      store.createScope(childCtx.elementInstanceKey, parentCtx.elementInstanceKey);
      store.setVariableLocal(parentCtx.elementInstanceKey, "items", ["x", "y"]);
      miState.initializeBody(parentCtx.elementInstanceKey);
      miState.setLoopCounter(childCtx.elementInstanceKey, 1);

      const body = makeMultiInstanceBody({
        isSequential: true,
        inputCollection: "items",
      });

      const result = processor.onChildActivating(body, parentCtx, childCtx);
      expect(isRight(result)).toBe(true);

      const loopCounterVar = store.getVariableLocal(
        childCtx.elementInstanceKey,
        "loopCounter"
      );
      expect(loopCounterVar).toBe(1);
    });

    it("should set input element variable on child scope", () => {
      const { store, processor, miState } = setupProcessorAndState();
      const parentCtx = makeContext();
      const childCtx = makeContext({ flowScopeKey: parentCtx.elementInstanceKey });

      store.createScope(parentCtx.elementInstanceKey, NO_PARENT);
      store.createScope(childCtx.elementInstanceKey, parentCtx.elementInstanceKey);
      store.setVariableLocal(parentCtx.elementInstanceKey, "items", ["alpha", "beta"]);
      miState.initializeBody(parentCtx.elementInstanceKey);
      miState.setLoopCounter(childCtx.elementInstanceKey, 2);

      const body = makeMultiInstanceBody({
        isSequential: false,
        inputCollection: "items",
        inputElement: "item",
      });

      const result = processor.onChildActivating(body, parentCtx, childCtx);
      expect(isRight(result)).toBe(true);

      expect(store.getVariableLocal(childCtx.elementInstanceKey, "item")).toBe("beta");
      expect(store.getVariableLocal(childCtx.elementInstanceKey, "loopCounter")).toBe(2);
    });

    it("should initialize output element with null if different from input", () => {
      const { store, processor, miState } = setupProcessorAndState();
      const parentCtx = makeContext();
      const childCtx = makeContext({ flowScopeKey: parentCtx.elementInstanceKey });

      store.createScope(parentCtx.elementInstanceKey, NO_PARENT);
      store.createScope(childCtx.elementInstanceKey, parentCtx.elementInstanceKey);
      store.setVariableLocal(parentCtx.elementInstanceKey, "items", [1]);
      miState.initializeBody(parentCtx.elementInstanceKey);
      miState.setLoopCounter(childCtx.elementInstanceKey, 1);

      const body = makeMultiInstanceBody({
        isSequential: true,
        inputCollection: "items",
        inputElement: "item",
        outputElement: "result",
      });

      processor.onChildActivating(body, parentCtx, childCtx);
      expect(store.getVariableLocal(childCtx.elementInstanceKey, "result")).toBeNull();
    });

    it("should not initialize output element if same as input element", () => {
      const { store, processor, miState } = setupProcessorAndState();
      const parentCtx = makeContext();
      const childCtx = makeContext({ flowScopeKey: parentCtx.elementInstanceKey });

      store.createScope(parentCtx.elementInstanceKey, NO_PARENT);
      store.createScope(childCtx.elementInstanceKey, parentCtx.elementInstanceKey);
      store.setVariableLocal(parentCtx.elementInstanceKey, "items", [42]);
      miState.initializeBody(parentCtx.elementInstanceKey);
      miState.setLoopCounter(childCtx.elementInstanceKey, 1);

      const body = makeMultiInstanceBody({
        isSequential: true,
        inputCollection: "items",
        inputElement: "item",
        outputElement: "item", // same as input
      });

      processor.onChildActivating(body, parentCtx, childCtx);
      // Should have the input value, not null
      expect(store.getVariableLocal(childCtx.elementInstanceKey, "item")).toBe(42);
    });

    it("should fail if loop counter not set", () => {
      const { store, processor, miState } = setupProcessorAndState();
      const parentCtx = makeContext();
      const childCtx = makeContext({ flowScopeKey: parentCtx.elementInstanceKey });

      store.createScope(parentCtx.elementInstanceKey, NO_PARENT);
      store.setVariableLocal(parentCtx.elementInstanceKey, "items", [1]);
      miState.initializeBody(parentCtx.elementInstanceKey);
      // Not setting loop counter

      const body = makeMultiInstanceBody({
        isSequential: true,
        inputCollection: "items",
      });

      const result = processor.onChildActivating(body, parentCtx, childCtx);
      expect(isLeft(result)).toBe(true);
    });

    it("should fail if loop counter exceeds collection size", () => {
      const { store, processor, miState } = setupProcessorAndState();
      const parentCtx = makeContext();
      const childCtx = makeContext({ flowScopeKey: parentCtx.elementInstanceKey });

      store.createScope(parentCtx.elementInstanceKey, NO_PARENT);
      store.createScope(childCtx.elementInstanceKey, parentCtx.elementInstanceKey);
      store.setVariableLocal(parentCtx.elementInstanceKey, "items", [1]);
      miState.initializeBody(parentCtx.elementInstanceKey);
      miState.setLoopCounter(childCtx.elementInstanceKey, 5);

      const body = makeMultiInstanceBody({
        isSequential: true,
        inputCollection: "items",
      });

      const result = processor.onChildActivating(body, parentCtx, childCtx);
      expect(isLeft(result)).toBe(true);
      if (isLeft(result)) {
        expect(result.value.message).toContain("index 4");
        expect(result.value.message).toContain("only 1 elements");
      }
    });

    it("should track activation in MI state counters", () => {
      const { store, processor, miState } = setupProcessorAndState();
      const parentCtx = makeContext();
      const childCtx = makeContext({ flowScopeKey: parentCtx.elementInstanceKey });

      store.createScope(parentCtx.elementInstanceKey, NO_PARENT);
      store.createScope(childCtx.elementInstanceKey, parentCtx.elementInstanceKey);
      store.setVariableLocal(parentCtx.elementInstanceKey, "items", ["a"]);
      miState.initializeBody(parentCtx.elementInstanceKey);
      miState.setLoopCounter(childCtx.elementInstanceKey, 1);

      const body = makeMultiInstanceBody({
        isSequential: true,
        inputCollection: "items",
      });

      processor.onChildActivating(body, parentCtx, childCtx);
      const counts = miState.getCounts(parentCtx.elementInstanceKey)!;
      expect(counts.totalActivated).toBe(1);
      expect(counts.active).toBe(1);
    });
  });

  describe("beforeExecutionPathCompleted", () => {
    it("should update output collection at loop index", () => {
      const { store, processor, miState } = setupProcessorAndState();
      const parentCtx = makeContext();
      const childCtx = makeContext({ flowScopeKey: parentCtx.elementInstanceKey });

      store.createScope(parentCtx.elementInstanceKey, NO_PARENT);
      store.createScope(childCtx.elementInstanceKey, parentCtx.elementInstanceKey);
      store.setVariableLocal(parentCtx.elementInstanceKey, "items", ["a", "b"]);
      store.setVariableLocal(parentCtx.elementInstanceKey, "results", [null, null]);
      store.setVariableLocal(childCtx.elementInstanceKey, "result", "done-a");
      miState.initializeBody(parentCtx.elementInstanceKey);
      miState.incrementActivated(parentCtx.elementInstanceKey);
      miState.setLoopCounter(childCtx.elementInstanceKey, 1);

      const body = makeMultiInstanceBody({
        isSequential: true,
        inputCollection: "items",
        outputCollection: "results",
        outputElement: "result",
      });

      const result = processor.beforeExecutionPathCompleted(body, parentCtx, childCtx);
      expect(isRight(result)).toBe(true);

      const output = store.getVariableLocal(parentCtx.elementInstanceKey, "results");
      expect(output).toEqual(["done-a", null]);
    });

    it("should succeed without output collection configured", () => {
      const { store, processor, miState } = setupProcessorAndState();
      const parentCtx = makeContext();
      const childCtx = makeContext({ flowScopeKey: parentCtx.elementInstanceKey });

      store.createScope(parentCtx.elementInstanceKey, NO_PARENT);
      store.setVariableLocal(parentCtx.elementInstanceKey, "items", ["a"]);
      miState.initializeBody(parentCtx.elementInstanceKey);
      miState.incrementActivated(parentCtx.elementInstanceKey);

      const body = makeMultiInstanceBody({
        isSequential: true,
        inputCollection: "items",
      });

      const result = processor.beforeExecutionPathCompleted(body, parentCtx, childCtx);
      expect(isRight(result)).toBe(true);
    });
  });

  describe("afterExecutionPathCompleted — sequential", () => {
    it("should create next child when more items remain", () => {
      const { store, processor, miState, actions } = setupProcessorAndState();
      const parentCtx = makeContext();
      const childCtx = makeContext({ flowScopeKey: parentCtx.elementInstanceKey });

      store.createScope(parentCtx.elementInstanceKey, NO_PARENT);
      store.setVariableLocal(parentCtx.elementInstanceKey, "items", ["a", "b", "c"]);
      miState.initializeBody(parentCtx.elementInstanceKey);
      miState.incrementActivated(parentCtx.elementInstanceKey);
      miState.setLoopCounter(childCtx.elementInstanceKey, 1);

      const body = makeMultiInstanceBody({
        isSequential: true,
        inputCollection: "items",
      });

      processor.afterExecutionPathCompleted(body, parentCtx, childCtx, undefined);

      // Should record completion
      const counts = miState.getCounts(parentCtx.elementInstanceKey)!;
      expect(counts.completed).toBe(1);

      // Should create the next child (loopCounter=2)
      expect(actions.createdChildren).toHaveLength(1);
      expect(actions.completedElements).toHaveLength(0);
    });

    it("should complete when last sequential child finishes", () => {
      const { store, processor, miState, actions } = setupProcessorAndState();
      const parentCtx = makeContext();
      const childCtx = makeContext({ flowScopeKey: parentCtx.elementInstanceKey });

      store.createScope(parentCtx.elementInstanceKey, NO_PARENT);
      store.setVariableLocal(parentCtx.elementInstanceKey, "items", ["only"]);
      miState.initializeBody(parentCtx.elementInstanceKey);
      miState.incrementActivated(parentCtx.elementInstanceKey);
      miState.setLoopCounter(childCtx.elementInstanceKey, 1);

      const body = makeMultiInstanceBody({
        isSequential: true,
        inputCollection: "items",
      });

      processor.afterExecutionPathCompleted(body, parentCtx, childCtx, undefined);

      expect(actions.completedElements).toHaveLength(1);
      expect(actions.completedElements[0]).toBe(parentCtx);
    });
  });

  describe("afterExecutionPathCompleted — parallel", () => {
    it("should complete when all parallel children finish", () => {
      const { store, processor, miState, actions } = setupProcessorAndState();
      const parentCtx = makeContext();

      store.createScope(parentCtx.elementInstanceKey, NO_PARENT);
      store.setVariableLocal(parentCtx.elementInstanceKey, "items", ["x", "y"]);
      miState.initializeBody(parentCtx.elementInstanceKey);
      miState.incrementActivated(parentCtx.elementInstanceKey);
      miState.incrementActivated(parentCtx.elementInstanceKey);

      const body = makeMultiInstanceBody({
        isSequential: false,
        inputCollection: "items",
      });

      // First child completes
      const child1 = makeContext({ flowScopeKey: parentCtx.elementInstanceKey });
      miState.setLoopCounter(child1.elementInstanceKey, 1);
      processor.afterExecutionPathCompleted(body, parentCtx, child1, undefined);

      expect(actions.completedElements).toHaveLength(0); // still 1 active

      // Second child completes
      const child2 = makeContext({ flowScopeKey: parentCtx.elementInstanceKey });
      miState.setLoopCounter(child2.elementInstanceKey, 2);
      processor.afterExecutionPathCompleted(body, parentCtx, child2, undefined);

      expect(actions.completedElements).toHaveLength(1);
    });
  });

  describe("completion condition", () => {
    it("should complete early when condition is satisfied", () => {
      const { store, processor, miState, actions } = setupProcessorAndState();
      const parentCtx = makeContext();
      const childCtx = makeContext({ flowScopeKey: parentCtx.elementInstanceKey });

      store.createScope(parentCtx.elementInstanceKey, NO_PARENT);
      store.setVariableLocal(parentCtx.elementInstanceKey, "items", [1, 2, 3, 4, 5]);
      miState.initializeBody(parentCtx.elementInstanceKey);
      // Simulate 3 activated, 0 completed yet
      miState.incrementActivated(parentCtx.elementInstanceKey);
      miState.incrementActivated(parentCtx.elementInstanceKey);
      miState.incrementActivated(parentCtx.elementInstanceKey);

      const body = makeMultiInstanceBody({
        isSequential: false,
        inputCollection: "items",
        completionCondition: (ctx) => ctx.numberOfCompletedInstances >= 1,
      });

      processor.afterExecutionPathCompleted(body, parentCtx, childCtx, undefined);

      // Should terminate remaining children
      expect(actions.terminatedFrom).toHaveLength(1);
      // Should complete the MI body
      expect(actions.completedElements).toHaveLength(1);
    });

    it("should provide adjusted counters to condition (active-1, completed+1)", () => {
      const { store, processor, miState } = setupProcessorAndState();
      const parentCtx = makeContext();
      const childCtx = makeContext({ flowScopeKey: parentCtx.elementInstanceKey });

      store.createScope(parentCtx.elementInstanceKey, NO_PARENT);
      store.setVariableLocal(parentCtx.elementInstanceKey, "items", [1, 2, 3]);
      miState.initializeBody(parentCtx.elementInstanceKey);
      miState.incrementActivated(parentCtx.elementInstanceKey);
      miState.incrementActivated(parentCtx.elementInstanceKey);
      miState.incrementActivated(parentCtx.elementInstanceKey);

      let capturedContext: { numberOfActiveInstances: number; numberOfCompletedInstances: number } | undefined;
      const body = makeMultiInstanceBody({
        isSequential: false,
        inputCollection: "items",
        completionCondition: (ctx) => {
          capturedContext = ctx;
          return false; // don't complete
        },
      });

      processor.afterExecutionPathCompleted(body, parentCtx, childCtx, undefined);

      // At this point: 3 activated, 3 active, 0 completed
      // Condition is evaluated BEFORE incrementCompleted (matching Zeebe behavior)
      // Adjustments: active-1=2, completed+1=1
      expect(capturedContext).toBeDefined();
      expect(capturedContext!.numberOfActiveInstances).toBe(2);
      expect(capturedContext!.numberOfCompletedInstances).toBe(1);
    });

    it("should not complete early when condition returns false", () => {
      const { store, processor, miState, actions } = setupProcessorAndState();
      const parentCtx = makeContext();
      const childCtx = makeContext({ flowScopeKey: parentCtx.elementInstanceKey });

      store.createScope(parentCtx.elementInstanceKey, NO_PARENT);
      store.setVariableLocal(parentCtx.elementInstanceKey, "items", [1, 2, 3]);
      miState.initializeBody(parentCtx.elementInstanceKey);
      miState.incrementActivated(parentCtx.elementInstanceKey);
      miState.incrementActivated(parentCtx.elementInstanceKey);
      miState.incrementActivated(parentCtx.elementInstanceKey);

      const body = makeMultiInstanceBody({
        isSequential: false,
        inputCollection: "items",
        completionCondition: () => false,
      });

      processor.afterExecutionPathCompleted(body, parentCtx, childCtx, undefined);

      expect(actions.terminatedFrom).toHaveLength(0);
      expect(actions.completedElements).toHaveLength(0);
    });

    it("should handle completion condition that throws", () => {
      const { store, processor, miState, actions } = setupProcessorAndState();
      const parentCtx = makeContext();
      const childCtx = makeContext({ flowScopeKey: parentCtx.elementInstanceKey });

      store.createScope(parentCtx.elementInstanceKey, NO_PARENT);
      store.setVariableLocal(parentCtx.elementInstanceKey, "items", [1]);
      miState.initializeBody(parentCtx.elementInstanceKey);
      miState.incrementActivated(parentCtx.elementInstanceKey);

      const body = makeMultiInstanceBody({
        isSequential: true,
        inputCollection: "items",
        completionCondition: () => {
          throw new Error("eval failed");
        },
      });

      // Should not throw — treated as condition not satisfied
      processor.afterExecutionPathCompleted(body, parentCtx, childCtx, undefined);
      // Should complete normally since it's the last item
      expect(actions.completedElements).toHaveLength(1);
    });

    it("should validate completion condition in beforeExecutionPathCompleted", () => {
      const { store, processor, miState } = setupProcessorAndState();
      const parentCtx = makeContext();
      const childCtx = makeContext({ flowScopeKey: parentCtx.elementInstanceKey });

      store.createScope(parentCtx.elementInstanceKey, NO_PARENT);
      store.setVariableLocal(parentCtx.elementInstanceKey, "items", [1]);
      // State NOT initialized → should fail condition evaluation
      // Actually let's test a throwing condition in before path
      miState.initializeBody(parentCtx.elementInstanceKey);
      miState.incrementActivated(parentCtx.elementInstanceKey);

      const body = makeMultiInstanceBody({
        isSequential: true,
        inputCollection: "items",
        completionCondition: () => {
          throw new Error("bad expression");
        },
      });

      const result = processor.beforeExecutionPathCompleted(body, parentCtx, childCtx);
      expect(isLeft(result)).toBe(true);
      if (isLeft(result)) {
        expect(result.value.errorType).toBe(ErrorType.CONDITION_ERROR);
      }
    });
  });

  describe("onChildTerminated", () => {
    it("should increment terminated count", () => {
      const { store, processor, miState } = setupProcessorAndState();
      const parentCtx = makeContext();
      const childCtx = makeContext({ flowScopeKey: parentCtx.elementInstanceKey });

      miState.initializeBody(parentCtx.elementInstanceKey);
      miState.incrementActivated(parentCtx.elementInstanceKey);
      miState.setLoopCounter(childCtx.elementInstanceKey, 1);

      const body = makeMultiInstanceBody({
        isSequential: false,
        inputCollection: "items",
      });

      processor.onChildTerminated(body, parentCtx, childCtx);

      const counts = miState.getCounts(parentCtx.elementInstanceKey)!;
      expect(counts.terminated).toBe(1);
      expect(counts.active).toBe(0);
    });

    it("should clean up child loop counter", () => {
      const { processor, miState } = setupProcessorAndState();
      const parentCtx = makeContext();
      const childCtx = makeContext({ flowScopeKey: parentCtx.elementInstanceKey });

      miState.initializeBody(parentCtx.elementInstanceKey);
      miState.incrementActivated(parentCtx.elementInstanceKey);
      miState.setLoopCounter(childCtx.elementInstanceKey, 1);

      const body = makeMultiInstanceBody({
        isSequential: false,
        inputCollection: "items",
      });

      processor.onChildTerminated(body, parentCtx, childCtx);

      expect(miState.getLoopCounter(childCtx.elementInstanceKey)).toBe(0);
    });
  });

  describe("onTerminate", () => {
    it("should terminate child instances and return CONTINUE", () => {
      const { processor, miState, actions } = setupProcessorAndState();
      const ctx = makeContext();
      miState.initializeBody(ctx.elementInstanceKey);

      const body = makeMultiInstanceBody({
        isSequential: false,
        inputCollection: "items",
      });

      const outcome = processor.onTerminate(body, ctx);
      expect(outcome).toBe(TransitionOutcome.CONTINUE);
      expect(actions.terminatedFrom).toHaveLength(1);
    });

    it("should clean up MI state when no active children", () => {
      const { processor, miState, actions } = setupProcessorAndState();
      const ctx = makeContext();
      miState.initializeBody(ctx.elementInstanceKey);

      const body = makeMultiInstanceBody({
        isSequential: false,
        inputCollection: "items",
      });

      processor.onTerminate(body, ctx);
      // State should be removed since terminateChildInstances returns true (no active)
      expect(miState.getCounts(ctx.elementInstanceKey)).toBeUndefined();
    });
  });

  describe("onComplete", () => {
    it("should propagate output collection to parent scope", () => {
      const { store, processor, miState } = setupProcessorAndState();
      const parentCtx = makeContext();
      const miCtx = makeContext({ flowScopeKey: parentCtx.elementInstanceKey });

      store.createScope(parentCtx.elementInstanceKey, NO_PARENT);
      store.createScope(miCtx.elementInstanceKey, parentCtx.elementInstanceKey);
      store.setVariableLocal(miCtx.elementInstanceKey, "results", ["done1", "done2"]);
      miState.initializeBody(miCtx.elementInstanceKey);

      const body = makeMultiInstanceBody({
        isSequential: false,
        inputCollection: "items",
        outputCollection: "results",
      });

      const result = processor.onComplete(body, miCtx);
      expect(isRight(result)).toBe(true);

      // Output collection should be propagated to parent scope
      const parentResults = store.getVariableLocal(parentCtx.elementInstanceKey, "results");
      expect(parentResults).toEqual(["done1", "done2"]);
    });

    it("should succeed without output collection", () => {
      const { processor, miState } = setupProcessorAndState();
      const ctx = makeContext();
      miState.initializeBody(ctx.elementInstanceKey);

      const body = makeMultiInstanceBody({
        isSequential: true,
        inputCollection: "items",
      });

      const result = processor.onComplete(body, ctx);
      expect(isRight(result)).toBe(true);
    });
  });

  describe("finalizeCompletion", () => {
    it("should remove MI body state", () => {
      const { processor, miState } = setupProcessorAndState();
      const ctx = makeContext();
      miState.initializeBody(ctx.elementInstanceKey);

      const body = makeMultiInstanceBody({
        isSequential: true,
        inputCollection: "items",
      });

      processor.finalizeCompletion(body, ctx);
      expect(miState.getCounts(ctx.elementInstanceKey)).toBeUndefined();
    });
  });

  describe("end-to-end sequential flow", () => {
    it("should process 3 items sequentially with output collection", () => {
      const { store, processor, miState, actions } = setupProcessorAndState();
      const miCtx = makeContext();

      store.createScope(miCtx.elementInstanceKey, NO_PARENT);
      store.setVariableLocal(miCtx.elementInstanceKey, "items", ["a", "b", "c"]);

      const body = makeMultiInstanceBody({
        isSequential: true,
        inputCollection: "items",
        inputElement: "item",
        outputCollection: "results",
        outputElement: "result",
      });

      // Step 1: Activate MI body
      processor.onActivate(body, miCtx);
      expect(actions.createdChildren).toHaveLength(1);

      // Step 2: First child activating
      const child1 = actions.createdChildren[0];
      store.createScope(child1.elementInstanceKey, miCtx.elementInstanceKey);
      processor.onChildActivating(body, miCtx, child1);
      expect(store.getVariableLocal(child1.elementInstanceKey, "item")).toBe("a");
      expect(store.getVariableLocal(child1.elementInstanceKey, "loopCounter")).toBe(1);

      // Step 3: First child sets output and completes
      store.setVariableLocal(child1.elementInstanceKey, "result", "DONE-a");
      processor.beforeExecutionPathCompleted(body, miCtx, child1);

      const output1 = store.getVariableLocal(miCtx.elementInstanceKey, "results");
      expect(output1).toEqual(["DONE-a", null, null]);

      processor.afterExecutionPathCompleted(body, miCtx, child1, undefined);
      expect(actions.createdChildren).toHaveLength(2); // second child created

      // Step 4: Second child activating
      const child2 = actions.createdChildren[1];
      store.createScope(child2.elementInstanceKey, miCtx.elementInstanceKey);
      processor.onChildActivating(body, miCtx, child2);
      expect(store.getVariableLocal(child2.elementInstanceKey, "item")).toBe("b");

      // Step 5: Second child completes
      store.setVariableLocal(child2.elementInstanceKey, "result", "DONE-b");
      processor.beforeExecutionPathCompleted(body, miCtx, child2);
      processor.afterExecutionPathCompleted(body, miCtx, child2, undefined);
      expect(actions.createdChildren).toHaveLength(3);

      // Step 6: Third child activating and completing
      const child3 = actions.createdChildren[2];
      store.createScope(child3.elementInstanceKey, miCtx.elementInstanceKey);
      processor.onChildActivating(body, miCtx, child3);
      expect(store.getVariableLocal(child3.elementInstanceKey, "item")).toBe("c");

      store.setVariableLocal(child3.elementInstanceKey, "result", "DONE-c");
      processor.beforeExecutionPathCompleted(body, miCtx, child3);
      processor.afterExecutionPathCompleted(body, miCtx, child3, undefined);

      // MI body should now be complete
      expect(actions.completedElements).toHaveLength(1);

      const finalOutput = store.getVariableLocal(miCtx.elementInstanceKey, "results");
      expect(finalOutput).toEqual(["DONE-a", "DONE-b", "DONE-c"]);
    });
  });

  describe("end-to-end parallel flow with completion condition", () => {
    it("should terminate remaining when condition met after 2 of 5", () => {
      const { store, processor, miState, actions } = setupProcessorAndState();
      const miCtx = makeContext();

      store.createScope(miCtx.elementInstanceKey, NO_PARENT);
      store.setVariableLocal(miCtx.elementInstanceKey, "items", [1, 2, 3, 4, 5]);

      const body = makeMultiInstanceBody({
        isSequential: false,
        inputCollection: "items",
        completionCondition: (ctx) => ctx.numberOfCompletedInstances >= 2,
      });

      // Activate — creates 5 children
      processor.onActivate(body, miCtx);
      expect(actions.createdChildren).toHaveLength(5);

      // Simulate onChildActivating for all 5
      for (const child of actions.createdChildren) {
        store.createScope(child.elementInstanceKey, miCtx.elementInstanceKey);
        processor.onChildActivating(body, miCtx, child);
      }

      // First child completes — condition not yet met (completed=1)
      const child1 = actions.createdChildren[0];
      processor.afterExecutionPathCompleted(body, miCtx, child1, undefined);
      expect(actions.completedElements).toHaveLength(0);
      expect(actions.terminatedFrom).toHaveLength(0);

      // Second child completes — condition met (completed=2)
      const child2 = actions.createdChildren[1];
      processor.afterExecutionPathCompleted(body, miCtx, child2, undefined);
      expect(actions.terminatedFrom).toHaveLength(1);
      expect(actions.completedElements).toHaveLength(1);
    });
  });
});
