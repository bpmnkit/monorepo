/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import type { BpmnTaskElement } from "../task/BpmnTaskElement.js";
import type { BpmnElementContext } from "./BpmnElementContext.js";
import type { Either } from "../types/Either.js";
import type { Failure } from "./Failure.js";

/**
 * Behavior callbacks injected into task processors for performing
 * state transitions and engine-level side effects.
 *
 * Mirrors the behavior interfaces injected into Zeebe's task processors
 * (`BpmnStateTransitionBehavior`, `BpmnJobBehavior`,
 * `BpmnEventSubscriptionBehavior`, etc.), consolidated into a single interface
 * for the browser engine.
 *
 * In Zeebe, these behaviors are separate classes instantiated by `BpmnBehaviors`.
 * In the browser engine, they are a single interface to keep the API simple
 * while still allowing the processors to be tested with mock behaviors.
 */
export interface TaskBehaviors {
  /**
   * Signals that the element should transition to completing immediately
   * after activation. Used by pass-through tasks (undefined task).
   *
   * Mirrors `BpmnStateTransitionBehavior.completeElement()`.
   */
  completeElement(context: BpmnElementContext): void;

  /**
   * Take outgoing sequence flows from the completed element.
   *
   * Mirrors `BpmnStateTransitionBehavior.takeOutgoingSequenceFlows()`.
   */
  takeOutgoingSequenceFlows(
    element: BpmnTaskElement,
    context: BpmnElementContext
  ): void;

  /**
   * Create a job for the given task element. The task becomes a wait state
   * until the job is completed by a worker.
   *
   * Mirrors `BpmnJobBehavior.createNewJob()`.
   *
   * @returns Either<Failure, void> — failure if job creation fails
   */
  createJob(
    element: BpmnTaskElement,
    context: BpmnElementContext
  ): Either<Failure, void>;

  /**
   * Cancel the active job for the given element instance.
   * Called during termination to clean up pending jobs.
   *
   * Mirrors `BpmnJobBehavior.cancelJob()`.
   */
  cancelJob(context: BpmnElementContext): void;

  /**
   * Subscribe to a message for the given receive task element.
   * The task becomes a wait state until the message is correlated.
   *
   * Mirrors `BpmnEventSubscriptionBehavior.subscribeToEvents()` for message tasks.
   *
   * @returns Either<Failure, void> — failure if subscription setup fails
   */
  subscribeToMessage(
    element: BpmnTaskElement,
    context: BpmnElementContext
  ): Either<Failure, void>;

  /**
   * Unsubscribe from the message subscription for the given element instance.
   * Called during completion and termination to clean up subscriptions.
   *
   * Mirrors `BpmnEventSubscriptionBehavior.unsubscribeFromEvents()` for message tasks.
   */
  unsubscribeFromMessage(context: BpmnElementContext): void;
}
