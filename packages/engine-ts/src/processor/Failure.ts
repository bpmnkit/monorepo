/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

/**
 * Error types that can occur during BPMN element processing.
 * Mirrors the subset of `io.camunda.zeebe.protocol.record.value.ErrorType` relevant
 * to the browser engine.
 */
export enum ErrorType {
  UNKNOWN = "UNKNOWN",
  IO_MAPPING_ERROR = "IO_MAPPING_ERROR",
  JOB_NO_RETRIES = "JOB_NO_RETRIES",
  CONDITION_ERROR = "CONDITION_ERROR",
  EXTRACT_VALUE_ERROR = "EXTRACT_VALUE_ERROR",
  CALLED_ELEMENT_ERROR = "CALLED_ELEMENT_ERROR",
  UNHANDLED_ERROR_EVENT = "UNHANDLED_ERROR_EVENT",
  MESSAGE_SIZE_EXCEEDED = "MESSAGE_SIZE_EXCEEDED",
  CALLED_DECISION_ERROR = "CALLED_DECISION_ERROR",
  DECISION_EVALUATION_ERROR = "DECISION_EVALUATION_ERROR",
  FORM_NOT_FOUND = "FORM_NOT_FOUND",
  RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",
  EXECUTION_LISTENER_NO_RETRIES = "EXECUTION_LISTENER_NO_RETRIES",
  TASK_LISTENER_NO_RETRIES = "TASK_LISTENER_NO_RETRIES",
  AD_HOC_SUB_PROCESS_NO_RETRIES = "AD_HOC_SUB_PROCESS_NO_RETRIES",
}

/**
 * Represents a failure that occurred during BPMN element processing.
 *
 * Mirrors `io.camunda.zeebe.engine.processing.common.Failure`.
 */
export class Failure {
  readonly message: string;
  readonly errorType: ErrorType | undefined;
  readonly variableScopeKey: number;

  constructor(
    message: string,
    errorType?: ErrorType,
    variableScopeKey: number = -1
  ) {
    this.message = message;
    this.errorType = errorType;
    this.variableScopeKey = variableScopeKey;
  }

  toString(): string {
    return `Failure{message='${this.message}', errorType=${this.errorType ?? "undefined"}, variableScopeKey=${this.variableScopeKey}}`;
  }
}
