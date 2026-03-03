/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

/**
 * All intents for message records.
 *
 * Mirrors `io.camunda.zeebe.protocol.record.intent.MessageIntent`.
 *
 * Intents follow a command→event pattern:
 * - Commands trigger state changes (PUBLISH, EXPIRE)
 * - Events confirm the state change (PUBLISHED, EXPIRED)
 */
export enum MessageIntent {
  // --- Commands ---
  PUBLISH = "PUBLISH",
  EXPIRE = "EXPIRE",

  // --- Events ---
  PUBLISHED = "PUBLISHED",
  EXPIRED = "EXPIRED",
}

/** Commands that trigger message state changes. */
const MESSAGE_COMMANDS: ReadonlySet<MessageIntent> = new Set([
  MessageIntent.PUBLISH,
  MessageIntent.EXPIRE,
]);

/** Events that confirm message state changes. */
const MESSAGE_EVENTS: ReadonlySet<MessageIntent> = new Set([
  MessageIntent.PUBLISHED,
  MessageIntent.EXPIRED,
]);

/**
 * Returns true if the intent is a message command (triggers a state change).
 */
export function isMessageCommand(intent: MessageIntent): boolean {
  return MESSAGE_COMMANDS.has(intent);
}

/**
 * Returns true if the intent is a message event (confirms a state change).
 */
export function isMessageEvent(intent: MessageIntent): boolean {
  return MESSAGE_EVENTS.has(intent);
}
