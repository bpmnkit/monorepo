/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

/**
 * All BPMN element types supported by the engine.
 *
 * Mirrors `io.camunda.zeebe.protocol.record.value.BpmnElementType`.
 *
 * Each type maps to a BPMN XML element name (where applicable).
 */
export enum BpmnElementType {
  // --- Containers ---
  PROCESS = "PROCESS",
  SUB_PROCESS = "SUB_PROCESS",
  EVENT_SUB_PROCESS = "EVENT_SUB_PROCESS",
  AD_HOC_SUB_PROCESS = "AD_HOC_SUB_PROCESS",
  AD_HOC_SUB_PROCESS_INNER_INSTANCE = "AD_HOC_SUB_PROCESS_INNER_INSTANCE",

  // --- Events ---
  START_EVENT = "START_EVENT",
  INTERMEDIATE_CATCH_EVENT = "INTERMEDIATE_CATCH_EVENT",
  INTERMEDIATE_THROW_EVENT = "INTERMEDIATE_THROW_EVENT",
  BOUNDARY_EVENT = "BOUNDARY_EVENT",
  END_EVENT = "END_EVENT",

  // --- Tasks ---
  SERVICE_TASK = "SERVICE_TASK",
  RECEIVE_TASK = "RECEIVE_TASK",
  USER_TASK = "USER_TASK",
  MANUAL_TASK = "MANUAL_TASK",
  TASK = "TASK",
  BUSINESS_RULE_TASK = "BUSINESS_RULE_TASK",
  SCRIPT_TASK = "SCRIPT_TASK",
  SEND_TASK = "SEND_TASK",

  // --- Gateways ---
  EXCLUSIVE_GATEWAY = "EXCLUSIVE_GATEWAY",
  PARALLEL_GATEWAY = "PARALLEL_GATEWAY",
  EVENT_BASED_GATEWAY = "EVENT_BASED_GATEWAY",
  INCLUSIVE_GATEWAY = "INCLUSIVE_GATEWAY",

  // --- Other ---
  SEQUENCE_FLOW = "SEQUENCE_FLOW",
  MULTI_INSTANCE_BODY = "MULTI_INSTANCE_BODY",
  CALL_ACTIVITY = "CALL_ACTIVITY",

  UNSPECIFIED = "UNSPECIFIED",
}

/**
 * Maps BpmnElementType to the BPMN XML element name used in process definitions.
 * Types without a direct XML element (e.g., MULTI_INSTANCE_BODY, UNSPECIFIED) map to undefined.
 */
const ELEMENT_TYPE_NAMES: ReadonlyMap<BpmnElementType, string | undefined> =
  new Map([
    [BpmnElementType.PROCESS, "process"],
    [BpmnElementType.SUB_PROCESS, "subProcess"],
    [BpmnElementType.EVENT_SUB_PROCESS, "subProcess"],
    [BpmnElementType.AD_HOC_SUB_PROCESS, "adHocSubProcess"],
    [BpmnElementType.AD_HOC_SUB_PROCESS_INNER_INSTANCE, undefined],
    [BpmnElementType.START_EVENT, "startEvent"],
    [BpmnElementType.INTERMEDIATE_CATCH_EVENT, "intermediateCatchEvent"],
    [BpmnElementType.INTERMEDIATE_THROW_EVENT, "intermediateThrowEvent"],
    [BpmnElementType.BOUNDARY_EVENT, "boundaryEvent"],
    [BpmnElementType.END_EVENT, "endEvent"],
    [BpmnElementType.SERVICE_TASK, "serviceTask"],
    [BpmnElementType.RECEIVE_TASK, "receiveTask"],
    [BpmnElementType.USER_TASK, "userTask"],
    [BpmnElementType.MANUAL_TASK, "manualTask"],
    [BpmnElementType.TASK, "task"],
    [BpmnElementType.BUSINESS_RULE_TASK, "businessRuleTask"],
    [BpmnElementType.SCRIPT_TASK, "scriptTask"],
    [BpmnElementType.SEND_TASK, "sendTask"],
    [BpmnElementType.EXCLUSIVE_GATEWAY, "exclusiveGateway"],
    [BpmnElementType.PARALLEL_GATEWAY, "parallelGateway"],
    [BpmnElementType.EVENT_BASED_GATEWAY, "eventBasedGateway"],
    [BpmnElementType.INCLUSIVE_GATEWAY, "inclusiveGateway"],
    [BpmnElementType.SEQUENCE_FLOW, "sequenceFlow"],
    [BpmnElementType.MULTI_INSTANCE_BODY, undefined],
    [BpmnElementType.CALL_ACTIVITY, "callActivity"],
    [BpmnElementType.UNSPECIFIED, undefined],
  ]);

