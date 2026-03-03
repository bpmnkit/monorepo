/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import type { Message } from "./Message.js";
import type { MessageState } from "./MessageState.js";

/**
 * Mutable, in-memory implementation of message state.
 *
 * Replaces Zeebe's `DbMessageState` (backed by RocksDB column families) with
 * plain `Map` instances suitable for a single-threaded browser environment.
 *
 * Storage layout (mirrors Zeebe's column families):
 * - `messages`:            messageKey → Message          (MESSAGE_KEY)
 * - `messagesByNameAndKey`: "name|corrKey" → Set<msgKey> (MESSAGES)
 * - `messageIds`:          "name|corrKey|msgId" → true   (MESSAGE_IDS — dedup index)
 * - `correlatedMessages`:  "msgKey|processId" → true     (MESSAGE_CORRELATED — dedup index)
 * - `activeProcesses`:     "processId|corrKey" → true    (ACTIVE_BY_CORRELATION_KEY — dedup)
 */
export class MessageStore implements MessageState {
  /** messageKey → Message */
  private readonly messages = new Map<number, Message>();

  /** "name|correlationKey" → Set<messageKey> — for finding messages by name+corrKey */
  private readonly messagesByNameAndKey = new Map<string, Set<number>>();

  /** "name|correlationKey|messageId" → true — message ID deduplication index */
  private readonly messageIds = new Set<string>();

  /** "messageKey|bpmnProcessId" → true — message-process deduplication index */
  private readonly correlatedMessages = new Set<string>();

  /** "bpmnProcessId|correlationKey" → true — active process instance dedup index */
  private readonly activeProcesses = new Set<string>();

  // ---------------------------------------------------------------------------
  // Read operations (MessageState interface)
  // ---------------------------------------------------------------------------

  getMessage(messageKey: number): Message | undefined {
    return this.messages.get(messageKey);
  }

  findByNameAndCorrelationKey(
    name: string,
    correlationKey: string
  ): ReadonlyArray<Message> {
    const compositeKey = this.nameCorrelationKey(name, correlationKey);
    const keys = this.messagesByNameAndKey.get(compositeKey);
    if (!keys || keys.size === 0) {
      return [];
    }
    const result: Message[] = [];
    for (const key of keys) {
      const message = this.messages.get(key);
      if (message) {
        result.push(message);
      }
    }
    return result;
  }

  existMessageId(
    name: string,
    correlationKey: string,
    messageId: string
  ): boolean {
    return this.messageIds.has(this.messageIdKey(name, correlationKey, messageId));
  }

  existMessageCorrelation(
    messageKey: number,
    bpmnProcessId: string
  ): boolean {
    return this.correlatedMessages.has(
      this.correlationKey(messageKey, bpmnProcessId)
    );
  }

  existActiveProcessInstance(
    bpmnProcessId: string,
    correlationKey: string
  ): boolean {
    return this.activeProcesses.has(
      this.activeProcessKey(bpmnProcessId, correlationKey)
    );
  }

  // ---------------------------------------------------------------------------
  // Write operations
  // ---------------------------------------------------------------------------

  /**
   * Stores a published message and updates all indexes.
   * If the message has a messageId, it is added to the deduplication index.
   */
  putMessage(message: Message): void {
    this.messages.set(message.key, message);

    // Index by name + correlationKey
    const compositeKey = this.nameCorrelationKey(
      message.name,
      message.correlationKey
    );
    let keySet = this.messagesByNameAndKey.get(compositeKey);
    if (!keySet) {
      keySet = new Set<number>();
      this.messagesByNameAndKey.set(compositeKey, keySet);
    }
    keySet.add(message.key);

    // Index message ID for deduplication
    if (message.messageId !== undefined) {
      this.messageIds.add(
        this.messageIdKey(message.name, message.correlationKey, message.messageId)
      );
    }
  }

  /**
   * Removes a message and cleans up all related indexes.
   */
  removeMessage(messageKey: number): void {
    const message = this.messages.get(messageKey);
    if (!message) {
      return;
    }
    this.messages.delete(messageKey);

    // Remove from name+correlationKey index
    const compositeKey = this.nameCorrelationKey(
      message.name,
      message.correlationKey
    );
    const keySet = this.messagesByNameAndKey.get(compositeKey);
    if (keySet) {
      keySet.delete(messageKey);
      if (keySet.size === 0) {
        this.messagesByNameAndKey.delete(compositeKey);
      }
    }

    // Remove message ID dedup entry
    if (message.messageId !== undefined) {
      this.messageIds.delete(
        this.messageIdKey(message.name, message.correlationKey, message.messageId)
      );
    }
  }

  /**
   * Records that a message has been correlated to a BPMN process.
   * Prevents the same message from correlating to the same process again.
   */
  putMessageCorrelation(messageKey: number, bpmnProcessId: string): void {
    this.correlatedMessages.add(
      this.correlationKey(messageKey, bpmnProcessId)
    );
  }

  /**
   * Removes a message-process correlation record.
   */
  removeMessageCorrelation(messageKey: number, bpmnProcessId: string): void {
    this.correlatedMessages.delete(
      this.correlationKey(messageKey, bpmnProcessId)
    );
  }

  /**
   * Records that an active process instance exists for the given
   * (bpmnProcessId, correlationKey) pair. Prevents creating duplicate
   * process instances for start event messages.
   */
  putActiveProcessInstance(
    bpmnProcessId: string,
    correlationKey: string
  ): void {
    this.activeProcesses.add(
      this.activeProcessKey(bpmnProcessId, correlationKey)
    );
  }

  /**
   * Removes the active process instance record.
   */
  removeActiveProcessInstance(
    bpmnProcessId: string,
    correlationKey: string
  ): void {
    this.activeProcesses.delete(
      this.activeProcessKey(bpmnProcessId, correlationKey)
    );
  }

  /**
   * Returns the total number of stored messages.
   */
  get size(): number {
    return this.messages.size;
  }

  // ---------------------------------------------------------------------------
  // Composite key helpers
  // ---------------------------------------------------------------------------

  private nameCorrelationKey(name: string, correlationKey: string): string {
    return `${name}\0${correlationKey}`;
  }

  private messageIdKey(
    name: string,
    correlationKey: string,
    messageId: string
  ): string {
    return `${name}\0${correlationKey}\0${messageId}`;
  }

  private correlationKey(messageKey: number, bpmnProcessId: string): string {
    return `${messageKey}\0${bpmnProcessId}`;
  }

  private activeProcessKey(
    bpmnProcessId: string,
    correlationKey: string
  ): string {
    return `${bpmnProcessId}\0${correlationKey}`;
  }
}
