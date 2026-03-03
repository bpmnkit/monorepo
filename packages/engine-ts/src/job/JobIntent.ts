/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

/**
 * All intents for job records.
 *
 * Mirrors `io.camunda.zeebe.protocol.record.intent.JobIntent`.
 *
 * Intents follow a command→event pattern:
 * - Commands trigger state changes (COMPLETE, FAIL, THROW_ERROR, etc.)
 * - Events confirm the state change (COMPLETED, FAILED, ERROR_THROWN, etc.)
 */
export enum JobIntent {
  // --- Events (state changes) ---
  CREATED = "CREATED",
  COMPLETED = "COMPLETED",
  TIMED_OUT = "TIMED_OUT",
  FAILED = "FAILED",
  ERROR_THROWN = "ERROR_THROWN",
  RETRIES_UPDATED = "RETRIES_UPDATED",
  CANCELED = "CANCELED",
  YIELDED = "YIELDED",
  RECURRED_AFTER_BACKOFF = "RECURRED_AFTER_BACKOFF",
  UPDATED = "UPDATED",
  MIGRATED = "MIGRATED",

  // --- Commands ---
  COMPLETE = "COMPLETE",
  FAIL = "FAIL",
  THROW_ERROR = "THROW_ERROR",
  UPDATE_RETRIES = "UPDATE_RETRIES",
  YIELD = "YIELD",
  UPDATE = "UPDATE",
  RECUR_AFTER_BACKOFF = "RECUR_AFTER_BACKOFF",
  TIME_OUT = "TIME_OUT",
}

/** Commands that trigger job state changes. */
const JOB_COMMANDS: ReadonlySet<JobIntent> = new Set([
  JobIntent.COMPLETE,
  JobIntent.FAIL,
  JobIntent.THROW_ERROR,
  JobIntent.UPDATE_RETRIES,
  JobIntent.YIELD,
  JobIntent.UPDATE,
  JobIntent.RECUR_AFTER_BACKOFF,
  JobIntent.TIME_OUT,
]);

/** Events that confirm job state changes. */
const JOB_EVENTS: ReadonlySet<JobIntent> = new Set([
  JobIntent.CREATED,
  JobIntent.COMPLETED,
  JobIntent.TIMED_OUT,
  JobIntent.FAILED,
  JobIntent.ERROR_THROWN,
  JobIntent.RETRIES_UPDATED,
  JobIntent.CANCELED,
  JobIntent.YIELDED,
  JobIntent.RECURRED_AFTER_BACKOFF,
  JobIntent.UPDATED,
  JobIntent.MIGRATED,
]);

/**
 * Returns true if the intent is a job command (triggers a state change).
 */
export function isJobCommand(intent: JobIntent): boolean {
  return JOB_COMMANDS.has(intent);
}

/**
 * Returns true if the intent is a job event (confirms a state change).
 */
export function isJobEvent(intent: JobIntent): boolean {
  return JOB_EVENTS.has(intent);
}
