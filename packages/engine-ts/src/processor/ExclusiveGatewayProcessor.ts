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
 * Processes BPMN exclusive gateways (XOR gateways).
 *
 * Mirrors `io.camunda.zeebe.engine.processing.bpmn.gateway.ExclusiveGatewayProcessor`.
 *
 * Exclusive gateways route execution along exactly ONE outgoing sequence flow:
 * the first flow whose condition evaluates to true, or the default flow if
 * no condition is fulfilled.
 *
 * ## Lifecycle
 *
 * 1. `onActivate` — No-op
 * 2. `finalizeActivation` — Evaluate conditions, take the chosen flow, complete immediately
 * 3. `onComplete` — No-op (gateway completes during activation)
 * 4. `finalizeCompletion` — Throws (should never be called; gateway completes in activation)
 * 5. `onTerminate` — Returns CONTINUE
 * 6. `finalizeTermination` — No-op
 *
 * ## Fork behavior
 *
 * - Evaluates conditions on outgoing flows sequentially (skipping the default flow)
 * - Takes the FIRST flow whose condition is true
 * - If no condition is true, takes the default flow
 * - If no default flow and no condition is true, returns a CONDITION_ERROR failure
 * - If there are no outgoing flows, acts as an implicit end (no flow taken)
 * - If there is exactly one unconditional flow, takes it directly
 */
export class ExclusiveGatewayProcessor
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
    const flowResult = this.findSequenceFlowToTake(element, context);
    if (isLeft(flowResult)) {
      return flowResult;
    }

    // Complete the gateway immediately (no wait state)
    this.behaviors.completeElement(context);

    // Take the chosen flow (if any — none means implicit end)
    const chosenFlow = flowResult.value;
    if (chosenFlow) {
      this.behaviors.takeSequenceFlow(chosenFlow, context);
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
    // Exclusive gateways complete during activation — this should never be called
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
   * Finds the single outgoing sequence flow to take.
   *
   * @returns Right(SequenceFlow) if a flow is found, Right(undefined) for implicit end,
   *          or Left(Failure) if no condition is fulfilled and no default exists
   */
  private findSequenceFlowToTake(
    element: BpmnGatewayElement,
    context: BpmnElementContext
  ): Either<Failure, SequenceFlow | undefined> {
    const flows = element.outgoingFlows;

    if (flows.length === 0) {
      // No outgoing flows: implicit end for the flow scope
      return right(undefined);
    }

    if (flows.length === 1 && !flows[0].hasCondition) {
      // Single unconditional flow: take it directly
      return right(flows[0]);
    }

    // Evaluate conditions on all flows (skipping the default flow)
    for (const flow of flows) {
      if (!flow.hasCondition) {
        continue;
      }
      if (element.defaultFlowId && flow.flowId === element.defaultFlowId) {
        continue;
      }

      const conditionResult = this.behaviors.evaluateCondition(flow, context);
      if (isLeft(conditionResult)) {
        return conditionResult as Either<Failure, SequenceFlow | undefined>;
      }
      if (conditionResult.value) {
        return right(flow);
      }
    }

    // No condition fulfilled — try the default flow
    if (element.defaultFlowId) {
      const defaultFlow = flows.find(
        (f) => f.flowId === element.defaultFlowId
      );
      if (defaultFlow) {
        return right(defaultFlow);
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
