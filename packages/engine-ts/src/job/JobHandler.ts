/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import type { ActivatedJob } from "./ActivatedJob.js";
import type { JobClient } from "./JobClient.js";

/**
 * Callback function that processes an activated job.
 *
 * Mirrors `io.camunda.client.api.worker.JobHandler` (functional interface),
 * adapted for the browser environment.
 *
 * The handler receives:
 * - `client` — used to report the outcome (complete/fail/throwError)
 * - `job` — the activated job with its variables, headers, and process context
 *
 * The handler MUST call exactly one method on the client. If the handler throws
 * an exception without calling any client method, the registry will auto-fail
 * the job (decrementing retries by 1).
 *
 * Handlers may be synchronous or return a Promise for async operations.
 */
export type JobHandler = (
  client: JobClient,
  job: ActivatedJob
) => void | Promise<void>;
