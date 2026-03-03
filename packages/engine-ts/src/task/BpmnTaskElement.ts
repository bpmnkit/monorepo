/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

/**
 * Represents a BPMN task element in the process model.
 *
 * This is the element model type (`T`) used by task processors via
 * `BpmnElementProcessor<BpmnTaskElement>`.
 *
 * Mirrors the properties available on Zeebe's executable task model classes
 * (`ExecutableServiceTask`, `ExecutableReceiveTask`, etc.), adapted
 * for the browser engine.
 */
export interface BpmnTaskElement {
  /** BPMN element ID from the process model (e.g. "Task_Payment"). */
  readonly elementId: string;

  // --- Job properties (service task, business rule task, send task) ---

  /** The job type used to activate a worker (e.g. "payment-service"). */
  readonly jobType?: string;

  /** Default number of retries for jobs created by this task. */
  readonly jobRetries?: number;

  /**
   * Custom headers defined in the BPMN model for this task.
   * Immutable key-value pairs set at deploy time, passed to the job handler.
   */
  readonly customHeaders?: Readonly<Record<string, string>>;

  // --- Message properties (receive task) ---

  /** Message name for receive tasks. */
  readonly messageName?: string;

  /** Message correlation key expression for receive tasks. */
  readonly correlationKey?: string;
}
