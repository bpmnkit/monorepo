/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import type { BpmnAdHocSubProcessElement } from "../container/BpmnSubProcessElement.js";
import type { Either } from "../types/Either.js";
import { isLeft, right } from "../types/Either.js";
import type { BpmnElementContext } from "./BpmnElementContext.js";
import type { BpmnElementContainerProcessor } from "./BpmnElementContainerProcessor.js";
import type { Failure } from "./Failure.js";
import type { SubProcessBehaviors } from "./SubProcessBehaviors.js";
import { TransitionOutcome } from "./TransitionOutcome.js";

/**
 * Processes BPMN ad-hoc sub-process elements.
 *
 * Mirrors `io.camunda.zeebe.engine.processing.bpmn.container.AdHocSubProcessProcessor`.
 *
 * Ad-hoc sub-processes differ from standard sub-processes in that they do not
 * have a predefined sequence flow. Instead, activities within them can be
 * activated on demand. The ad-hoc sub-process completes when its completion
 * condition is satisfied (or when all activities have completed if no condition
 * is set).
 *
 * The browser engine supports the BPMN implementation type only (not the
 * job-worker based orchestration available in Zeebe).
 *
 * ## Lifecycle
 *
 * 1. `onActivate` — Apply input variable mappings
 * 2. `finalizeActivation` — Activate initial elements (if configured), transition to activated
 * 3. `onComplete` — Apply output variable mappings, unsubscribe from events
 * 4. `finalizeCompletion` — Take outgoing sequence flows
 * 5. `onTerminate` — Unsubscribe from events, terminate child instances → CONTINUE
 * 6. `finalizeTermination` — No-op
 *
 * ## Container hooks
 *
 * - `afterExecutionPathCompleted` — Evaluate completion condition; complete or cancel remaining
 * - `onChildTerminated` — Complete when termination-initiated children are done
 */
export class AdHocSubProcessProcessor
  implements BpmnElementContainerProcessor<BpmnAdHocSubProcessElement>
{
  private readonly behaviors: SubProcessBehaviors;

  constructor(behaviors: SubProcessBehaviors) {
    this.behaviors = behaviors;
  }

  onActivate(
    element: BpmnAdHocSubProcessElement,
    context: BpmnElementContext
  ): Either<Failure, void> {
    return this.behaviors.applyInputMappings(element, context);
  }

  finalizeActivation(
    element: BpmnAdHocSubProcessElement,
    context: BpmnElementContext
  ): Either<Failure, void> {
    // Activate any initially configured elements
    if (element.activeElements) {
      for (const elementId of element.activeElements) {
        this.behaviors.activateChildInstance(context, elementId);
      }
    }
    return right(undefined);
  }

  onComplete(
    element: BpmnAdHocSubProcessElement,
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
    element: BpmnAdHocSubProcessElement,
    context: BpmnElementContext
  ): Either<Failure, void> {
    this.behaviors.takeOutgoingSequenceFlows(element, context);
    return right(undefined);
  }

  onTerminate(
    _element: BpmnAdHocSubProcessElement,
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
    _element: BpmnAdHocSubProcessElement,
    _context: BpmnElementContext
  ): void {
    // no-op
  }

  // --- Container hooks ---

  onChildActivating(
    _element: BpmnAdHocSubProcessElement,
    _flowScopeContext: BpmnElementContext,
    _childContext: BpmnElementContext
  ): Either<Failure, void> {
    return right(undefined);
  }

  onChildCompleting(
    _element: BpmnAdHocSubProcessElement,
    _flowScopeContext: BpmnElementContext,
    _childContext: BpmnElementContext
  ): Either<Failure, void> {
    return right(undefined);
  }

  beforeExecutionPathCompleted(
    _element: BpmnAdHocSubProcessElement,
    _flowScopeContext: BpmnElementContext,
    _childContext: BpmnElementContext
  ): Either<Failure, void> {
    return right(undefined);
  }

  afterExecutionPathCompleted(
    element: BpmnAdHocSubProcessElement,
    flowScopeContext: BpmnElementContext,
    childContext: BpmnElementContext,
    satisfiesCompletionCondition: boolean | undefined
  ): void {
    if (satisfiesCompletionCondition === undefined) {
      // No completion condition set — complete when no other activity is active
      if (this.behaviors.canBeCompleted(childContext)) {
        this.behaviors.completeElement(flowScopeContext);
      }
      return;
    }

    if (satisfiesCompletionCondition) {
      const cancelRemaining = element.cancelRemainingInstances ?? true;
      if (cancelRemaining) {
        // Terminate remaining child instances; completion will happen
        // in onChildTerminated once all children are terminated
        this.behaviors.terminateChildInstances(flowScopeContext);
      } else {
        this.behaviors.completeElement(flowScopeContext);
      }
    }
  }

  onChildTerminated(
    _element: BpmnAdHocSubProcessElement,
    adHocSubProcessContext: BpmnElementContext,
    childContext: BpmnElementContext
  ): void {
    if (this.behaviors.isTerminating(adHocSubProcessContext)) {
      // Child termination was initiated by onTerminate — terminate the
      // ad-hoc sub-process once all child instances have been terminated
      if (this.behaviors.canBeTerminated(childContext)) {
        // All children terminated — state transition behavior handles the rest
      }
    } else if (this.behaviors.canBeCompleted(childContext)) {
      // Completion condition was met previously and all remaining child
      // instances were terminated — now complete the ad-hoc sub-process
      this.behaviors.completeElement(adHocSubProcessContext);
    }
  }
}
