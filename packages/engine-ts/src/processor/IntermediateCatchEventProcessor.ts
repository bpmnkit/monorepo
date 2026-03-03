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
import { isLeft, right } from "../types/Either.js";
import type { BpmnElementContext } from "./BpmnElementContext.js";
import type { EventBehaviors } from "./EventBehaviors.js";
import type { Failure } from "./Failure.js";
import { TransitionOutcome } from "./TransitionOutcome.js";
import type { BpmnElementProcessor } from "./BpmnElementProcessor.js";

/**
 * Strategy interface for intermediate catch event sub-behaviors.
 *
 * Mirrors the inner `IntermediateCatchEventBehavior` in Zeebe's
 * `IntermediateCatchEventProcessor`.
 */
interface IntermediateCatchBehavior {
  isSuitableForEvent(element: BpmnEventElement): boolean;

  onActivate(
    element: BpmnEventElement,
    context: BpmnElementContext
  ): Either<Failure, void>;

  finalizeActivation(
    element: BpmnEventElement,
    context: BpmnElementContext
  ): Either<Failure, void>;
}

/**
 * Processes BPMN intermediate catch events.
 *
 * Mirrors `io.camunda.zeebe.engine.processing.bpmn.event.IntermediateCatchEventProcessor`.
 *
 * Intermediate catch events are **wait states**: they subscribe to event triggers
 * (message, timer, signal) during activation and remain activated until an event
 * fires, at which point the engine triggers completion.
 *
 * Uses a strategy pattern to handle:
 * - **Default (message/timer/signal)**: subscribes to events, waits for trigger
 * - **Link catch**: passes through immediately (activated by link throw event)
 *
 * ## Lifecycle
 *
 * 1. `onActivate` — Apply input mappings (default behavior)
 * 2. `finalizeActivation` — Subscribe to events (wait state) or pass through (link)
 * 3. `onComplete` — Unsubscribe from events
 * 4. `finalizeCompletion` — Take outgoing sequence flows
 * 5. `onTerminate` — Unsubscribe from events, return CONTINUE
 * 6. `finalizeTermination` — No-op
 */
export class IntermediateCatchEventProcessor
  implements BpmnElementProcessor<BpmnEventElement>
{
  private readonly behaviors: EventBehaviors;
  private readonly catchBehaviors: IntermediateCatchBehavior[];

  constructor(behaviors: EventBehaviors) {
    this.behaviors = behaviors;
    this.catchBehaviors = [
      new LinkIntermediateCatchBehavior(behaviors),
      new DefaultIntermediateCatchBehavior(behaviors),
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
    _element: BpmnEventElement,
    context: BpmnElementContext
  ): Either<Failure, void> {
    this.behaviors.unsubscribeFromEvents(context);
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
    context: BpmnElementContext
  ): TransitionOutcome {
    this.behaviors.unsubscribeFromEvents(context);
    return TransitionOutcome.CONTINUE;
  }

  finalizeTermination(
    _element: BpmnEventElement,
    _context: BpmnElementContext
  ): void {
    // no-op
  }

  private behaviorOf(element: BpmnEventElement): IntermediateCatchBehavior {
    const behavior = this.catchBehaviors.find((b) =>
      b.isSuitableForEvent(element)
    );
    if (!behavior) {
      throw new Error(
        `Unsupported intermediate catch event definition type: ${element.eventDefinitionType}`
      );
    }
    return behavior;
  }
}

// ---------------------------------------------------------------------------
// Intermediate Catch Event Strategies
// ---------------------------------------------------------------------------

/**
 * Default catch event behavior for message, timer, and signal events.
 *
 * Mirrors Zeebe's `DefaultIntermediateCatchEventBehavior`.
 *
 * Subscribes to event triggers during activation, creating a wait state.
 * The element remains activated until the subscribed event fires.
 */
class DefaultIntermediateCatchBehavior implements IntermediateCatchBehavior {
  private readonly behaviors: EventBehaviors;

  constructor(behaviors: EventBehaviors) {
    this.behaviors = behaviors;
  }

  isSuitableForEvent(element: BpmnEventElement): boolean {
    return element.eventDefinitionType !== BpmnEventDefinitionType.LINK;
  }

  onActivate(
    _element: BpmnEventElement,
    _context: BpmnElementContext
  ): Either<Failure, void> {
    // Input mappings would be applied here in a full implementation
    return right(undefined);
  }

  finalizeActivation(
    element: BpmnEventElement,
    context: BpmnElementContext
  ): Either<Failure, void> {
    // Subscribe to the event trigger — element becomes a wait state
    const result = this.behaviors.subscribeToEvents(element, context);
    if (isLeft(result)) {
      return result;
    }
    // Element stays in ACTIVATED state, waiting for the event to fire
    return right(undefined);
  }
}

/**
 * Link intermediate catch event — passthrough activated by a link throw event.
 *
 * Mirrors Zeebe's `LinkIntermediateCatchEventBehavior`.
 *
 * Link catch events don't subscribe to anything; they are activated directly
 * by the corresponding link throw event. On activation, they immediately complete.
 */
class LinkIntermediateCatchBehavior implements IntermediateCatchBehavior {
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
}
