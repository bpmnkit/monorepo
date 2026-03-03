/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import type { Message } from "./Message.js";

/**
 * Read-only access to message state.
 *
 * Mirrors the immutable portion of `io.camunda.zeebe.engine.state.message.MessageState`,
 * adapted for the browser engine with in-memory Maps instead of RocksDB column families.
 */
export interface MessageState {
  /**
   * Returns the message with the given key, or undefined if not found.
   */
  getMessage(messageKey: number): Message | undefined;

  /**
   * Returns all non-expired messages matching the given name and correlation key.
   * Messages are returned in insertion order (by key, ascending).
   */
  findByNameAndCorrelationKey(
    name: string,
    correlationKey: string
  ): ReadonlyArray<Message>;

  /**
   * Returns true if a message with the given (name, correlationKey, messageId)
   * has already been published. Used for message ID deduplication.
   *
   * This is the first layer of deduplication — prevents the same message from
   * being published twice.
   */
  existMessageId(
    name: string,
    correlationKey: string,
    messageId: string
  ): boolean;

  /**
   * Returns true if the message with the given key has already been correlated
   * to the given BPMN process ID. Used for message-process deduplication.
   *
   * This is the second layer of deduplication — prevents the same message from
   * correlating to the same process definition twice.
   */
  existMessageCorrelation(
    messageKey: number,
    bpmnProcessId: string
  ): boolean;

  /**
   * Returns true if an active process instance already exists for the given
   * (bpmnProcessId, correlationKey) combination. Used for start event deduplication.
   *
   * This is the third layer of deduplication — prevents creating multiple
   * process instances for the same correlation key.
   */
  existActiveProcessInstance(
    bpmnProcessId: string,
    correlationKey: string
  ): boolean;
}
