/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import type { ActivatedJob } from "./ActivatedJob.js";
import type { JobHandler } from "./JobHandler.js";
import type { JobResult } from "./JobResult.js";
import { DefaultJobClient } from "./JobClient.js";
import { failJob } from "./JobResult.js";

/**
 * Registry that maps job types to handler callbacks.
 *
 * Replaces Zeebe's distributed job activation loop with a simple in-memory
 * type→handler map for the browser environment. When a service task activates
 * a job, the engine calls `activateJob()` which:
 *
 * 1. Looks up the registered handler for the job type
 * 2. Creates a scoped `JobClient` for the handler to report its result
 * 3. Invokes the handler synchronously (or awaits its Promise)
 * 4. Returns the `JobResult` (complete/fail/throwError)
 *
 * If the handler throws an exception without calling any client method,
 * the registry auto-fails the job with retries decremented by 1.
 *
 * If no handler is registered for a job type, activation returns a failure
 * result indicating a missing handler.
 */
export class JobWorkerRegistry {
  private readonly handlers = new Map<string, JobHandler>();

  /**
   * Register a handler for a job type. Overwrites any existing handler
   * for the same type.
   *
   * @param jobType - The job type to handle (e.g. "payment-service")
   * @param handler - Callback invoked when a job of this type is activated
   */
  registerHandler(jobType: string, handler: JobHandler): void {
    this.handlers.set(jobType, handler);
  }

  /**
   * Remove a previously registered handler for a job type.
   *
   * @param jobType - The job type to unregister
   * @returns true if a handler was removed, false if none was registered
   */
  unregisterHandler(jobType: string): boolean {
    return this.handlers.delete(jobType);
  }

  /**
   * Returns true if a handler is registered for the given job type.
   */
  hasHandler(jobType: string): boolean {
    return this.handlers.has(jobType);
  }

  /**
   * Returns the set of all registered job types.
   */
  getRegisteredTypes(): ReadonlySet<string> {
    return new Set(this.handlers.keys());
  }

  /**
   * Returns the number of registered handlers.
   */
  get size(): number {
    return this.handlers.size;
  }

  /**
   * Activate a job by invoking the registered handler for its type.
   *
   * @param job - The activated job to process
   * @returns The job result — always resolves (never rejects). On handler
   *          exception, returns an auto-fail result with retries - 1.
   */
  async activateJob(job: ActivatedJob): Promise<JobResult> {
    const handler = this.handlers.get(job.type);
    if (!handler) {
      return failJob(
        job.key,
        job.retries,
        `No handler registered for job type '${job.type}'`
      );
    }

    const client = new DefaultJobClient(job.key);

    try {
      const maybePromise = handler(client, job);
      if (maybePromise instanceof Promise) {
        await maybePromise;
      }
    } catch (error) {
      // If handler threw without calling a client method, auto-fail
      if (client.result === undefined) {
        const message =
          error instanceof Error ? error.message : String(error);
        return failJob(
          job.key,
          Math.max(0, job.retries - 1),
          `Handler threw an exception: ${message}`
        );
      }
      // Handler called a client method before throwing — use the captured result
    }

    if (client.result === undefined) {
      return failJob(
        job.key,
        Math.max(0, job.retries - 1),
        `Handler for job type '${job.type}' did not call complete, fail, or throwError`
      );
    }

    return client.result;
  }

  /**
   * Remove all registered handlers.
   */
  clear(): void {
    this.handlers.clear();
  }
}
