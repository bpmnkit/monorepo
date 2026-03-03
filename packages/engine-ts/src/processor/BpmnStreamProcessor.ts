/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import { ProcessInstanceIntent } from "../intent/ProcessInstanceIntent.js";
import type { Either } from "../types/Either.js";
import { isLeft, left, right } from "../types/Either.js";
import { BpmnElementType, isContainerType } from "../types/BpmnElementType.js";
import type { BpmnElementContext } from "./BpmnElementContext.js";
import type { BpmnElementProcessors } from "./BpmnElementProcessors.js";
import type { BpmnElementProcessor } from "./BpmnElementProcessor.js";
import { Failure, ErrorType } from "./Failure.js";
import { TransitionOutcome } from "./TransitionOutcome.js";

/**
 * Optional container context for invoking parent container hooks
 * when processing child element lifecycle events.
 */
export interface ContainerContext<T> {
  /** The BPMN element model of the container (e.g. the process or sub-process). */
  readonly containerElement: T;
  /** Process instance data of the container element instance. */
  readonly flowScopeContext: BpmnElementContext;
  /** The element type of the container. */
  readonly containerType: BpmnElementType;
}

/**
 * Dispatches BPMN element lifecycle commands to the appropriate processor hooks,
 * orchestrating the dual-phase activation/completion pattern.
 *
 * Mirrors `io.camunda.zeebe.engine.processing.bpmn.BpmnStreamProcessor`.
 *
 * ## Dual-Phase Lifecycle
 *
 * **Activation** (triggered by `ACTIVATE_ELEMENT`):
 * 1. Container hook: `containerProcessor.onChildActivating()` (if container context provided)
 * 2. Phase 1: `processor.onActivate()` — initialize element, apply input mappings
 * 3. Phase 2: `processor.finalizeActivation()` — complete activation, open subscriptions
 *
 * In Zeebe, execution listeners run between Phase 1 and Phase 2.
 * The browser engine skips execution listeners (single-threaded, no job workers).
 *
 * **Completion** (triggered by `COMPLETE_ELEMENT`):
 * 1. Phase 1: `processor.onComplete()` — apply output mappings
 * 2. Phase 2: `processor.finalizeCompletion()` — take outgoing flows, clean up
 *
 * **Termination** (triggered by `TERMINATE_ELEMENT`):
 * 1. `processor.onTerminate()` — close subscriptions, resolve incidents
 * 2. If `CONTINUE`: `processor.finalizeTermination()` — transition to terminated
 *    If `AWAIT`: wait for external trigger
 *
 * @see BpmnElementProcessor for the lifecycle hook contract
 * @see BpmnElementContainerProcessor for container-specific hooks
 */
export class BpmnStreamProcessor {
  private readonly processors: BpmnElementProcessors;

  constructor(processors: BpmnElementProcessors) {
    this.processors = processors;
  }

  /**
   * Routes a process instance command to the appropriate dual-phase processing method.
   *
   * @param intent - The command intent (ACTIVATE_ELEMENT, COMPLETE_ELEMENT, or TERMINATE_ELEMENT)
   * @param element - The BPMN element model
   * @param context - Process instance data of the element being processed
   * @param elementType - The type of the BPMN element
   * @param containerCtx - Optional container context for invoking parent hooks
   * @returns Right(TransitionOutcome) on success, Left(Failure) on error
   */
  processCommand<T>(
    intent: ProcessInstanceIntent,
    element: T,
    context: BpmnElementContext,
    elementType: BpmnElementType,
    containerCtx?: ContainerContext<T>
  ): Either<Failure, TransitionOutcome> {
    switch (intent) {
      case ProcessInstanceIntent.ACTIVATE_ELEMENT: {
        const result = this.processActivateElement(
          element,
          context,
          elementType,
          containerCtx
        );
        if (isLeft(result)) {
          return result;
        }
        return right(TransitionOutcome.CONTINUE);
      }

      case ProcessInstanceIntent.COMPLETE_ELEMENT: {
        const result = this.processCompleteElement(
          element,
          context,
          elementType,
          containerCtx
        );
        if (isLeft(result)) {
          return result;
        }
        return right(TransitionOutcome.CONTINUE);
      }

      case ProcessInstanceIntent.TERMINATE_ELEMENT: {
        const outcome = this.processTerminateElement(
          element,
          context,
          elementType
        );
        return right(outcome);
      }

      default:
        return left(
          new Failure(
            `Unsupported command intent for BPMN element processing: ${intent}`,
            ErrorType.UNKNOWN
          )
        );
    }
  }

