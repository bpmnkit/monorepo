/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import type { BpmnEventElement } from "../event/BpmnEventElement.js";
import { BpmnEventDefinitionType } from "../event/BpmnEventDefinitionType.js";
import type { Either } from "../types/Either.js";
import { left, right } from "../types/Either.js";
import type { BpmnElementContext } from "./BpmnElementContext.js";
import type { EventBehaviors } from "./EventBehaviors.js";
import { Failure, ErrorType } from "./Failure.js";
import { TransitionOutcome } from "./TransitionOutcome.js";
import type { BpmnElementProcessor } from "./BpmnElementProcessor.js";

/**
 * Strategy interface for end event sub-behaviors.
 *
 * Mirrors the inner `EndEventBehavior` interface in Zeebe's `EndEventProcessor`.
 * Each end event type (none, error, terminate) has its own strategy.
 */
interface EndEventBehavior {
  isSuitableForEvent(element: BpmnEventElement): boolean;

  onActivate(
    element: BpmnEventElement,
    context: BpmnElementContext
  ): Either<Failure, void>;

  finalizeActivation(
    element: BpmnEventElement,
    context: BpmnElementContext
  ): Either<Failure, void>;

  onComplete(
    element: BpmnEventElement,
    context: BpmnElementContext
  ): Either<Failure, void>;

  finalizeCompletion(
    element: BpmnEventElement,
    context: BpmnElementContext
  ): Either<Failure, void>;

  onTerminate(element: BpmnEventElement, context: BpmnElementContext): void;
}

/**
 * Processes BPMN end events.
 *
 * Mirrors `io.camunda.zeebe.engine.processing.bpmn.event.EndEventProcessor`.
 *
 * Uses a strategy pattern to handle different end event types:
 * - **None end event**: passes through immediately (activate → complete)
 * - **Error end event**: throws a BPMN error to be caught by a boundary event
 * - **Terminate end event**: terminates all sibling instances in the flow scope
 *
 * ## Common termination behavior
 *
 * All end event types share the same `onTerminate` logic: clean up any
 * type-specific resources, then return CONTINUE.
 */
export class EndEventProcessor
  implements BpmnElementProcessor<BpmnEventElement>
{
  private readonly behaviors: EventBehaviors;
  private readonly endEventBehaviors: EndEventBehavior[];

  constructor(behaviors: EventBehaviors) {
    this.behaviors = behaviors;
    this.endEventBehaviors = [
      new NoneEndEventBehavior(behaviors),
      new ErrorEndEventBehavior(behaviors),
      new TerminateEndEventBehavior(behaviors),
    ];
  }

  onActivate(
    element: BpmnEventElement,
    context: BpmnElementContext
  ): Either<Failure, void> {
    return this.behaviorOf(element).onActivate(element, context);
  }

  finalizeActivation(
    element: BpmnEventElement,
    context: BpmnElementContext
  ): Either<Failure, void> {
    return this.behaviorOf(element).finalizeActivation(element, context);
  }

  onComplete(
    element: BpmnEventElement,
    context: BpmnElementContext
  ): Either<Failure, void> {
    return this.behaviorOf(element).onComplete(element, context);
  }

  finalizeCompletion(
    element: BpmnEventElement,
    context: BpmnElementContext
  ): Either<Failure, void> {
    return this.behaviorOf(element).finalizeCompletion(element, context);
  }

  onTerminate(
    element: BpmnEventElement,
    context: BpmnElementContext
  ): TransitionOutcome {
    this.behaviorOf(element).onTerminate(element, context);
    return TransitionOutcome.CONTINUE;
  }

  finalizeTermination(
    _element: BpmnEventElement,
    _context: BpmnElementContext
  ): void {
    // no-op
  }

  private behaviorOf(element: BpmnEventElement): EndEventBehavior {
    const behavior = this.endEventBehaviors.find((b) =>
      b.isSuitableForEvent(element)
    );
    if (!behavior) {
      throw new Error(
        `Unsupported end event definition type: ${element.eventDefinitionType}`
      );
    }
    return behavior;
  }
}

// ---------------------------------------------------------------------------
// End Event Strategies
// ---------------------------------------------------------------------------

/**
 * None end event — passthrough that immediately completes.
 *
 * Mirrors Zeebe's `NoneEndEventBehavior`.
 */
