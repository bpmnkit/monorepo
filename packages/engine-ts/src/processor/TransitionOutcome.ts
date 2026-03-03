/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

/**
 * Represents the outcome of a BPMN element transition method, indicating whether the
 * next step (e.g. finalize method) should be invoked immediately or await an external trigger.
 *
 * Mirrors `io.camunda.zeebe.engine.processing.bpmn.BpmnElementProcessor.TransitionOutcome`.
 */
export enum TransitionOutcome {
  /** Continue processing by invoking the related finalize transition method immediately. */
  CONTINUE = "CONTINUE",

  /** Pause the transition and wait for an external trigger to finalize the step. */
  AWAIT = "AWAIT",
}
