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
 * Strategy interface for intermediate throw event sub-behaviors.
 *
 * Mirrors the inner `IntermediateThrowEventBehavior` in Zeebe's
 * `IntermediateThrowEventProcessor`.
 */
interface IntermediateThrowBehavior {
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
 * Processes BPMN intermediate throw events.
 *
 * Mirrors `io.camunda.zeebe.engine.processing.bpmn.event.IntermediateThrowEventProcessor`.
 *
 * Uses a strategy pattern to handle different throw event types:
 * - **None throw event**: passthrough that immediately completes
 * - **Link throw event**: navigates to the corresponding link catch event
 * - **Escalation throw event**: propagates an escalation to a catch event
 *
 * ## Lifecycle
 *
 * 1. `onActivate` — Delegates to strategy
 * 2. `finalizeActivation` — Delegates to strategy (typically auto-completes)
 * 3. `onComplete` — Delegates to strategy
 * 4. `finalizeCompletion` — Delegates to strategy (takes outgoing flows or navigates)
 * 5. `onTerminate` — Delegates to strategy, then returns CONTINUE
 * 6. `finalizeTermination` — No-op
 */
export class IntermediateThrowEventProcessor
  implements BpmnElementProcessor<BpmnEventElement>
{
  private readonly throwBehaviors: IntermediateThrowBehavior[];

  constructor(behaviors: EventBehaviors) {
    this.throwBehaviors = [
      new NoneIntermediateThrowBehavior(behaviors),
      new LinkIntermediateThrowBehavior(behaviors),
      new EscalationIntermediateThrowBehavior(behaviors),
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

  private behaviorOf(element: BpmnEventElement): IntermediateThrowBehavior {
    const behavior = this.throwBehaviors.find((b) =>
      b.isSuitableForEvent(element)
    );
    if (!behavior) {
      throw new Error(
        `Unsupported intermediate throw event definition type: ${element.eventDefinitionType}`
      );
    }
    return behavior;
  }
}

// ---------------------------------------------------------------------------
// Intermediate Throw Event Strategies
// ---------------------------------------------------------------------------

/**
 * None intermediate throw event — passthrough that immediately completes.
 *
 * Mirrors Zeebe's `NoneIntermediateThrowEventBehavior`.
 */
class NoneIntermediateThrowBehavior implements IntermediateThrowBehavior {
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
 * Link intermediate throw event — navigates to the corresponding link catch event.
 *
 * Mirrors Zeebe's `LinkIntermediateThrowEventBehavior`.
 *
 * On completion, instead of taking outgoing sequence flows, it activates
 * the target link catch event element in the same flow scope.
 */
class LinkIntermediateThrowBehavior implements IntermediateThrowBehavior {
  private readonly behaviors: EventBehaviors;

  constructor(behaviors: EventBehaviors) {
    this.behaviors = behaviors;
  }

  isSuitableForEvent(element: BpmnEventElement): boolean {
    return element.eventDefinitionType === BpmnEventDefinitionType.LINK;
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
    if (!element.linkTargetElementId) {
      return left(
        new Failure(
          "Link throw event must have a target link catch event",
          ErrorType.UNKNOWN
        )
      );
    }
    this.behaviors.activateElement(element.linkTargetElementId, context);
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
 * Escalation intermediate throw event — propagates an escalation.
 *
 * Mirrors Zeebe's `EscalationIntermediateThrowEventBehavior`.
 *
 * On activation, it throws an escalation that may be caught by a
 * non-interrupting boundary event. If caught non-interruptingly, the
 * throw event completes normally.
 */
class EscalationIntermediateThrowBehavior implements IntermediateThrowBehavior {
  private readonly behaviors: EventBehaviors;

  constructor(behaviors: EventBehaviors) {
    this.behaviors = behaviors;
  }

  isSuitableForEvent(element: BpmnEventElement): boolean {
    return element.eventDefinitionType === BpmnEventDefinitionType.ESCALATION;
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
