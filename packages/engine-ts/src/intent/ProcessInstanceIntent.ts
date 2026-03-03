/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

/**
 * All intents for process instance records.
 *
 * Mirrors `io.camunda.zeebe.protocol.record.intent.ProcessInstanceIntent`.
 *
 * Intents are classified into three groups:
 * - Process instance commands (CANCEL)
 * - BPMN element commands (ACTIVATE_ELEMENT, COMPLETE_ELEMENT, TERMINATE_ELEMENT, etc.)
 * - BPMN element events (everything else — lifecycle states, sequence flows, migration)
 */
export enum ProcessInstanceIntent {
  // --- Process instance commands ---
  CANCEL = "CANCEL",

  // --- BPMN element lifecycle events (the 6 states) ---
  ELEMENT_ACTIVATING = "ELEMENT_ACTIVATING",
  ELEMENT_ACTIVATED = "ELEMENT_ACTIVATED",
  ELEMENT_COMPLETING = "ELEMENT_COMPLETING",
  ELEMENT_COMPLETED = "ELEMENT_COMPLETED",
  ELEMENT_TERMINATING = "ELEMENT_TERMINATING",
  ELEMENT_TERMINATED = "ELEMENT_TERMINATED",

  // --- BPMN element commands ---
  ACTIVATE_ELEMENT = "ACTIVATE_ELEMENT",
  COMPLETE_ELEMENT = "COMPLETE_ELEMENT",
  TERMINATE_ELEMENT = "TERMINATE_ELEMENT",

  // --- Flow events ---
  SEQUENCE_FLOW_TAKEN = "SEQUENCE_FLOW_TAKEN",
  SEQUENCE_FLOW_DELETED = "SEQUENCE_FLOW_DELETED",

  // --- Migration events ---
  ELEMENT_MIGRATED = "ELEMENT_MIGRATED",
  ANCESTOR_MIGRATED = "ANCESTOR_MIGRATED",

  // --- Execution listener / termination continuation ---
  COMPLETE_EXECUTION_LISTENER = "COMPLETE_EXECUTION_LISTENER",
  CONTINUE_TERMINATING_ELEMENT = "CONTINUE_TERMINATING_ELEMENT",

  // --- Audit event ---
  CANCELING = "CANCELING",
}

/** Commands that operate on the process instance level. */
const PROCESS_INSTANCE_COMMANDS: ReadonlySet<ProcessInstanceIntent> = new Set([
  ProcessInstanceIntent.CANCEL,
]);

/** Commands that operate on individual BPMN elements. */
const BPMN_ELEMENT_COMMANDS: ReadonlySet<ProcessInstanceIntent> = new Set([
  ProcessInstanceIntent.ACTIVATE_ELEMENT,
  ProcessInstanceIntent.COMPLETE_ELEMENT,
  ProcessInstanceIntent.TERMINATE_ELEMENT,
  ProcessInstanceIntent.COMPLETE_EXECUTION_LISTENER,
  ProcessInstanceIntent.CONTINUE_TERMINATING_ELEMENT,
]);

/** Events emitted during BPMN element processing. */
const BPMN_ELEMENT_EVENTS: ReadonlySet<ProcessInstanceIntent> = new Set([
  ProcessInstanceIntent.SEQUENCE_FLOW_TAKEN,
  ProcessInstanceIntent.ELEMENT_ACTIVATING,
  ProcessInstanceIntent.ELEMENT_ACTIVATED,
  ProcessInstanceIntent.ELEMENT_COMPLETING,
  ProcessInstanceIntent.ELEMENT_COMPLETED,
  ProcessInstanceIntent.ELEMENT_TERMINATING,
  ProcessInstanceIntent.ELEMENT_TERMINATED,
  ProcessInstanceIntent.ELEMENT_MIGRATED,
  ProcessInstanceIntent.ANCESTOR_MIGRATED,
  ProcessInstanceIntent.SEQUENCE_FLOW_DELETED,
  ProcessInstanceIntent.CANCELING,
]);

/**
 * Returns true if the intent is a process-instance-level command (e.g. CANCEL).
 */
export function isProcessInstanceCommand(intent: ProcessInstanceIntent): boolean {
  return PROCESS_INSTANCE_COMMANDS.has(intent);
}

/**
 * Returns true if the intent is a BPMN element command
 * (ACTIVATE_ELEMENT, COMPLETE_ELEMENT, TERMINATE_ELEMENT, etc.).
 */
export function isBpmnElementCommand(intent: ProcessInstanceIntent): boolean {
  return BPMN_ELEMENT_COMMANDS.has(intent);
}

/**
 * Returns true if the intent is a BPMN element event
 * (lifecycle states, sequence flows, migration — anything that is not a command).
 */
export function isBpmnElementEvent(intent: ProcessInstanceIntent): boolean {
  return BPMN_ELEMENT_EVENTS.has(intent);
}

/**
 * Returns true if the intent represents an event (as opposed to a command).
 */
export function isEvent(intent: ProcessInstanceIntent): boolean {
  return !isProcessInstanceCommand(intent) && !isBpmnElementCommand(intent);
}
