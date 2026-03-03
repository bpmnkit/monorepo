/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import { ProcessInstanceIntent } from "../intent/ProcessInstanceIntent.js";

/**
 * Defines the valid state transitions for BPMN element instances.
 *
 * Mirrors `io.camunda.zeebe.engine.processing.bpmn.ProcessInstanceLifecycle`.
 *
 * The 6 element instance states and their transitions:
 *
 * ```
 * ELEMENT_ACTIVATING  → ELEMENT_ACTIVATED | ELEMENT_TERMINATING
 * ELEMENT_ACTIVATED   → ELEMENT_COMPLETING | ELEMENT_TERMINATING
 * ELEMENT_COMPLETING  → ELEMENT_COMPLETED | ELEMENT_TERMINATING
 * ELEMENT_TERMINATING → ELEMENT_TERMINATED
 * ELEMENT_COMPLETED   → SEQUENCE_FLOW_TAKEN
 * ELEMENT_TERMINATED  → (none — final state)
 * SEQUENCE_FLOW_TAKEN → ELEMENT_ACTIVATING
 * ```
 */

const {
  ELEMENT_ACTIVATING,
  ELEMENT_ACTIVATED,
  ELEMENT_COMPLETING,
  ELEMENT_COMPLETED,
  ELEMENT_TERMINATING,
  ELEMENT_TERMINATED,
  SEQUENCE_FLOW_TAKEN,
} = ProcessInstanceIntent;

/** The 6 states that represent an active element instance in the state machine. */
const ELEMENT_INSTANCE_STATES: ReadonlySet<ProcessInstanceIntent> = new Set([
  ELEMENT_ACTIVATING,
  ELEMENT_ACTIVATED,
  ELEMENT_COMPLETING,
  ELEMENT_COMPLETED,
  ELEMENT_TERMINATING,
  ELEMENT_TERMINATED,
]);

/** Terminal states — no further lifecycle transitions possible from the element itself. */
const FINAL_STATES: ReadonlySet<ProcessInstanceIntent> = new Set([
  ELEMENT_COMPLETED,
  ELEMENT_TERMINATED,
]);

/** States from which an element can be moved to ELEMENT_TERMINATING. */
const TERMINATABLE_STATES: ReadonlySet<ProcessInstanceIntent> = new Set([
  ELEMENT_ACTIVATING,
  ELEMENT_ACTIVATED,
  ELEMENT_COMPLETING,
]);

/**
 * Map of valid transitions: `from → Set<to>`.
 *
 * ELEMENT_TERMINATED has an empty set — it is a final sink state.
 */
const TRANSITION_RULES: ReadonlyMap<
  ProcessInstanceIntent,
  ReadonlySet<ProcessInstanceIntent>
> = new Map([
  [ELEMENT_ACTIVATING, new Set([ELEMENT_ACTIVATED, ELEMENT_TERMINATING])],
  [ELEMENT_ACTIVATED, new Set([ELEMENT_COMPLETING, ELEMENT_TERMINATING])],
  [ELEMENT_COMPLETING, new Set([ELEMENT_COMPLETED, ELEMENT_TERMINATING])],
  [ELEMENT_TERMINATING, new Set([ELEMENT_TERMINATED])],
  [ELEMENT_COMPLETED, new Set([SEQUENCE_FLOW_TAKEN])],
  [ELEMENT_TERMINATED, new Set<ProcessInstanceIntent>()],
  [SEQUENCE_FLOW_TAKEN, new Set([ELEMENT_ACTIVATING])],
]);

/**
 * Returns true if transitioning from `from` to `to` is a valid lifecycle transition.
 *
 * @throws Error if `from` is not a recognized lifecycle state.
 */
export function canTransition(
  from: ProcessInstanceIntent,
  to: ProcessInstanceIntent
): boolean {
  const allowed = TRANSITION_RULES.get(from);
  if (!allowed) {
    throw new Error(
      `State '${from}' is not a recognized lifecycle state in the transition rules.`
    );
  }
  return allowed.has(to);
}

/**
 * Returns true if the state is a final state (ELEMENT_COMPLETED or ELEMENT_TERMINATED).
 * No further lifecycle transitions are possible from a final state (except SEQUENCE_FLOW_TAKEN
 * from COMPLETED, which is a flow-level concern, not an element-level one).
 */
export function isFinalState(state: ProcessInstanceIntent): boolean {
  return FINAL_STATES.has(state);
}

/**
 * Returns true if the state is the initial state (ELEMENT_ACTIVATING).
 */
export function isInitialState(state: ProcessInstanceIntent): boolean {
  return state === ELEMENT_ACTIVATING;
}

/**
 * Returns true if the state is one of the 6 element instance states.
 */
export function isElementInstanceState(state: ProcessInstanceIntent): boolean {
  return ELEMENT_INSTANCE_STATES.has(state);
}

/**
 * Returns true if the state is a "token" state — i.e., not an element instance state.
 * Token states represent flow-level movement (e.g. SEQUENCE_FLOW_TAKEN).
 */
export function isTokenState(state: ProcessInstanceIntent): boolean {
  return !isElementInstanceState(state);
}

/**
 * Returns true if the element can be terminated from its current state.
 * Only ELEMENT_ACTIVATING, ELEMENT_ACTIVATED, and ELEMENT_COMPLETING are terminatable.
 */
export function canTerminate(currentState: ProcessInstanceIntent): boolean {
  return TERMINATABLE_STATES.has(currentState);
}

/**
 * Returns true if the element is in the ELEMENT_ACTIVATED state (actively running).
 */
export function isActive(currentState: ProcessInstanceIntent): boolean {
  return currentState === ELEMENT_ACTIVATED;
}

/**
 * Returns true if the element is in the ELEMENT_TERMINATING state.
 */
export function isTerminating(currentState: ProcessInstanceIntent): boolean {
  return currentState === ELEMENT_TERMINATING;
}
