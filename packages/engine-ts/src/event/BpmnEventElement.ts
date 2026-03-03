/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import type { BpmnEventDefinitionType } from "./BpmnEventDefinitionType.js";
import type { TimerDefinition } from "../timer/TimerDefinition.js";

/**
 * Represents a BPMN event element in the process model.
 *
 * This is the element model type (`T`) used by event processors via
 * `BpmnElementProcessor<BpmnEventElement>`.
 *
 * Mirrors the properties available on Zeebe's executable event model classes
 * (`ExecutableStartEvent`, `ExecutableEndEvent`, `ExecutableCatchEventElement`,
 * `ExecutableIntermediateThrowEvent`, `ExecutableBoundaryEvent`), adapted
 * for the browser engine.
 */
export interface BpmnEventElement {
  /** BPMN element ID from the process model (e.g. "StartEvent_1"). */
  readonly elementId: string;

  /** The type of event definition (none, message, timer, error, etc.). */
  readonly eventDefinitionType: BpmnEventDefinitionType;

  // --- Timer properties ---

  /** Timer definition for timer events. */
  readonly timerDefinition?: TimerDefinition;

  // --- Error properties ---

  /** Error code for error events (throw or catch). */
  readonly errorCode?: string;

  // --- Escalation properties ---

  /** Escalation code for escalation events (throw or catch). */
  readonly escalationCode?: string;

  // --- Link properties ---

  /** Link name for intermediate link events. */
  readonly linkName?: string;

  /**
   * For link throw events: the element ID of the target link catch event.
   * The engine navigates to this element when the throw event completes.
   */
  readonly linkTargetElementId?: string;

  // --- Message properties ---

  /** Message name for message events. */
  readonly messageName?: string;

  /** Message correlation key expression for message catch events. */
  readonly correlationKey?: string;

  // --- Boundary event properties ---

  /**
   * For boundary events: the BPMN element ID of the activity this event is attached to.
   * Undefined for non-boundary events.
   */
  readonly attachedToRef?: string;

  // --- Flow properties ---

  /** Whether this is an interrupting event (boundary events, event sub-processes). */
  readonly interrupting?: boolean;
}
