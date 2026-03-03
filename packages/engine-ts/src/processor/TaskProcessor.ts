/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import type { BpmnTaskElement } from "../task/BpmnTaskElement.js";
import type { Either } from "../types/Either.js";
import { right } from "../types/Either.js";
import type { BpmnElementContext } from "./BpmnElementContext.js";
import type { TaskBehaviors } from "./TaskBehaviors.js";
import type { Failure } from "./Failure.js";
import { TransitionOutcome } from "./TransitionOutcome.js";
import type { BpmnElementProcessor } from "./BpmnElementProcessor.js";

/**
 * Processes BPMN undefined tasks (generic `<task>` elements).
 *
 * Mirrors `io.camunda.zeebe.engine.processing.bpmn.task.TaskProcessor`.
 *
 * Undefined tasks are passthrough elements: they activate, immediately complete,
 * and take outgoing sequence flows. They have no job or message behavior —
 * they simply pass the token through.
 *
 * ## Lifecycle
 *
 * 1. `onActivate` — No-op
 * 2. `finalizeActivation` — Immediately triggers completion
 * 3. `onComplete` — No-op
 * 4. `finalizeCompletion` — Takes outgoing sequence flows
 * 5. `onTerminate` — Returns CONTINUE (no resources to clean up)
 * 6. `finalizeTermination` — No-op
 */
export class TaskProcessor implements BpmnElementProcessor<BpmnTaskElement> {
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
    _element: BpmnTaskElement,
    context: BpmnElementContext
  ): Either<Failure, void> {
    this.behaviors.completeElement(context);
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
    _context: BpmnElementContext
  ): TransitionOutcome {
    return TransitionOutcome.CONTINUE;
  }

  finalizeTermination(
    _element: BpmnTaskElement,
    _context: BpmnElementContext
  ): void {
    // no-op
  }
}
