/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import type { BpmnSubProcessElement } from "../container/BpmnSubProcessElement.js";
import type { BpmnElementContext } from "./BpmnElementContext.js";
import type { Either } from "../types/Either.js";
import type { Failure } from "./Failure.js";

/**
 * Behavior callbacks injected into sub-process processors for performing
 * state transitions and engine-level side effects.
 *
 * Mirrors the behavior interfaces injected into Zeebe's container processors
 * (`BpmnStateBehavior`, `BpmnStateTransitionBehavior`,
 * `BpmnVariableMappingBehavior`, `BpmnEventSubscriptionBehavior`),
 * consolidated into a single interface for the browser engine.
 *
 * In Zeebe, these behaviors are separate classes instantiated by `BpmnBehaviors`.
 * In the browser engine, they are a single interface to keep the API simple
 * while still allowing the processors to be tested with mock behaviors.
 */
export interface SubProcessBehaviors {
  /**
   * Signals that the element should transition to completing.
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
    element: BpmnSubProcessElement,
    context: BpmnElementContext
  ): void;

  /**
   * Terminate all active child element instances within this container.
   *
   * @returns `true` if no active child instances remain (all terminated or none existed),
   *          `false` if child instances are still active and will terminate asynchronously.
   *
   * Mirrors `BpmnStateTransitionBehavior.terminateChildInstances()`.
   */
  terminateChildInstances(context: BpmnElementContext): boolean;

  /**
   * Activate a child element instance within this container.
   * Used by sub-processes to activate their none start event.
   *
   * Mirrors `BpmnStateTransitionBehavior.activateChildInstance()`.
   */
  activateChildInstance(
    context: BpmnElementContext,
    childElementId: string
  ): void;

  /**
   * Apply input variable mappings from the flow scope to this sub-process scope.
   *
   * Mirrors `BpmnVariableMappingBehavior.applyInputMappings()`.
   */
  applyInputMappings(
    element: BpmnSubProcessElement,
    context: BpmnElementContext
  ): Either<Failure, void>;

  /**
   * Apply output variable mappings from this sub-process scope to the flow scope.
   *
   * Mirrors `BpmnVariableMappingBehavior.applyOutputMappings()`.
   */
  applyOutputMappings(
    element: BpmnSubProcessElement,
    context: BpmnElementContext
  ): Either<Failure, void>;

  /**
   * Unsubscribe from all event triggers for this element instance.
   *
   * Mirrors `BpmnEventSubscriptionBehavior.unsubscribeFromEvents()`.
   */
  unsubscribeFromEvents(context: BpmnElementContext): void;

  /**
   * Returns true if the element's flow scope can be completed, i.e., there are
   * no more active child element instances that prevent completion.
   *
   * Mirrors `BpmnStateBehavior.canBeCompleted()`.
   */
  canBeCompleted(context: BpmnElementContext): boolean;

  /**
   * Returns true if the element's flow scope can be terminated, i.e., there are
   * no more active child element instances that prevent termination.
   *
   * Mirrors `BpmnStateBehavior.canBeTerminated()`.
   */
  canBeTerminated(context: BpmnElementContext): boolean;

  /**
   * Returns true if the element instance is currently in the TERMINATING state.
   *
   * Mirrors checking `ElementInstance.isTerminating()`.
   */
  isTerminating(context: BpmnElementContext): boolean;
}
