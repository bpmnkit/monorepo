/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import { BpmnElementType } from "../types/BpmnElementType.js";
import type { BpmnElementContainerProcessor } from "./BpmnElementContainerProcessor.js";
import type { BpmnElementProcessor } from "./BpmnElementProcessor.js";

/**
 * Registry that maps {@link BpmnElementType} values to their corresponding
 * {@link BpmnElementProcessor} instances.
 *
 * Mirrors `io.camunda.zeebe.engine.processing.bpmn.BpmnElementProcessors`.
 *
 * Processors are registered at initialization time and looked up during
 * command processing to dispatch lifecycle hooks.
 */
export class BpmnElementProcessors {
  private readonly processors = new Map<
    BpmnElementType,
    BpmnElementProcessor<unknown>
  >();

  /**
   * Registers a processor for the given BPMN element type.
   * Overwrites any previously registered processor for the same type.
   */
  register(
    elementType: BpmnElementType,
    processor: BpmnElementProcessor<unknown>
  ): void {
    this.processors.set(elementType, processor);
  }

  /**
   * Returns the processor registered for the given element type.
   *
   * @throws Error if no processor is registered for the element type.
   */
  getProcessor<T>(elementType: BpmnElementType): BpmnElementProcessor<T> {
    const processor = this.processors.get(elementType);
    if (!processor) {
      throw new Error(
        `No processor registered for element type: ${elementType}`
      );
    }
    return processor as BpmnElementProcessor<T>;
  }

  /**
   * Returns the processor registered for the given element type, cast to a
   * container processor. The caller must ensure the processor actually
   * implements {@link BpmnElementContainerProcessor}.
   *
   * Mirrors the unchecked cast in Zeebe's `BpmnElementProcessors.getContainerProcessor()`.
   *
   * @throws Error if no processor is registered for the element type.
   */
  getContainerProcessor<T>(
    elementType: BpmnElementType
  ): BpmnElementContainerProcessor<T> {
    return this.getProcessor(elementType) as BpmnElementContainerProcessor<T>;
  }

  /**
   * Returns true if a processor is registered for the given element type.
   */
  hasProcessor(elementType: BpmnElementType): boolean {
    return this.processors.has(elementType);
  }

  /**
   * Returns the set of element types that have registered processors.
   */
  registeredTypes(): ReadonlySet<BpmnElementType> {
    return new Set(this.processors.keys());
  }
}
