/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import type { LoopCharacteristics } from "./LoopCharacteristics.js";

/**
 * Represents a BPMN multi-instance body element wrapping an inner activity.
 *
 * Mirrors `io.camunda.zeebe.engine.processing.deployment.model.element.ExecutableMultiInstanceBody`.
 *
 * The multi-instance body is a virtual container element (not directly visible in BPMN XML)
 * that wraps the actual activity element (e.g., a service task) and manages the loop execution.
 * Each iteration creates a child instance of the inner activity.
 *
 * @typeParam T - The type of the inner activity element
 */
export interface MultiInstanceBody<T> {
  /** The loop configuration (sequential/parallel, collections, completion condition). */
  readonly loopCharacteristics: LoopCharacteristics;

  /** The inner activity element that is instantiated for each iteration. */
  readonly innerActivity: T;

  /** The BPMN element ID of the inner activity (used for child instance creation). */
  readonly innerActivityId: string;
}
