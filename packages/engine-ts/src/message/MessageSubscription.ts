/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

/**
 * Represents a message subscription created by a message catch event or
 * receive task in a process instance.
 *
 * Mirrors `io.camunda.zeebe.engine.state.message.MessageSubscription`,
 * adapted for the browser engine. The `correlating` flag tracks whether the
 * subscription is currently in the process of being correlated to a message.
 *
 * Subscriptions are indexed by (messageName, correlationKey) for efficient
 * lookup during message publication.
 */
export interface MessageSubscription {
  /** The message name this subscription is waiting for. */
  readonly messageName: string;

  /** The correlation key to match against incoming messages. */
  readonly correlationKey: string;

  /** The process instance that owns this subscription. */
  readonly processInstanceKey: number;

  /** The element instance (catch event / receive task) that created this subscription. */
  readonly elementInstanceKey: number;

  /** BPMN process ID of the process that owns this subscription. */
  readonly bpmnProcessId: string;

  /** Whether this is an interrupting subscription (e.g. interrupting boundary event). */
  readonly interrupting: boolean;

  /**
   * Whether this subscription is currently correlating to a message.
   * When true, the subscription will not be matched to additional messages
   * until the current correlation completes or is rejected.
   */
  readonly correlating: boolean;

  /**
   * Key of the message currently being correlated to this subscription.
   * Only meaningful when `correlating` is true.
   */
  readonly messageKey: number;

  /** Variables from the correlated message, applied during correlation. */
  readonly variables: Record<string, unknown>;
}
