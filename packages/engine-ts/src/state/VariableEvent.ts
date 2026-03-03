/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import type { VariableIntent } from "./VariableIntent.js";

/**
 * An event emitted when a variable is created or updated.
 *
 * Mirrors the event records produced by `VariableBehavior` in the Zeebe engine.
 */
export interface VariableEvent {
  /** Whether the variable was newly created or an existing one was updated. */
  readonly intent: VariableIntent;

  /** The scope key where the variable resides. */
  readonly scopeKey: number;

  /** The variable name. */
  readonly name: string;

  /** The new variable value (JSON-compatible). */
  readonly value: unknown;

  /** The previous value, present only for UPDATED events. */
  readonly oldValue?: unknown;
}
