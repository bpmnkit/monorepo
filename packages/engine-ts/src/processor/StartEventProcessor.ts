/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import type { BpmnEventElement } from "../event/BpmnEventElement.js";
import type { Either } from "../types/Either.js";
import { right } from "../types/Either.js";
import type { BpmnElementContext } from "./BpmnElementContext.js";
import type { EventBehaviors } from "./EventBehaviors.js";
import type { Failure } from "./Failure.js";
import { TransitionOutcome } from "./TransitionOutcome.js";
import type { BpmnElementProcessor } from "./BpmnElementProcessor.js";

/**
 * Processes BPMN start events.
 *
 * Mirrors `io.camunda.zeebe.engine.processing.bpmn.event.StartEventProcessor`.
 *
 * Start events are passthrough elements: they activate, immediately complete,
 * apply output mappings, and take outgoing sequence flows.
 *
 * ## Lifecycle
 *
 * 1. `onActivate` — No-op (no input mappings on start events)
 * 2. `finalizeActivation` — Immediately triggers completion
 * 3. `onComplete` — No-op (output mappings handled externally if needed)
 * 4. `finalizeCompletion` — Takes outgoing sequence flows
 * 5. `onTerminate` — Returns CONTINUE (no subscriptions to clean up)
 * 6. `finalizeTermination` — No-op
 */
export class StartEventProcessor
  implements BpmnElementProcessor<BpmnEventElement>
{
  private readonly behaviors: EventBehaviors;

  constructor(behaviors: EventBehaviors) {
    this.behaviors = behaviors;
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
    // Start events pass through immediately — trigger completion
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
  ): TransitionOutcome {
    return TransitionOutcome.CONTINUE;
  }

  finalizeTermination(
    _element: BpmnEventElement,
    _context: BpmnElementContext
  ): void {
    // no-op
  }
}
