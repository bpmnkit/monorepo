/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

/**
 * Represents a published message in the engine.
 *
 * Mirrors `io.camunda.zeebe.protocol.impl.record.value.message.MessageRecord`,
 * adapted for the browser engine. MsgPack encoding is replaced with plain
 * JavaScript objects for variables.
 */
export interface Message {
  /** Unique key assigned when the message is published. */
  readonly key: number;

  /** The message name — used to match against subscriptions. */
  readonly name: string;

  /**
   * The correlation key — used to match a message to a specific process instance
   * or start event subscription. May be empty for start event messages.
   */
  readonly correlationKey: string;

  /**
   * Optional unique message ID for deduplication. If provided, only one message
   * with the same (name, correlationKey, messageId) combination is accepted.
   */
  readonly messageId: string | undefined;

  /**
   * Variables to propagate when the message is correlated.
   * Plain JS objects instead of MsgPack-encoded byte arrays.
   */
  readonly variables: Record<string, unknown>;

  /**
   * Time-to-live in milliseconds. The message expires and can no longer be
   * correlated after this duration. A value of 0 means the message expires
   * immediately after the first correlation attempt.
   */
  readonly timeToLive: number;

  /**
   * Absolute timestamp (ms since epoch) after which the message is expired.
   * Computed as `publishTimestamp + timeToLive`.
   */
  readonly deadline: number;
}
