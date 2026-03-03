/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

/**
 * Represents an outgoing sequence flow from a gateway element.
 *
 * In Zeebe, sequence flows are `ExecutableSequenceFlow` objects with
 * optional FEEL condition expressions. In the browser engine, conditions
 * are opaque identifiers evaluated by the `GatewayBehaviors` callback.
 */
export interface SequenceFlow {
  /** The BPMN element ID of the sequence flow (e.g. "Flow_1"). */
  readonly flowId: string;

  /** The BPMN element ID of the target element (e.g. "Task_1"). */
  readonly targetElementId: string;

  /**
   * Whether this sequence flow has a condition expression.
   * If false, the flow is unconditional and will always be taken
   * (unless it is the default flow being skipped during evaluation).
   */
  readonly hasCondition: boolean;
}

/**
 * Represents a BPMN gateway element in the process model.
 *
 * This is the element model type (`T`) used by gateway processors via
 * `BpmnElementProcessor<BpmnGatewayElement>`.
 *
 * Mirrors the properties available on Zeebe's executable gateway model classes
 * (`ExecutableExclusiveGateway`, `ExecutableInclusiveGateway`,
 * `ExecutableFlowNode` for parallel, `ExecutableEventBasedGateway`),
 * adapted for the browser engine.
 */
export interface BpmnGatewayElement {
  /** BPMN element ID from the process model (e.g. "Gateway_1"). */
  readonly elementId: string;

  /**
   * All outgoing sequence flows from this gateway.
   * For exclusive/inclusive gateways, flows may have conditions.
   * For parallel gateways, all flows are unconditional.
   */
  readonly outgoingFlows: readonly SequenceFlow[];

  /**
   * The default sequence flow ID, taken when no condition evaluates to true.
   * Only applicable to exclusive and inclusive gateways.
   * Undefined if no default flow is specified.
   */
  readonly defaultFlowId?: string;
}