/** Container element types that can hold child elements. */
const CONTAINER_TYPES: ReadonlySet<BpmnElementType> = new Set([
  BpmnElementType.PROCESS,
  BpmnElementType.SUB_PROCESS,
  BpmnElementType.EVENT_SUB_PROCESS,
  BpmnElementType.AD_HOC_SUB_PROCESS,
  BpmnElementType.AD_HOC_SUB_PROCESS_INNER_INSTANCE,
  BpmnElementType.MULTI_INSTANCE_BODY,
]);

/** Task element types. */
const TASK_TYPES: ReadonlySet<BpmnElementType> = new Set([
  BpmnElementType.SERVICE_TASK,
  BpmnElementType.RECEIVE_TASK,
  BpmnElementType.USER_TASK,
  BpmnElementType.MANUAL_TASK,
  BpmnElementType.TASK,
  BpmnElementType.BUSINESS_RULE_TASK,
  BpmnElementType.SCRIPT_TASK,
  BpmnElementType.SEND_TASK,
]);

/** Gateway element types. */
const GATEWAY_TYPES: ReadonlySet<BpmnElementType> = new Set([
  BpmnElementType.EXCLUSIVE_GATEWAY,
  BpmnElementType.PARALLEL_GATEWAY,
  BpmnElementType.EVENT_BASED_GATEWAY,
  BpmnElementType.INCLUSIVE_GATEWAY,
]);

/** Event element types. */
const EVENT_TYPES: ReadonlySet<BpmnElementType> = new Set([
  BpmnElementType.START_EVENT,
  BpmnElementType.INTERMEDIATE_CATCH_EVENT,
  BpmnElementType.INTERMEDIATE_THROW_EVENT,
  BpmnElementType.BOUNDARY_EVENT,
  BpmnElementType.END_EVENT,
]);

/**
 * Returns the BPMN XML element name for the given element type,
 * or undefined if the type has no direct XML representation.
 */
export function getElementTypeName(
  type: BpmnElementType
): string | undefined {
  return ELEMENT_TYPE_NAMES.get(type);
}

/**
 * Returns true if the element type is a container that can hold child elements
 * (PROCESS, SUB_PROCESS, EVENT_SUB_PROCESS, AD_HOC_SUB_PROCESS,
 * AD_HOC_SUB_PROCESS_INNER_INSTANCE, MULTI_INSTANCE_BODY).
 */
export function isContainerType(type: BpmnElementType): boolean {
  return CONTAINER_TYPES.has(type);
}

/**
 * Returns true if the element type is a task.
 */
export function isTaskType(type: BpmnElementType): boolean {
  return TASK_TYPES.has(type);
}

/**
 * Returns true if the element type is a gateway.
 */
export function isGatewayType(type: BpmnElementType): boolean {
  return GATEWAY_TYPES.has(type);
}

/**
 * Returns true if the element type is an event.
 */
export function isEventType(type: BpmnElementType): boolean {
  return EVENT_TYPES.has(type);
}

/**
 * Returns true if the element type is a flow node (task, gateway, event,
 * container, call activity — everything except SEQUENCE_FLOW and UNSPECIFIED).
 */
export function isFlowNode(type: BpmnElementType): boolean {
  return (
    type !== BpmnElementType.SEQUENCE_FLOW &&
    type !== BpmnElementType.UNSPECIFIED
  );
}
