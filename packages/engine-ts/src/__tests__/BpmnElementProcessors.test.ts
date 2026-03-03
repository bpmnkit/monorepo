/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import { describe, expect, it } from "vitest";
import { BpmnElementType } from "../types/BpmnElementType.js";
import { BpmnElementProcessors } from "../processor/BpmnElementProcessors.js";
import { AbstractBpmnElementProcessor } from "../processor/BpmnElementProcessor.js";
import { AbstractBpmnElementContainerProcessor } from "../processor/BpmnElementContainerProcessor.js";
import type { BpmnElementContext } from "../processor/BpmnElementContext.js";

class StubProcessor extends AbstractBpmnElementProcessor<unknown> {}

class StubContainerProcessor extends AbstractBpmnElementContainerProcessor<unknown> {
  afterExecutionPathCompleted(
    _element: unknown,
    _flowScopeContext: BpmnElementContext,
    _childContext: BpmnElementContext,
    _satisfiesCompletionCondition: boolean | undefined
  ): void {
    // no-op
  }

  onChildTerminated(
    _element: unknown,
    _flowScopeContext: BpmnElementContext,
    _childContext: BpmnElementContext
  ): void {
    // no-op
  }
}

describe("BpmnElementProcessors", () => {
  describe("register and getProcessor", () => {
    it("should register and retrieve a processor", () => {
      const registry = new BpmnElementProcessors();
      const processor = new StubProcessor();
      registry.register(BpmnElementType.SERVICE_TASK, processor);

      const retrieved = registry.getProcessor(BpmnElementType.SERVICE_TASK);
      expect(retrieved).toBe(processor);
    });

    it("should throw when no processor is registered", () => {
      const registry = new BpmnElementProcessors();
      expect(() =>
        registry.getProcessor(BpmnElementType.USER_TASK)
      ).toThrowError("No processor registered for element type: USER_TASK");
    });

    it("should overwrite a previously registered processor", () => {
      const registry = new BpmnElementProcessors();
      const first = new StubProcessor();
      const second = new StubProcessor();
      registry.register(BpmnElementType.SERVICE_TASK, first);
      registry.register(BpmnElementType.SERVICE_TASK, second);

      expect(registry.getProcessor(BpmnElementType.SERVICE_TASK)).toBe(second);
    });
  });

  describe("getContainerProcessor", () => {
    it("should return a container processor", () => {
      const registry = new BpmnElementProcessors();
      const processor = new StubContainerProcessor();
      registry.register(BpmnElementType.PROCESS, processor);

      const retrieved = registry.getContainerProcessor(
        BpmnElementType.PROCESS
      );
      expect(retrieved).toBe(processor);
    });

    it("should throw when no processor is registered", () => {
      const registry = new BpmnElementProcessors();
      expect(() =>
        registry.getContainerProcessor(BpmnElementType.SUB_PROCESS)
      ).toThrowError(
        "No processor registered for element type: SUB_PROCESS"
      );
    });
  });

  describe("hasProcessor", () => {
    it("should return true when a processor is registered", () => {
      const registry = new BpmnElementProcessors();
      registry.register(BpmnElementType.END_EVENT, new StubProcessor());
      expect(registry.hasProcessor(BpmnElementType.END_EVENT)).toBe(true);
    });

    it("should return false when no processor is registered", () => {
      const registry = new BpmnElementProcessors();
      expect(registry.hasProcessor(BpmnElementType.END_EVENT)).toBe(false);
    });
  });

  describe("registeredTypes", () => {
    it("should return all registered element types", () => {
      const registry = new BpmnElementProcessors();
      registry.register(BpmnElementType.SERVICE_TASK, new StubProcessor());
      registry.register(BpmnElementType.USER_TASK, new StubProcessor());
      registry.register(BpmnElementType.PROCESS, new StubContainerProcessor());

      const types = registry.registeredTypes();
      expect(types.size).toBe(3);
      expect(types.has(BpmnElementType.SERVICE_TASK)).toBe(true);
      expect(types.has(BpmnElementType.USER_TASK)).toBe(true);
      expect(types.has(BpmnElementType.PROCESS)).toBe(true);
    });

    it("should return empty set when no processors registered", () => {
      const registry = new BpmnElementProcessors();
      expect(registry.registeredTypes().size).toBe(0);
    });
  });
});