class NoneEndEventBehavior implements EndEventBehavior {
  private readonly behaviors: EventBehaviors;

  constructor(behaviors: EventBehaviors) {
    this.behaviors = behaviors;
  }

  isSuitableForEvent(element: BpmnEventElement): boolean {
    return element.eventDefinitionType === BpmnEventDefinitionType.NONE;
  }

  onActivate(
    _element: BpmnEventElement,
    _context: BpmnElementContext
  ): Either<Failure, void> {
    return right(undefined);
  }

  finalizeActivation(
    _element: BpmnEventElement,
    context: BpmnElementContext
  ): Either<Failure, void> {
    this.behaviors.completeElement(context);
    return right(undefined);
  }

  onComplete(
    _element: BpmnEventElement,
    _context: BpmnElementContext
  ): Either<Failure, void> {
    return right(undefined);
  }

  finalizeCompletion(
    element: BpmnEventElement,
    context: BpmnElementContext
  ): Either<Failure, void> {
    this.behaviors.takeOutgoingSequenceFlows(element, context);
    return right(undefined);
  }

  onTerminate(
    _element: BpmnEventElement,
    _context: BpmnElementContext
  ): void {
    // no-op
  }
}

/**
 * Error end event — throws a BPMN error to be caught by an error boundary event.
 *
 * Mirrors Zeebe's `ErrorEndEventBehavior`.
 */
class ErrorEndEventBehavior implements EndEventBehavior {
  private readonly behaviors: EventBehaviors;

  constructor(behaviors: EventBehaviors) {
    this.behaviors = behaviors;
  }

  isSuitableForEvent(element: BpmnEventElement): boolean {
    return element.eventDefinitionType === BpmnEventDefinitionType.ERROR;
  }

  onActivate(
    _element: BpmnEventElement,
    _context: BpmnElementContext
  ): Either<Failure, void> {
    return right(undefined);
  }

  finalizeActivation(
    element: BpmnEventElement,
    context: BpmnElementContext
  ): Either<Failure, void> {
    const errorCode = element.errorCode;
    if (!errorCode) {
      return left(
        new Failure(
          "Error end event must have an error code",
          ErrorType.UNHANDLED_ERROR_EVENT
        )
      );
    }
    return this.behaviors.throwErrorEvent(errorCode, context);
  }

  onComplete(
    _element: BpmnEventElement,
    _context: BpmnElementContext
  ): Either<Failure, void> {
    return right(undefined);
  }

  finalizeCompletion(
    element: BpmnEventElement,
    context: BpmnElementContext
  ): Either<Failure, void> {
    this.behaviors.takeOutgoingSequenceFlows(element, context);
    return right(undefined);
  }

  onTerminate(
    _element: BpmnEventElement,
    _context: BpmnElementContext
  ): void {
    // no-op
  }
}

/**
 * Terminate end event — terminates all sibling instances in the flow scope.
 *
 * Mirrors Zeebe's `TerminateEndEventBehavior`.
 *
 * Unlike other end events, the terminate end event does NOT take outgoing
 * sequence flows. Instead, it terminates all active child instances of the
 * flow scope, causing the flow scope to complete via termination.
 */
class TerminateEndEventBehavior implements EndEventBehavior {
  private readonly behaviors: EventBehaviors;

  constructor(behaviors: EventBehaviors) {
    this.behaviors = behaviors;
  }

  isSuitableForEvent(element: BpmnEventElement): boolean {
    return element.eventDefinitionType === BpmnEventDefinitionType.TERMINATE;
  }

  onActivate(
    _element: BpmnEventElement,
    _context: BpmnElementContext
  ): Either<Failure, void> {
    return right(undefined);
  }

  finalizeActivation(
    _element: BpmnEventElement,
    context: BpmnElementContext
  ): Either<Failure, void> {
    this.behaviors.completeElement(context);
    return right(undefined);
  }

  onComplete(
    _element: BpmnEventElement,
    _context: BpmnElementContext
  ): Either<Failure, void> {
    return right(undefined);
  }

  finalizeCompletion(
    _element: BpmnEventElement,
    context: BpmnElementContext
  ): Either<Failure, void> {
    // Terminate all sibling instances in the same flow scope
    this.behaviors.terminateChildInstances(context);
    return right(undefined);
  }

  onTerminate(
    _element: BpmnEventElement,
    _context: BpmnElementContext
  ): void {
    // no-op
  }
}
