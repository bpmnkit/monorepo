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
 * Processes BPMN send tasks.
 *
 * Mirrors `io.camunda.zeebe.engine.processing.bpmn.task.SendTaskProcessor`.
 *
 * Send tasks are **job-based wait states**: they create a job during activation
 * and wait for a worker (typically a message-sending integration) to complete it.
 * The lifecycle is identical to service tasks.
 *
 * ## Lifecycle
 *
 * 1. `onActivate` — No-op (input mappings applied externally)
 * 2. `finalizeActivation` — Creates a job via `TaskBehaviors.createJob()`
 * 3. `onComplete` — No-op (output variables set by job handler)
 * 4. `finalizeCompletion` — Takes outgoing sequence flows
 * 5. `onTerminate` — Cancels the active job, returns CONTINUE
 * 6. `finalizeTermination` — No-op
 */
export class SendTaskProcessor
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
    const result = this.behaviors.createJob(element, context);
    if (isLeft(result)) {
      return result;
    }
    return right(undefined);
  }

  onComplete(
    _element: BpmnTaskElement,
    _context: BpmnElementContext
  ): Either<Failure, void> {
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
    this.behaviors.cancelJob(context);
    return TransitionOutcome.CONTINUE;
  }

  finalizeTermination(
    _element: BpmnTaskElement,
    _context: BpmnElementContext
  ): void {
    // no-op
  }
}
