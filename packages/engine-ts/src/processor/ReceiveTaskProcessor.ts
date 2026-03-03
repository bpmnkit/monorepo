/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import type { BpmnTaskElement } from "../task/BpmnTaskElement.js";
import type { Either } from "../types/Either.js";
import { isLeft, right } from "../types/Either.js";
import type { BpmnElementContext } from "./BpmnElementContext.js";
import type { TaskBehaviors } from "./TaskBehaviors.js";
import type { Failure } from "./Failure.js";
import { TransitionOutcome } from "./TransitionOutcome.js";
import type { BpmnElementProcessor } from "./BpmnElementProcessor.js";

/**
 * Processes BPMN receive tasks.
 *
 * Mirrors `io.camunda.zeebe.engine.processing.bpmn.task.ReceiveTaskProcessor`.
 *
 * Receive tasks are **message-based wait states**: they subscribe to a message
 * during activation and wait for the message to be correlated. When the message
 * arrives, the engine triggers the element's completion.
 *
 * ## Lifecycle
 *
 * 1. `onActivate` — No-op (input mappings applied externally)
 * 2. `finalizeActivation` — Subscribes to message via `TaskBehaviors.subscribeToMessage()`
 * 3. `onComplete` — Unsubscribes from message
 * 4. `finalizeCompletion` — Takes outgoing sequence flows
 * 5. `onTerminate` — Unsubscribes from message, returns CONTINUE
 * 6. `finalizeTermination` — No-op
 */
export class ReceiveTaskProcessor
  implements BpmnElementProcessor<BpmnTaskElement>
{
  private readonly behaviors: TaskBehaviors;

  constructor(behaviors: TaskBehaviors) {
    this.behaviors = behaviors;
  }

  onActivate(
    _element: BpmnTaskElement,
    _context: BpmnElementContext
  ): Either<Failure, void> {
    return right(undefined);
  }

  finalizeActivation(
    element: BpmnTaskElement,
    context: BpmnElementContext
  ): Either<Failure, void> {
    const result = this.behaviors.subscribeToMessage(element, context);
    if (isLeft(result)) {
      return result;
    }
    return right(undefined);
  }

  onComplete(
    _element: BpmnTaskElement,
    context: BpmnElementContext
  ): Either<Failure, void> {
    this.behaviors.unsubscribeFromMessage(context);
    return right(undefined);
  }

  finalizeCompletion(
    element: BpmnTaskElement,
    context: BpmnElementContext
  ): Either<Failure, void> {
    this.behaviors.takeOutgoingSequenceFlows(element, context);
    return right(undefined);
  }

  onTerminate(
    _element: BpmnTaskElement,
    context: BpmnElementContext
  ): TransitionOutcome {
    this.behaviors.unsubscribeFromMessage(context);
    return TransitionOutcome.CONTINUE;
  }

  finalizeTermination(
    _element: BpmnTaskElement,
    _context: BpmnElementContext
  ): void {
    // no-op
  }
}
