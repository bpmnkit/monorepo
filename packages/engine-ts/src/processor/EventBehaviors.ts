/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import type { BpmnEventElement } from "../event/BpmnEventElement.js";
import type { BpmnElementContext } from "./BpmnElementContext.js";
import type { Either } from "../types/Either.js";
import type { Failure } from "./Failure.js";

/**
 * Behavior callbacks injected into event processors for performing
 * state transitions and engine-level side effects.
 *
 * Mirrors the behavior interfaces injected into Zeebe's event processors
 * (`BpmnStateTransitionBehavior`, `BpmnEventSubscriptionBehavior`,
 * `BpmnVariableMappingBehavior`, etc.), consolidated into a single interface
 * for the browser engine.
 *
 * In Zeebe, these behaviors are separate classes instantiated by `BpmnBehaviors`.
 * In the browser engine, they are a single interface to keep the API simple
 * while still allowing the processors to be tested with mock behaviors.
 */
export interface EventBehaviors {
  /**
   * Signals that the element should transition to completing immediately
   * after activation. Used by pass-through events (start, none end, none throw).
   *
   * Mirrors `BpmnStateTransitionBehavior.completeElement()`.
   */
  completeElement(context: BpmnElementContext): void;

  /**
   * Take outgoing sequence flows from the completed element.
   * For elements with no outgoing flows (e.g. end events), this signals
   * the flow scope that the execution path is complete.
   *
   * Mirrors `BpmnStateTransitionBehavior.takeOutgoingSequenceFlows()`.
   */
  takeOutgoingSequenceFlows(
    element: BpmnEventElement,
    context: BpmnElementContext
  ): void;

  /**
   * Activate a target element in the same flow scope.
   * Used by link throw events to navigate to the corresponding link catch event.
   *
   * Mirrors `BpmnStateTransitionBehavior.activateElementInstanceInFlowScope()`.
   */
  activateElement(
    targetElementId: string,
    context: BpmnElementContext
  ): void;

  /**
   * Subscribe to event triggers (message, timer, signal) for the given element.
   * The subscription remains active until the event fires or the element is terminated.
   *
   * Mirrors `BpmnEventSubscriptionBehavior.subscribeToEvents()`.
   *
   * @returns Either<Failure, void> — failure if subscription setup fails
   */
  subscribeToEvents(
    element: BpmnEventElement,
    context: BpmnElementContext
  ): Either<Failure, void>;

  /**
   * Unsubscribe from all event triggers for this element instance.
   *
   * Mirrors `BpmnEventSubscriptionBehavior.unsubscribeFromEvents()`.
   */
  unsubscribeFromEvents(context: BpmnElementContext): void;

  /**
   * Throw an error event to be caught by an error boundary event or event sub-process.
   * If no matching catch event exists, an incident is created.
   *
   * Mirrors `BpmnEventPublicationBehavior.throwErrorEvent()`.
   *
   * @returns Either<Failure, void> — failure if no matching catch event found
   */
  throwErrorEvent(
    errorCode: string,
    context: BpmnElementContext
  ): Either<Failure, void>;

  /**
   * Terminate all active child element instances within the given flow scope.
   * Used by terminate end events.
   *
   * Mirrors `BpmnStateTransitionBehavior.terminateChildInstances()`.
   */
  terminateChildInstances(flowScopeContext: BpmnElementContext): void;
}