  /**
   * Processes an ACTIVATE_ELEMENT command through dual-phase activation.
   *
   * 1. Container hook: `onChildActivating()` (if container context provided)
   * 2. Phase 1: `processor.onActivate()`
   * 3. Phase 2: `processor.finalizeActivation()`
   *
   * If any phase returns a failure, processing stops and the failure is returned.
   */
  processActivateElement<T>(
    element: T,
    context: BpmnElementContext,
    elementType: BpmnElementType,
    containerCtx?: ContainerContext<T>
  ): Either<Failure, void> {
    const processor = this.processors.getProcessor<T>(elementType);

    // Invoke container hook if a parent container context is provided
    if (containerCtx) {
      const containerResult = this.invokeContainerOnChildActivating(
        containerCtx,
        context
      );
      if (isLeft(containerResult)) {
        return containerResult;
      }
    }

    // Phase 1: onActivate
    const activateResult = processor.onActivate(element, context);
    if (isLeft(activateResult)) {
      return activateResult;
    }

    // Phase 2: finalizeActivation
    return processor.finalizeActivation(element, context);
  }

  /**
   * Processes a COMPLETE_ELEMENT command through dual-phase completion.
   *
   * 1. Container hook: `onChildCompleting()` (if container context provided)
   * 2. Phase 1: `processor.onComplete()`
   * 3. Phase 2: `processor.finalizeCompletion()`
   *
   * If any phase returns a failure, processing stops and the failure is returned.
   */
  processCompleteElement<T>(
    element: T,
    context: BpmnElementContext,
    elementType: BpmnElementType,
    containerCtx?: ContainerContext<T>
  ): Either<Failure, void> {
    const processor = this.processors.getProcessor<T>(elementType);

    // Invoke container hook if a parent container context is provided
    if (containerCtx) {
      const containerResult = this.invokeContainerOnChildCompleting(
        containerCtx,
        context
      );
      if (isLeft(containerResult)) {
        return containerResult;
      }
    }

    // Phase 1: onComplete
    const completeResult = processor.onComplete(element, context);
    if (isLeft(completeResult)) {
      return completeResult;
    }

    // Phase 2: finalizeCompletion
    return processor.finalizeCompletion(element, context);
  }

  /**
   * Processes a TERMINATE_ELEMENT command.
   *
   * 1. `processor.onTerminate()` → returns TransitionOutcome
   * 2. If CONTINUE: `processor.finalizeTermination()`
   * 3. If AWAIT: processing pauses, waiting for an external trigger
   *
   * @returns The TransitionOutcome indicating whether termination completed or is awaiting
   */
  processTerminateElement<T>(
    element: T,
    context: BpmnElementContext,
    elementType: BpmnElementType
  ): TransitionOutcome {
    const processor = this.processors.getProcessor<T>(elementType);

    const outcome = processor.onTerminate(element, context);
    if (outcome === TransitionOutcome.CONTINUE) {
      processor.finalizeTermination(element, context);
    }

    return outcome;
  }

  /**
   * Invokes the container processor's onChildActivating hook.
   */
  private invokeContainerOnChildActivating<T>(
    containerCtx: ContainerContext<T>,
    childContext: BpmnElementContext
  ): Either<Failure, void> {
    if (!isContainerType(containerCtx.containerType)) {
      return left(
        new Failure(
          `Element type ${containerCtx.containerType} is not a container type`,
          ErrorType.UNKNOWN
        )
      );
    }

    const containerProcessor = this.processors.getContainerProcessor<T>(
      containerCtx.containerType
    );
    return containerProcessor.onChildActivating(
      containerCtx.containerElement,
      containerCtx.flowScopeContext,
      childContext
    );
  }

  /**
   * Invokes the container processor's onChildCompleting hook.
   */
  private invokeContainerOnChildCompleting<T>(
    containerCtx: ContainerContext<T>,
    childContext: BpmnElementContext
  ): Either<Failure, void> {
    if (!isContainerType(containerCtx.containerType)) {
      return left(
        new Failure(
          `Element type ${containerCtx.containerType} is not a container type`,
          ErrorType.UNKNOWN
        )
      );
    }

    const containerProcessor = this.processors.getContainerProcessor<T>(
      containerCtx.containerType
    );
    return containerProcessor.onChildCompleting(
      containerCtx.containerElement,
      containerCtx.flowScopeContext,
      childContext
    );
  }
}
