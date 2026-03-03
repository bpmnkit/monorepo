/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import type { JobResult } from "./JobResult.js";
import { completeJob, failJob, throwError } from "./JobResult.js";

/**
 * Client interface provided to job handlers to report the outcome of job processing.
 *
 * Mirrors `io.camunda.client.api.worker.JobClient`, adapted for the browser:
 * - No network calls — results are collected synchronously
 * - No fluent step-builders — simple method calls with parameters
 *
 * Each handler invocation receives a fresh JobClient scoped to the active job.
 * The handler MUST call exactly one of complete/fail/throwError.
 */
export interface JobClient {
  /**
   * Mark the job as successfully completed.
   * @param variables - Output variables to merge into the process scope
   */
  complete(variables?: Record<string, unknown>): void;

  /**
   * Mark the job as failed. If retries > 0, the job will be retried.
   * If retries reaches 0, an incident is created.
   *
   * @param retries - Remaining retry count
   * @param errorMessage - Human-readable error description
   * @param retryBackoff - Delay in ms before retry (default: 0, ignored in browser)
   */
  fail(retries: number, errorMessage: string, retryBackoff?: number): void;

  /**
   * Throw a BPMN error to be caught by an error boundary event.
   * If no matching catch event exists, an incident is created.
   *
   * @param errorCode - BPMN error code to match against boundary events
   * @param errorMessage - Human-readable error description
   */
  throwError(errorCode: string, errorMessage?: string): void;
}

/**
 * Default JobClient implementation that captures the handler's result.
 *
 * Enforces that exactly one command is issued per job activation —
 * subsequent calls throw an error.
 */
export class DefaultJobClient implements JobClient {
  private _result: JobResult | undefined = undefined;
  private readonly _jobKey: number;

  constructor(jobKey: number) {
    this._jobKey = jobKey;
  }

  /** Returns the captured result, or undefined if no command was issued. */
  get result(): JobResult | undefined {
    return this._result;
  }

  complete(variables: Record<string, unknown> = {}): void {
    this.assertNoResult();
    this._result = completeJob(this._jobKey, variables);
  }

  fail(retries: number, errorMessage: string, retryBackoff: number = 0): void {
    this.assertNoResult();
    this._result = failJob(this._jobKey, retries, errorMessage, retryBackoff);
  }

  throwError(errorCode: string, errorMessage: string = ""): void {
    this.assertNoResult();
    this._result = throwError(this._jobKey, errorCode, errorMessage);
  }

  private assertNoResult(): void {
    if (this._result !== undefined) {
      throw new Error(
        `Job ${this._jobKey}: a result has already been submitted ` +
          `(${this._result._tag}). Each job handler must call exactly one ` +
          `of complete/fail/throwError.`
      );
    }
  }
}
