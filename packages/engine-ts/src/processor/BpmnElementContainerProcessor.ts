/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import type { Either } from "../types/Either.js";
import { right } from "../types/Either.js";
import type { BpmnElementContext } from "./BpmnElementContext.js";
import type { BpmnElementProcessor } from "./BpmnElementProcessor.js";
import type { Failure } from "./Failure.js";
import { TransitionOutcome } from "./TransitionOutcome.js";

/**
 * The business logic of a BPMN element container (e.g. process, sub-process, multi-instance body).
 *
 * Mirrors `io.camunda.zeebe.engine.processing.bpmn.BpmnElementContainerProcessor<T>`.
 *
 * Extends `BpmnElementProcessor` with child lifecycle hooks that are invoked when child
 * elements transition through their lifecycle within this container.
 *
 * @typeParam T - The type that represents the BPMN element model
 */
export interface BpmnElementContainerProcessor<T>
  extends BpmnElementProcessor<T> {
  /**
   * A child element is on activating (but not yet activated). Perform additional logic
   * for the new child element, like setting variables.
   *
   * @param element - the BPMN element container instance
   * @param flowScopeContext - process instance data of the element container
   * @param childContext - process instance data of the child element that is activating
   * @returns Either<Failure, void> indicating success or failure
   */
  onChildActivating(
    element: T,
    flowScopeContext: BpmnElementContext,
    childContext: BpmnElementContext
  ): Either<Failure, void>;

  /**
   * A child element is completing (but not yet completed). Perform additional logic
   * for the child element, like collecting variables.
   *
   * @param element - the BPMN element container instance
   * @param flowScopeContext - process instance data of the element container
   * @param childContext - process instance data of the child element that is completing
   * @returns Either<Failure, void> indicating success or failure
   */
  onChildCompleting(
    element: T,
    flowScopeContext: BpmnElementContext,
    childContext: BpmnElementContext
  ): Either<Failure, void>;

  /**
   * The execution path of a child element is about to be completed.
   *
   * @param element - the BPMN element container instance
   * @param flowScopeContext - process instance data of the element container
   * @param childContext - process instance data of the child element
   * @returns Either<Failure, void> indicating success or failure
   */
  beforeExecutionPathCompleted(
    element: T,
    flowScopeContext: BpmnElementContext,
    childContext: BpmnElementContext
  ): Either<Failure, void>;

  /**
   * The execution path of a child element has completed.
   *
   * @param element - the BPMN element container instance
   * @param flowScopeContext - process instance data of the element container
   * @param childContext - process instance data of the completed child element
   *   (at this point the child may already be removed from state)
   * @param satisfiesCompletionCondition - evaluation result of the completion condition
   */
  afterExecutionPathCompleted(
    element: T,
    flowScopeContext: BpmnElementContext,
    childContext: BpmnElementContext,
    satisfiesCompletionCondition: boolean | undefined
  ): void;

  /**
   * A child element is terminated. Terminate the element container if it has no more
   * active child elements, or continue with the interrupting event sub-process that
   * was triggered and caused the termination.
   *
   * @param element - the BPMN element container instance
   * @param flowScopeContext - process instance data of the element container
   * @param childContext - process instance data of the terminated child element
   */
  onChildTerminated(
    element: T,
    flowScopeContext: BpmnElementContext,
    childContext: BpmnElementContext
  ): void;
}

/**
 * Abstract base class providing default (no-op) implementations for all container hooks.
 * Concrete container processors override only the hooks they need.
 */
export abstract class AbstractBpmnElementContainerProcessor<T>
  implements BpmnElementContainerProcessor<T>
{
  // --- BpmnElementProcessor defaults ---

  onActivate(_element: T, _context: BpmnElementContext): Either<Failure, void> {
    return right(undefined);
  }

  finalizeActivation(
    _element: T,
    _context: BpmnElementContext
  ): Either<Failure, void> {
    return right(undefined);
  }

  onComplete(
    _element: T,
    _context: BpmnElementContext
  ): Either<Failure, void> {
    return right(undefined);
  }

  finalizeCompletion(
    _element: T,
    _context: BpmnElementContext
  ): Either<Failure, void> {
    return right(undefined);
  }

  onTerminate(_element: T, _context: BpmnElementContext): TransitionOutcome {
    return TransitionOutcome.CONTINUE;
  }

  finalizeTermination(_element: T, _context: BpmnElementContext): void {
    // no-op by default
  }

  // --- Container-specific defaults ---

  onChildActivating(
    _element: T,
    _flowScopeContext: BpmnElementContext,
    _childContext: BpmnElementContext
  ): Either<Failure, void> {
    return right(undefined);
  }

  onChildCompleting(
    _element: T,
    _flowScopeContext: BpmnElementContext,
    _childContext: BpmnElementContext
  ): Either<Failure, void> {
    return right(undefined);
  }

  beforeExecutionPathCompleted(
    _element: T,
    _flowScopeContext: BpmnElementContext,
    _childContext: BpmnElementContext
  ): Either<Failure, void> {
    return right(undefined);
  }

  abstract afterExecutionPathCompleted(
    element: T,
    flowScopeContext: BpmnElementContext,
    childContext: BpmnElementContext,
    satisfiesCompletionCondition: boolean | undefined
  ): void;

  abstract onChildTerminated(
    element: T,
    flowScopeContext: BpmnElementContext,
    childContext: BpmnElementContext
  ): void;
}
