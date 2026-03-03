/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import type { BpmnGatewayElement, SequenceFlow } from "../gateway/BpmnGatewayElement.js";
import type { Either } from "../types/Either.js";
import { isLeft, left, right } from "../types/Either.js";
import type { BpmnElementContext } from "./BpmnElementContext.js";
import type { GatewayBehaviors } from "./GatewayBehaviors.js";
import { Failure, ErrorType } from "./Failure.js";
import { TransitionOutcome } from "./TransitionOutcome.js";
import type { BpmnElementProcessor } from "./BpmnElementProcessor.js";

const NO_OUTGOING_FLOW_CHOSEN_ERROR =
  "Expected at least one condition to evaluate to true, or to have a default flow";

/**
 * Processes BPMN inclusive gateways (OR gateways).
 *
 * Mirrors `io.camunda.zeebe.engine.processing.bpmn.gateway.InclusiveGatewayProcessor`.
 *
 * Inclusive gateways evaluate conditions on ALL outgoing sequence flows and take
 * every flow whose condition is true. If no condition is fulfilled, the default
 * flow is taken.
 *
 * ## Difference from Exclusive Gateway
 *
 * - Exclusive: takes the FIRST matching flow (short-circuit)
 * - Inclusive: takes ALL matching flows (evaluates all conditions)
 *
 * ## Join behavior (not handled here)
 *
 * Like parallel gateways, inclusive gateway joining uses the `activeSequenceFlows`
 * counter combined with path analysis via `BpmnInclusiveGatewayBehavior` to
 * determine when all reachable incoming flows have arrived.
 *
 * ## Lifecycle
 *
 * 1. `onActivate` — No-op
 * 2. `finalizeActivation` — Evaluate all conditions, take matching flows, complete immediately
 * 3. `onComplete` — No-op
 * 4. `finalizeCompletion` — Throws (should never be called; gateway completes in activation)
 * 5. `onTerminate` — Returns CONTINUE
 * 6. `finalizeTermination` — No-op
 */
export class InclusiveGatewayProcessor
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
    const flowsResult = this.findSequenceFlowsToTake(element, context);
    if (isLeft(flowsResult)) {
      return flowsResult;
    }

    // Complete the gateway immediately (no wait state)
    this.behaviors.completeElement(context);

    // Take all matching flows (null means implicit end — no flows to take)
    const flows = flowsResult.value;
    if (flows) {
      for (const flow of flows) {
        this.behaviors.takeSequenceFlow(flow, context);
      }
    }

    return right(undefined);
  }

  onComplete(
    _element: BpmnGatewayElement,
    _context: BpmnElementContext
  ): Either<Failure, void> {
    return right(undefined);
  }

  finalizeCompletion(
    element: BpmnGatewayElement,
    _context: BpmnElementContext
  ): Either<Failure, void> {
    // Inclusive gateways complete during activation — this should never be called
    return left(
      new Failure(
        `Expected to explicitly process complete, but gateway ${element.elementId} has no wait state`,
        ErrorType.UNKNOWN
      )
    );
  }

  onTerminate(
    _element: BpmnGatewayElement,
    _context: BpmnElementContext
  ): TransitionOutcome {
    return TransitionOutcome.CONTINUE;
  }

  finalizeTermination(
    _element: BpmnGatewayElement,
    _context: BpmnElementContext
  ): void {
    // no-op
  }

  /**
   * Finds all outgoing sequence flows whose conditions are fulfilled.
   *
   * @returns Right(SequenceFlow[]) with matching flows,
   *          Right(null) for implicit end (no outgoing flows),
   *          or Left(Failure) on condition evaluation error or no matches
   */
  private findSequenceFlowsToTake(
    element: BpmnGatewayElement,
    context: BpmnElementContext
  ): Either<Failure, SequenceFlow[] | null> {
    const flows = element.outgoingFlows;

    if (flows.length === 0) {
      // No outgoing flows: implicit end for the flow scope
      return right(null);
    }

    if (flows.length === 1 && !flows[0].hasCondition) {
      // Single unconditional flow: take it directly
      return right([flows[0]]);
    }

    // Evaluate conditions on all flows (skipping the default flow)
    const matchingFlows: SequenceFlow[] = [];

    for (const flow of flows) {
      if (!flow.hasCondition) {
        continue;
      }
      if (element.defaultFlowId && flow.flowId === element.defaultFlowId) {
        continue;
      }

      const conditionResult = this.behaviors.evaluateCondition(flow, context);
      if (isLeft(conditionResult)) {
        return conditionResult as Either<Failure, SequenceFlow[] | null>;
      }
      if (conditionResult.value) {
        matchingFlows.push(flow);
      }
    }

    if (matchingFlows.length > 0) {
      return right(matchingFlows);
    }

    // No condition fulfilled — try the default flow
    if (element.defaultFlowId) {
      const defaultFlow = flows.find(
        (f) => f.flowId === element.defaultFlowId
      );
      if (defaultFlow) {
        return right([defaultFlow]);
      }
    }

    return left(
      new Failure(
        NO_OUTGOING_FLOW_CHOSEN_ERROR,
        ErrorType.CONDITION_ERROR,
        context.elementInstanceKey
      )
    );
  }
}
