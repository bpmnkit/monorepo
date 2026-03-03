/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import type { BpmnSubProcessElement } from "../container/BpmnSubProcessElement.js";
import type { Either } from "../types/Either.js";
import { isLeft, left, right } from "../types/Either.js";
import type { BpmnElementContext } from "./BpmnElementContext.js";
import type { BpmnElementContainerProcessor } from "./BpmnElementContainerProcessor.js";
import { Failure, ErrorType } from "./Failure.js";
import type { SubProcessBehaviors } from "./SubProcessBehaviors.js";
import { TransitionOutcome } from "./TransitionOutcome.js";

/**
 * Processes BPMN sub-process elements.
 *
 * Mirrors `io.camunda.zeebe.engine.processing.bpmn.container.SubProcessProcessor`.
 *
 * Sub-processes are containers that encapsulate a set of activities within
 * their own scope. They have their own variable scope and can apply
 * input/output mappings.
 *
 * ## Lifecycle
 *
 * 1. `onActivate` — Apply input variable mappings
 * 2. `finalizeActivation` — Activate the none start event child
 * 3. `onComplete` — Apply output variable mappings, unsubscribe from events
 * 4. `finalizeCompletion` — Take outgoing sequence flows
 * 5. `onTerminate` — Unsubscribe from events, terminate child instances → CONTINUE
 * 6. `finalizeTermination` — No-op
 *
 * ## Container hooks
 *
 * - `afterExecutionPathCompleted` — Complete the sub-process when all children are done
 * - `onChildTerminated` — Handle sub-process termination when all children are terminated
 */
export class SubProcessProcessor
  implements BpmnElementContainerProcessor<BpmnSubProcessElement>
{
  private readonly behaviors: SubProcessBehaviors;

  constructor(behaviors: SubProcessBehaviors) {
    this.behaviors = behaviors;
  }

  onActivate(
    element: BpmnSubProcessElement,
    context: BpmnElementContext
  ): Either<Failure, void> {
    return this.behaviors.applyInputMappings(element, context);
  }

  finalizeActivation(
    element: BpmnSubProcessElement,
    context: BpmnElementContext
  ): Either<Failure, void> {
    const startEventId = element.startEventId;
    if (!startEventId) {
      return left(
        new Failure(
          "Expected to activate none start event, but no none start event found in sub process",
          ErrorType.UNKNOWN
        )
      );
    }
    this.behaviors.activateChildInstance(context, startEventId);
    return right(undefined);
  }

  onComplete(
    element: BpmnSubProcessElement,
    context: BpmnElementContext
  ): Either<Failure, void> {
    const result = this.behaviors.applyOutputMappings(element, context);
    if (isLeft(result)) {
      return result;
    }
    this.behaviors.unsubscribeFromEvents(context);
    return right(undefined);
  }

  finalizeCompletion(
    element: BpmnSubProcessElement,
    context: BpmnElementContext
  ): Either<Failure, void> {
    this.behaviors.takeOutgoingSequenceFlows(element, context);
    return right(undefined);
  }

  onTerminate(
    _element: BpmnSubProcessElement,
    context: BpmnElementContext
  ): TransitionOutcome {
    this.behaviors.unsubscribeFromEvents(context);

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
    subProcessContext: BpmnElementContext,
    childContext: BpmnElementContext
  ): void {
    if (this.behaviors.canBeTerminated(childContext)) {
      if (this.behaviors.isTerminating(subProcessContext)) {
        // The sub-process was terminated by its flow scope.
        // All children are now terminated — the state transition behavior
        // will handle transitioning this element to the TERMINATED state.
      }
    }
  }
}
