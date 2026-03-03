/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import type { BpmnGatewayElement, SequenceFlow } from "../gateway/BpmnGatewayElement.js";
import type { BpmnElementContext } from "./BpmnElementContext.js";
import type { Either } from "../types/Either.js";
import type { Failure } from "./Failure.js";

/**
 * Behavior callbacks injected into gateway processors for performing
 * state transitions, condition evaluation, and engine-level side effects.
 *
 * Mirrors the behavior interfaces injected into Zeebe's gateway processors
 * (`BpmnStateTransitionBehavior`, `ExpressionProcessor`,
 * `BpmnEventSubscriptionBehavior`, `BpmnIncidentBehavior`), consolidated
 * into a single interface for the browser engine.
 *
 * In Zeebe, these behaviors are separate classes instantiated by `BpmnBehaviors`.
 * In the browser engine, they are a single interface to keep the API simple
 * while still allowing the processors to be tested with mock behaviors.
 */
export interface GatewayBehaviors {
  /**
   * Signals that the element should transition to completing immediately.
   * Used by pass-through gateways (exclusive, parallel, inclusive)
   * that complete during activation.
   *
   * Mirrors `BpmnStateTransitionBehavior.completeElement()`.
   */
  completeElement(context: BpmnElementContext): void;

  /**
   * Takes a single outgoing sequence flow, activating the target element.
   *
   * Mirrors `BpmnStateTransitionBehavior.takeSequenceFlow()`.
   */
  takeSequenceFlow(flow: SequenceFlow, context: BpmnElementContext): void;

  /**
   * Takes all outgoing sequence flows from the gateway, activating all targets.
   * Used by the parallel gateway to fork execution.
   *
   * Mirrors `BpmnStateTransitionBehavior.takeOutgoingSequenceFlows()`.
   */
  takeAllOutgoingFlows(
    element: BpmnGatewayElement,
    context: BpmnElementContext
  ): void;

  /**
   * Evaluates a condition expression on a sequence flow.
   * Returns Right(true) if the condition is fulfilled, Right(false) if not,
   * or Left(Failure) if the expression evaluation fails.
   *
   * Mirrors `ExpressionProcessor.evaluateBooleanExpression()`.
   *
   * @param flow - The sequence flow whose condition to evaluate
   * @param context - The element instance context for variable resolution
   */
  evaluateCondition(
    flow: SequenceFlow,
    context: BpmnElementContext
  ): Either<Failure, boolean>;

  /**
   * Subscribe to event triggers (message, timer, signal) for the given gateway's
   * child event elements. Used by event-based gateways.
   *
   * Mirrors `BpmnEventSubscriptionBehavior.subscribeToEvents()`.
   *
   * @returns Either<Failure, void> — failure if subscription setup fails
   */
  subscribeToEvents(
    element: BpmnGatewayElement,
    context: BpmnElementContext
  ): Either<Failure, void>;

  /**
   * Unsubscribe from all event triggers for this gateway instance.
   * Called during completion and termination.
   *
   * Mirrors `BpmnEventSubscriptionBehavior.unsubscribeFromEvents()`.
   */
  unsubscribeFromEvents(context: BpmnElementContext): void;

  /**
   * Find and activate the event that triggered the event-based gateway's completion.
   * According to the BPMN specification, the sequence flow to the triggered event
   * is NOT taken; instead, the event is activated directly.
   *
   * Mirrors `BpmnEventSubscriptionBehavior.activateTriggeredEvent()`.
   */
  activateTriggeredEvent(context: BpmnElementContext): void;
}
