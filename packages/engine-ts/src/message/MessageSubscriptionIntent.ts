/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

/**
 * All intents for message subscription records.
 *
 * Mirrors `io.camunda.zeebe.protocol.record.intent.MessageSubscriptionIntent`.
 *
 * Intents follow a command→event pattern and track the subscription lifecycle:
 * CREATE → CREATED → CORRELATING → CORRELATE → CORRELATED → DELETE → DELETED
 */
export enum MessageSubscriptionIntent {
  // --- Commands ---
  CREATE = "CREATE",
  CORRELATE = "CORRELATE",
  REJECT = "REJECT",
  DELETE = "DELETE",

  // --- Events ---
  CREATED = "CREATED",
  CORRELATING = "CORRELATING",
  CORRELATED = "CORRELATED",
  REJECTED = "REJECTED",
  DELETED = "DELETED",
}

/** Commands that trigger subscription state changes. */
const SUBSCRIPTION_COMMANDS: ReadonlySet<MessageSubscriptionIntent> = new Set([
  MessageSubscriptionIntent.CREATE,
  MessageSubscriptionIntent.CORRELATE,
  MessageSubscriptionIntent.REJECT,
  MessageSubscriptionIntent.DELETE,
]);

/** Events that confirm subscription state changes. */
const SUBSCRIPTION_EVENTS: ReadonlySet<MessageSubscriptionIntent> = new Set([
  MessageSubscriptionIntent.CREATED,
  MessageSubscriptionIntent.CORRELATING,
  MessageSubscriptionIntent.CORRELATED,
  MessageSubscriptionIntent.REJECTED,
  MessageSubscriptionIntent.DELETED,
]);

/**
 * Returns true if the intent is a subscription command.
 */
export function isSubscriptionCommand(
  intent: MessageSubscriptionIntent
): boolean {
  return SUBSCRIPTION_COMMANDS.has(intent);
}

/**
 * Returns true if the intent is a subscription event.
 */
export function isSubscriptionEvent(
  intent: MessageSubscriptionIntent
): boolean {
  return SUBSCRIPTION_EVENTS.has(intent);
}
