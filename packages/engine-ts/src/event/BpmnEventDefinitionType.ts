/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

/**
 * The type of event definition attached to a BPMN event element.
 *
 * Mirrors the event definition types in Zeebe's executable model
 * (e.g. `ExecutableStartEvent.getEventType()`, `ExecutableEndEvent` inner behaviors).
 *
 * Each BPMN event (start, end, intermediate, boundary) has exactly one
 * event definition that determines its trigger/behavior.
 */
export enum BpmnEventDefinitionType {
  /** No event definition — the event triggers immediately (passthrough). */
  NONE = "NONE",

  /** Message event — correlates with a published message. */
  MESSAGE = "MESSAGE",

  /** Timer event — triggers after a duration, at a date, or on a cycle. */
  TIMER = "TIMER",

  /** Error event — propagates or catches BPMN errors. */
  ERROR = "ERROR",

  /** Escalation event — propagates or catches escalations (non-interrupting capable). */
  ESCALATION = "ESCALATION",

  /** Signal event — broadcasts or catches named signals. */
  SIGNAL = "SIGNAL",

  /** Link event — navigates between a throw and catch link in the same process. */
  LINK = "LINK",

  /** Terminate event — terminates all active elements in the flow scope. */
  TERMINATE = "TERMINATE",

  /** Compensation event — triggers compensation handlers. */
  COMPENSATION = "COMPENSATION",
}

/** Event definitions that represent a wait state (element stays activated until triggered). */
const WAIT_STATE_DEFINITIONS: ReadonlySet<BpmnEventDefinitionType> = new Set([
  BpmnEventDefinitionType.MESSAGE,
  BpmnEventDefinitionType.TIMER,
  BpmnEventDefinitionType.SIGNAL,
]);

/** Event definitions that pass through immediately (no waiting). */
const PASSTHROUGH_DEFINITIONS: ReadonlySet<BpmnEventDefinitionType> = new Set([
  BpmnEventDefinitionType.NONE,
  BpmnEventDefinitionType.LINK,
  BpmnEventDefinitionType.TERMINATE,
  BpmnEventDefinitionType.COMPENSATION,
]);

/**
 * Returns true if the event definition type represents a wait state.
 * Wait-state events subscribe to triggers and stay activated until fired.
 */
export function isWaitState(type: BpmnEventDefinitionType): boolean {
  return WAIT_STATE_DEFINITIONS.has(type);
}

/**
 * Returns true if the event definition type passes through immediately.
 */
export function isPassthrough(type: BpmnEventDefinitionType): boolean {
  return PASSTHROUGH_DEFINITIONS.has(type);
}
