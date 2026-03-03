/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

/**
 * Process instance-related data of the element being executed.
 *
 * This is a minimal context interface for the browser engine. The full Zeebe
 * `BpmnElementContext` carries partition/record metadata that is not relevant
 * in a single-threaded browser environment.
 */
export interface BpmnElementContext {
  /** Unique key identifying this element instance. */
  readonly elementInstanceKey: number;

  /** Key of the flow scope (parent container) element instance. */
  readonly flowScopeKey: number;

  /** Key of the process instance this element belongs to. */
  readonly processInstanceKey: number;

  /** Key of the process definition. */
  readonly processDefinitionKey: number;

  /** BPMN element ID from the process model (e.g. "Task_1"). */
  readonly elementId: string;

  /** BPMN process ID (e.g. "order-process"). */
  readonly bpmnProcessId: string;
}
