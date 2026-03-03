/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import type { BpmnGatewayElement } from "../gateway/BpmnGatewayElement.js";
import type { Either } from "../types/Either.js";
import { isLeft, right } from "../types/Either.js";
import type { BpmnElementContext } from "./BpmnElementContext.js";
import type { GatewayBehaviors } from "./GatewayBehaviors.js";
import type { Failure } from "./Failure.js";
import { TransitionOutcome } from "./TransitionOutcome.js";
import type { BpmnElementProcessor } from "./BpmnElementProcessor.js";

/**
 * Processes BPMN event-based gateways.
 *
 * Mirrors `io.camunda.zeebe.engine.processing.bpmn.gateway.EventBasedGatewayProcessor`.
 *
 * Event-based gateways are **wait states**: they subscribe to events on their
 * child event elements during activation and remain activated until one of the
 * events fires. When an event triggers, the gateway completes and the triggered
 * event element is activated directly (without taking the sequence flow).
 *
 * ## Key BPMN specification rule
 *
 * According to the BPMN specification, the sequence flow from the event-based
 * gateway to the triggered event is NOT taken. Instead, the triggered event
 * is activated directly by the engine.
 *
 * ## Lifecycle
 *
 * 1. `onActivate` — No-op
 * 2. `finalizeActivation` — Subscribe to events on child event elements (wait state)
 * 3. `onComplete` — Unsubscribe from events
 * 4. `finalizeCompletion` — Activate the triggered event element
 * 5. `onTerminate` — Unsubscribe from events, return CONTINUE
 * 6. `finalizeTermination` — No-op
 */
export class EventBasedGatewayProcessor
  implements BpmnElementProcessor<BpmnGatewayElement>
{
  private readonly behaviors: GatewayBehaviors;

  constructor(behaviors: GatewayBehaviors) {
    this.behaviors = behaviors;
  }

  onActivate(
    _element: BpmnGatewayElement,
    _context: BpmnElementContext
  ): Either<Failure, void> {
    return right(undefined);
  }

  finalizeActivation(
    element: BpmnGatewayElement,
    context: BpmnElementContext
  ): Either<Failure, void> {
    // Subscribe to events on child event elements — element becomes a wait state
    const result = this.behaviors.subscribeToEvents(element, context);
    if (isLeft(result)) {
      return result;
    }
    // Element stays in ACTIVATED state, waiting for an event to fire
    return right(undefined);
  }

  onComplete(
    _element: BpmnGatewayElement,
    context: BpmnElementContext
  ): Either<Failure, void> {
    // Unsubscribe from all events before completing
    this.behaviors.unsubscribeFromEvents(context);
    return right(undefined);
  }

  finalizeCompletion(
    _element: BpmnGatewayElement,
    context: BpmnElementContext
  ): Either<Failure, void> {
    // Activate the triggered event directly (no sequence flow taken per BPMN spec)
    this.behaviors.activateTriggeredEvent(context);
    return right(undefined);
  }

  onTerminate(
    _element: BpmnGatewayElement,
    context: BpmnElementContext
  ): TransitionOutcome {
    this.behaviors.unsubscribeFromEvents(context);
    return TransitionOutcome.CONTINUE;
  }

  finalizeTermination(
    _element: BpmnGatewayElement,
    _context: BpmnElementContext
  ): void {
    // no-op
  }
}
