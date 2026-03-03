/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

/**
 * Represents a BPMN sub-process element in the process model.
 *
 * This is the element model type (`T`) used by {@link SubProcessProcessor} and
 * {@link AdHocSubProcessInnerInstanceProcessor} via
 * `BpmnElementContainerProcessor<BpmnSubProcessElement>`.
 *
 * Mirrors the properties available on Zeebe's `ExecutableFlowElementContainer`,
 * adapted for the browser engine.
 */
export interface BpmnSubProcessElement {
  /** BPMN element ID from the process model (e.g. "SubProcess_1"). */
  readonly elementId: string;

  /**
   * Element ID of the none start event within this sub-process.
   * Required for standard sub-processes; absent for ad-hoc sub-processes
   * (which activate elements on demand rather than via a start event).
   */
  readonly startEventId?: string;
}

/**
 * Represents a BPMN ad-hoc sub-process element in the process model.
 *
 * This is the element model type (`T`) used by {@link AdHocSubProcessProcessor} via
 * `BpmnElementContainerProcessor<BpmnAdHocSubProcessElement>`.
 *
 * Mirrors the properties available on Zeebe's `ExecutableAdHocSubProcess`,
 * adapted for the browser engine. The browser engine supports the BPMN
 * implementation type only (not job-worker based orchestration).
 */
export interface BpmnAdHocSubProcessElement extends BpmnSubProcessElement {
  /**
   * Whether to cancel remaining active instances when the completion condition
   * is met. Defaults to `true` per the BPMN specification.
   */
  readonly cancelRemainingInstances?: boolean;

  /**
   * Element IDs of activities to activate when the ad-hoc sub-process starts.
   * If empty or undefined, no elements are activated automatically.
   */
  readonly activeElements?: readonly string[];
}
