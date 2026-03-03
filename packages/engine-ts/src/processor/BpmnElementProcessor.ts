/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import type { Either } from "../types/Either.js";
import { right } from "../types/Either.js";
import type { BpmnElementContext } from "./BpmnElementContext.js";
import type { Failure } from "./Failure.js";
import { TransitionOutcome } from "./TransitionOutcome.js";

/**
 * The business logic of a BPMN element.
 *
 * Mirrors `io.camunda.zeebe.engine.processing.bpmn.BpmnElementProcessor<T>`.
 *
 * The execution of an element is divided into multiple steps that represent the lifecycle
 * of the element. Each step defines a set of actions that can be performed in that step.
 * The transition to the next step must be triggered explicitly.
 *
 * ## Lifecycle phases
 *
 * 1. **onActivate** → Initialize and activate the element
 *    (apply input mappings, open event subscriptions, initialize child elements)
 *
 * 2. **finalizeActivation** → Complete activation after START execution listeners
 *
 * 3. **onComplete** → Leave the element
 *    (apply output mappings, close event subscriptions, take outgoing sequence flows)
 *
 * 4. **finalizeCompletion** → Complete finalization after END execution listeners
 *
 * 5. **onTerminate** → Terminate the element
 *    (close subscriptions, resolve incidents, activate boundary events)
 *    Returns `TransitionOutcome` to indicate whether to continue or await.
 *
 * 6. **finalizeTermination** → Finalize the terminated state
 *
 * @typeParam T - The type that represents the BPMN element model
 */
export interface BpmnElementProcessor<T> {
  /**
   * The element is about to be entered. Perform every action to initialize and activate
   * the element.
   *
   * If the element is a wait-state (waiting for an event or external trigger) then it
   * waits after this step. Otherwise, it continues directly to the next step.
   *
   * Possible actions:
   * - Apply input mappings
   * - Open event subscriptions
   * - Initialize child elements (if container)
   *
   * @returns Either<Failure, void> indicating success or failure
   */
  onActivate(element: T, context: BpmnElementContext): Either<Failure, void>;

  /**
   * Finalizes the activation of the BPMN element. Invoked after the element has been
   * initialized and activated, typically after processing START execution listeners.
   *
   * @returns Either<Failure, void> indicating success or failure
   */
  finalizeActivation(
    element: T,
    context: BpmnElementContext
  ): Either<Failure, void>;

  /**
   * The element is going to be left. Perform every action to leave the element and
   * continue with the next element.
   *
   * Possible actions:
   * - Apply output mappings
   * - Close event subscriptions
   * - Take outgoing sequence flows (if any)
   * - Continue with parent element (if no outgoing sequence flows)
   * - Clean up the state
   *
   * @returns Either<Failure, void> indicating success or failure
   */
  onComplete(element: T, context: BpmnElementContext): Either<Failure, void>;

  /**
   * Finalizes the completion of the BPMN element. Invoked after the element has finished
   * executing its main behavior, typically after processing END execution listeners.
   *
   * @returns Either<Failure, void> indicating success or failure
   */
  finalizeCompletion(
    element: T,
    context: BpmnElementContext
  ): Either<Failure, void>;

  /**
   * The element is going to be terminated. Perform every action to terminate the element
   * and continue with the element that caused the termination.
   *
   * Possible actions:
   * - Close event subscriptions
   * - Resolve incidents
   * - Activate triggered boundary event (if any)
   * - Activate triggered event sub-process (if any)
   * - Continue with parent element
   * - Clean up the state
   *
   * @returns TransitionOutcome — CONTINUE to finalize immediately, AWAIT for external trigger
   */
  onTerminate(element: T, context: BpmnElementContext): TransitionOutcome;

  /**
   * Finalizes the termination of the BPMN element. Called when the element is ready
   * to transition to a terminated state.
   */
  finalizeTermination(element: T, context: BpmnElementContext): void;
}

/**
 * Abstract base class providing default (no-op) implementations for all lifecycle hooks.
 * Concrete processors override only the hooks they need.
 */
export abstract class AbstractBpmnElementProcessor<T>
  implements BpmnElementProcessor<T>
{
  onActivate(_element: T, _context: BpmnElementContext): Either<Failure, void> {
    return right(undefined);
  }

  finalizeActivation(
    _element: T,
    _context: BpmnElementContext
  ): Either<Failure, void> {
    return right(undefined);
  }

  onComplete(
    _element: T,
    _context: BpmnElementContext
  ): Either<Failure, void> {
    return right(undefined);
  }

  finalizeCompletion(
    _element: T,
    _context: BpmnElementContext
  ): Either<Failure, void> {
    return right(undefined);
  }

  onTerminate(_element: T, _context: BpmnElementContext): TransitionOutcome {
    return TransitionOutcome.CONTINUE;
  }

  finalizeTermination(_element: T, _context: BpmnElementContext): void {
    // no-op by default
  }
}
