/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

/**
 * Represents an activated job that is ready to be processed by a handler.
 *
 * Mirrors `io.camunda.client.api.response.ActivatedJob`, adapted for the
 * browser environment. Network-specific fields (deadline, worker name) are
 * omitted since jobs are processed synchronously in a single-threaded context.
 *
 * Variables and custom headers are plain JavaScript objects instead of
 * MsgPack-encoded byte arrays.
 */
export interface ActivatedJob {
  /** Unique key identifying this job instance. */
  readonly key: number;

  /** The job type (e.g. "payment-service", "send-email"). */
  readonly type: string;

  /** Remaining retries before an incident is created on failure. */
  readonly retries: number;

  /**
   * Variables available to this job, scoped to the element instance.
   * In the browser engine these are plain JS objects (no MsgPack encoding).
   */
  readonly variables: Record<string, unknown>;

  /**
   * Custom headers defined in the BPMN model for this service task.
   * Immutable key-value pairs set at deploy time.
   */
  readonly customHeaders: Readonly<Record<string, string>>;

  // --- Process context ---

  /** BPMN element ID from the process model (e.g. "Task_Payment"). */
  readonly elementId: string;

  /** Key of the element instance that created this job. */
  readonly elementInstanceKey: number;

  /** Key of the process instance this job belongs to. */
  readonly processInstanceKey: number;

  /** BPMN process ID (e.g. "order-process"). */
  readonly bpmnProcessId: string;

  /** Key of the process definition. */
  readonly processDefinitionKey: number;
}
