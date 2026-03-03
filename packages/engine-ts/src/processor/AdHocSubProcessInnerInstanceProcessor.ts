/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import type { BpmnSubProcessElement } from "../container/BpmnSubProcessElement.js";
import type { Either } from "../types/Either.js";
import { left, right } from "../types/Either.js";
import type { BpmnElementContext } from "./BpmnElementContext.js";
import type { BpmnElementContainerProcessor } from "./BpmnElementContainerProcessor.js";
import { Failure, ErrorType } from "./Failure.js";
import type { SubProcessBehaviors } from "./SubProcessBehaviors.js";
import { TransitionOutcome } from "./TransitionOutcome.js";

/**
 * Processes inner instances of BPMN ad-hoc sub-processes.
 *
 * Mirrors `io.camunda.zeebe.engine.processing.bpmn.container.AdHocSubProcessInnerInstanceProcessor`.
 *
 * An inner instance is a lightweight container created around each activated
 * element inside an ad-hoc sub-process. It provides a variable scope for
 * the element's execution.
 *
 * Inner instances are NOT activated via the standard ACTIVATE command.
 * Instead, they are created together with the element during activation
 * by writing activation events directly. Attempting to activate an inner
 * instance via `onActivate` will result in an error.
 *
 * ## Lifecycle
 *
 * 1. `onActivate` — **Throws** (not supported; inner instances are activated via events)
 * 2. `finalizeCompletion` — No-op (state transition handled by behavior layer)
 * 3. `onTerminate` — Terminate child instances → CONTINUE
 * 4. `finalizeTermination` — No-op
 *
 * ## Container hooks
 *
 * - `afterExecutionPathCompleted` — Complete the inner instance when all children are done
 * - `onChildTerminated` — Handle inner instance termination when all children are terminated
 */
export class AdHocSubProcessInnerInstanceProcessor
  implements BpmnElementContainerProcessor<BpmnSubProcessElement>
{
  private readonly behaviors: SubProcessBehaviors;

  constructor(behaviors: SubProcessBehaviors) {
    this.behaviors = behaviors;
  }

  onActivate(
    _element: BpmnSubProcessElement,
    _context: BpmnElementContext
  ): Either<Failure, void> {
    return left(
      new Failure(
        "An ACTIVATE command is not supported for an inner instance of an ad-hoc sub-process. " +
          "Instead, the inner instance should be activated by writing events.",
        ErrorType.UNKNOWN
      )
    );
  }

  finalizeActivation(
    _element: BpmnSubProcessElement,
    _context: BpmnElementContext
  ): Either<Failure, void> {
    return right(undefined);
  }

  onComplete(
    _element: BpmnSubProcessElement,
    _context: BpmnElementContext
  ): Either<Failure, void> {
    return right(undefined);
  }

  finalizeCompletion(
    _element: BpmnSubProcessElement,
    _context: BpmnElementContext
  ): Either<Failure, void> {
    return right(undefined);
  }

  onTerminate(
    _element: BpmnSubProcessElement,
    context: BpmnElementContext
  ): TransitionOutcome {
    const noActiveChildInstances =
      this.behaviors.terminateChildInstances(context);
    if (noActiveChildInstances) {
      // No children to wait for — termination can proceed immediately
    }
    return TransitionOutcome.CONTINUE;
  }

  finalizeTermination(
    _element: BpmnSubProcessElement,
    _context: BpmnElementContext
  ): void {
    // no-op
  }

  // --- Container hooks ---

  onChildActivating(
    _element: BpmnSubProcessElement,
    _flowScopeContext: BpmnElementContext,
    _childContext: BpmnElementContext
  ): Either<Failure, void> {
    return right(undefined);
  }

  onChildCompleting(
    _element: BpmnSubProcessElement,
    _flowScopeContext: BpmnElementContext,
    _childContext: BpmnElementContext
  ): Either<Failure, void> {
    return right(undefined);
  }

  beforeExecutionPathCompleted(
    _element: BpmnSubProcessElement,
    _flowScopeContext: BpmnElementContext,
    _childContext: BpmnElementContext
  ): Either<Failure, void> {
    return right(undefined);
  }

  afterExecutionPathCompleted(
    _element: BpmnSubProcessElement,
    flowScopeContext: BpmnElementContext,
    childContext: BpmnElementContext,
    _satisfiesCompletionCondition: boolean | undefined
  ): void {
    if (this.behaviors.canBeCompleted(childContext)) {
      this.behaviors.completeElement(flowScopeContext);
    }
  }

  onChildTerminated(
    _element: BpmnSubProcessElement,
    flowScopeContext: BpmnElementContext,
    childContext: BpmnElementContext
  ): void {
    if (this.behaviors.canBeTerminated(childContext)) {
      // All children terminated — state transition behavior handles the rest
    }
  }
}
