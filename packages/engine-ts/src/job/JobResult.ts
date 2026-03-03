/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

/**
 * Discriminated union representing the result of processing a job.
 *
 * In Zeebe, these map to the COMPLETE, FAIL, and THROW_ERROR commands sent
 * back to the broker. In the browser engine, they are returned synchronously
 * from the job handler via the JobClient.
 */
export type JobResult = CompleteJobResult | FailJobResult | ThrowErrorJobResult;

/**
 * Signals successful job completion. Optionally includes output variables
 * that are merged into the process instance scope.
 */
export interface CompleteJobResult {
  readonly _tag: "complete";
  readonly jobKey: number;
  readonly variables: Record<string, unknown>;
}

/**
 * Signals job failure. The engine decrements retries; if retries reach 0,
 * an incident is created.
 */
export interface FailJobResult {
  readonly _tag: "fail";
  readonly jobKey: number;
  readonly retries: number;
  readonly errorMessage: string;
  /** Delay in milliseconds before the job becomes activatable again. */
  readonly retryBackoff: number;
}

/**
 * Signals a BPMN error that should be caught by an error boundary event.
 * If no matching catch event exists, an incident is created.
 */
export interface ThrowErrorJobResult {
  readonly _tag: "throwError";
  readonly jobKey: number;
  readonly errorCode: string;
  readonly errorMessage: string;
}

export function completeJob(
  jobKey: number,
  variables: Record<string, unknown> = {}
): CompleteJobResult {
  return { _tag: "complete", jobKey, variables };
}

export function failJob(
  jobKey: number,
  retries: number,
  errorMessage: string,
  retryBackoff: number = 0
): FailJobResult {
  return { _tag: "fail", jobKey, retries, errorMessage, retryBackoff };
}

export function throwError(
  jobKey: number,
  errorCode: string,
  errorMessage: string = ""
): ThrowErrorJobResult {
  return { _tag: "throwError", jobKey, errorCode, errorMessage };
}
