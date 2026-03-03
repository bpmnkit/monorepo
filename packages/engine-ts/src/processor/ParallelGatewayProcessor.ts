/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import type { BpmnGatewayElement } from "../gateway/BpmnGatewayElement.js";
import type { Either } from "../types/Either.js";
import { left, right } from "../types/Either.js";
import type { BpmnElementContext } from "./BpmnElementContext.js";
import type { GatewayBehaviors } from "./GatewayBehaviors.js";
import { Failure, ErrorType } from "./Failure.js";
import { TransitionOutcome } from "./TransitionOutcome.js";
import type { BpmnElementProcessor } from "./BpmnElementProcessor.js";

/**
 * Processes BPMN parallel gateways (AND gateways).
 *
 * Mirrors `io.camunda.zeebe.engine.processing.bpmn.gateway.ParallelGatewayProcessor`.
 *
 * Parallel gateways fork execution by taking ALL outgoing sequence flows
 * simultaneously. They complete immediately during activation — there is no
 * wait state.
 *
 * ## Join behavior (not handled here)
 *
 * The joining of incoming sequence flows into a parallel gateway is handled
 * by the sequence flow processor, which uses the `activeSequenceFlows` counter
 * on the flow scope's `ElementInstance`. Each incoming sequence flow decrements
 * the counter; the gateway's ACTIVATE_ELEMENT command is written only when
 * the counter reaches zero (all incoming flows have arrived).
 *
 * ## Lifecycle
 *
 * 1. `onActivate` — No-op
 * 2. `finalizeActivation` — Complete immediately and take all outgoing flows
 * 3. `onComplete` — No-op
 * 4. `finalizeCompletion` — Throws (should never be called; gateway completes in activation)
 * 5. `onTerminate` — Returns CONTINUE
 * 6. `finalizeTermination` — No-op
 */
export class ParallelGatewayProcessor
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
    // Complete immediately — parallel gateways have no wait state
    this.behaviors.completeElement(context);

    // Fork: take all outgoing sequence flows simultaneously
    this.behaviors.takeAllOutgoingFlows(element, context);

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
    // Parallel gateways complete during activation — this should never be called
    return left(
      new Failure(
        `Expected to explicitly process complete, but gateway ${element.elementId} has already been completed on processing activate`,
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
}
