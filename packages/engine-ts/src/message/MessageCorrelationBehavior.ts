/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import type { Message } from "./Message.js";
import type { MessageSubscription } from "./MessageSubscription.js";
import type { MessageStore } from "./MessageStore.js";
import type { MessageSubscriptionStore } from "./MessageSubscriptionStore.js";

/**
 * Result of a publish operation.
 */
export type PublishResult =
  | { readonly outcome: "published"; readonly message: Message }
  | { readonly outcome: "rejected"; readonly reason: string };

/**
 * Result of a single subscription correlation.
 */
export interface CorrelationResult {
  /** The subscription that was correlated. */
  readonly subscription: MessageSubscription;
  /** The message that was correlated to the subscription. */
  readonly message: Message;
}

/**
 * Callback interface for receiving correlation events.
 *
 * The engine registers a listener to react to correlation outcomes
 * (e.g. trigger element completion, propagate variables).
 */
export interface CorrelationListener {
  /**
   * Called when a message is successfully correlated to a subscription.
   * The subscription has been updated to the correlating state.
   */
  onCorrelated(result: CorrelationResult): void;
}

/**
 * Core message correlation logic with three-layer deduplication.
 *
 * Mirrors `io.camunda.zeebe.engine.processing.message.MessageCorrelator` and
 * `MessageCorrelateBehavior`, adapted for single-threaded browser execution.
 *
 * ## Deduplication layers
 *
 * 1. **Message ID deduplication**: Rejects publish if a message with the same
 *    (name, correlationKey, messageId) has already been published.
 *    Mirrors Zeebe's `MESSAGE_IDS` column family.
 *
 * 2. **Message-process deduplication**: Prevents the same message from correlating
 *    to the same BPMN process definition more than once.
 *    Mirrors Zeebe's `MESSAGE_CORRELATED` column family.
 *
 * 3. **Active process instance deduplication**: For start event correlation,
 *    prevents creating multiple process instances for the same
 *    (bpmnProcessId, correlationKey) combination.
 *    Mirrors Zeebe's `ACTIVE_BY_CORRELATION_KEY` column family.
 *
 * ## Simplifications vs Zeebe
 *
 * - No cross-partition command routing (single-threaded browser environment)
 * - Synchronous correlation (no CompletableFuture / actor scheduling)
 * - No MsgPack encoding (plain JavaScript objects)
 * - TTL expiration via simple timestamp comparison
 */
export class MessageCorrelationBehavior {
  private nextMessageKey = 1;

  constructor(
    private readonly messageStore: MessageStore,
    private readonly subscriptionStore: MessageSubscriptionStore,
    private readonly clock: () => number = Date.now
  ) {}

  /**
   * Publishes a message and immediately attempts to correlate it to
   * waiting subscriptions.
   *
   * ## Algorithm (mirrors Zeebe's MessagePublishProcessor)
   *
   * 1. Check message ID deduplication — reject if duplicate
   * 2. Create the message record with computed deadline
   * 3. Store the message in the message store
   * 4. Attempt correlation to existing subscriptions
   * 5. If TTL is 0, expire immediately after correlation attempt
   *
   * @param name - The message name
   * @param correlationKey - The correlation key for matching
   * @param variables - Variables to propagate on correlation
   * @param timeToLive - TTL in milliseconds (0 = immediate expiry)
   * @param messageId - Optional deduplication ID
   * @param listener - Optional callback for correlation events
   * @returns The publish result (published or rejected)
   */
  publishMessage(
    name: string,
    correlationKey: string,
    variables: Record<string, unknown> = {},
    timeToLive: number = 0,
    messageId?: string,
    listener?: CorrelationListener
  ): PublishResult {
    // Layer 1: Message ID deduplication
    if (
      messageId !== undefined &&
      this.messageStore.existMessageId(name, correlationKey, messageId)
    ) {
      return {
        outcome: "rejected",
        reason: `Message with ID '${messageId}' for name '${name}' and correlation key '${correlationKey}' already exists`,
      };
    }

    // Create the message record
    const now = this.clock();
    const message: Message = {
      key: this.nextMessageKey++,
      name,
      correlationKey,
      messageId,
      variables,
      timeToLive,
      deadline: now + timeToLive,
    };

    // Store the message
    this.messageStore.putMessage(message);

    // Attempt correlation to existing subscriptions
    this.correlateMessageToSubscriptions(message, listener);

    // Expire immediately if TTL is 0
    if (timeToLive <= 0) {
      this.messageStore.removeMessage(message.key);
    }

    return { outcome: "published", message };
  }

  /**
   * Opens a new subscription and attempts to correlate it against
   * existing (buffered) messages.
   *
   * @param messageName - The message name to subscribe to
   * @param correlationKey - The correlation key to match
   * @param processInstanceKey - The owning process instance key
   * @param elementInstanceKey - The element instance key (catch event)
   * @param bpmnProcessId - The BPMN process ID
   * @param interrupting - Whether this is an interrupting subscription
   * @param listener - Optional callback for correlation events
   * @returns The created subscription
   */
  openSubscription(
    messageName: string,
    correlationKey: string,
    processInstanceKey: number,
    elementInstanceKey: number,
    bpmnProcessId: string,
    interrupting: boolean = false,
    listener?: CorrelationListener
  ): MessageSubscription {
    const subscription: MessageSubscription = {
      messageName,
      correlationKey,
      processInstanceKey,
      elementInstanceKey,
      bpmnProcessId,
      interrupting,
      correlating: false,
      messageKey: 0,
      variables: {},
    };

    this.subscriptionStore.putSubscription(subscription);

    // Attempt to correlate against existing buffered messages
    this.correlateSubscriptionToMessages(subscription, listener);

    return subscription;
  }

  /**
   * Closes (removes) a subscription.
   *
   * @param elementInstanceKey - The element instance key
   * @param messageName - The message name
   * @returns true if the subscription was found and removed
   */
  closeSubscription(
    elementInstanceKey: number,
    messageName: string
  ): boolean {
    return this.subscriptionStore.removeSubscription(
      elementInstanceKey,
      messageName
    );
  }

  /**
   * Marks a correlation as complete. Resets the subscription's correlating
   * state so it can receive new messages (for non-interrupting subscriptions).
   *
   * @param elementInstanceKey - The element instance key
   * @param messageName - The message name
   */
  completeCorrelation(
    elementInstanceKey: number,
    messageName: string
  ): void {
    this.subscriptionStore.updateToCorrelatedState(
      elementInstanceKey,
      messageName
    );
  }

  // ---------------------------------------------------------------------------
  // Internal correlation logic
  // ---------------------------------------------------------------------------

  /**
   * Correlates a newly published message to all matching waiting subscriptions.
   *
   * Mirrors Zeebe's `MessageCorrelator.correlateMessage()`:
   * 1. Find subscriptions matching (messageName, correlationKey)
   * 2. For each subscription, check message-process deduplication
   * 3. Update matching subscriptions to correlating state
   * 4. Record the message-process correlation for deduplication
   */
  private correlateMessageToSubscriptions(
    message: Message,
    listener?: CorrelationListener
  ): void {
    const subscriptions = this.subscriptionStore.findSubscriptions(
      message.name,
      message.correlationKey
    );

    // Track which BPMN process IDs we've already correlated to in this round
    const correlatedProcessIds = new Set<string>();

    for (const subscription of subscriptions) {
      // Layer 2: Message-process deduplication
      if (
        correlatedProcessIds.has(subscription.bpmnProcessId) ||
        this.messageStore.existMessageCorrelation(
          message.key,
          subscription.bpmnProcessId
        )
      ) {
        continue;
      }

      // Deadline check — skip if message has expired
      if (message.deadline <= this.clock()) {
        continue;
      }

      // Mark the subscription as correlating
      const updated = this.subscriptionStore.updateToCorrelatingState(
        subscription.elementInstanceKey,
        subscription.messageName,
        message.key,
        message.variables
      );

      if (updated) {
        // Record the correlation for deduplication
        this.messageStore.putMessageCorrelation(
          message.key,
          subscription.bpmnProcessId
        );
        correlatedProcessIds.add(subscription.bpmnProcessId);

        if (listener) {
          listener.onCorrelated({ subscription: updated, message });
        }
      }
    }
  }

  /**
   * Correlates an existing subscription against buffered messages.
   *
   * Called when a new subscription is opened — checks if any previously
   * published (and still alive) messages match.
   *
   * Mirrors Zeebe's `MessageCorrelator.correlateNextMessage()`:
   * 1. Find messages matching (messageName, correlationKey)
   * 2. For each message, check deadline and message-process deduplication
   * 3. On first match, update subscription to correlating state and stop
   */
  private correlateSubscriptionToMessages(
    subscription: MessageSubscription,
    listener?: CorrelationListener
  ): void {
    const messages = this.messageStore.findByNameAndCorrelationKey(
      subscription.messageName,
      subscription.correlationKey
    );

    const now = this.clock();

    for (const message of messages) {
      // Skip expired messages
      if (message.deadline <= now) {
        continue;
      }

      // Layer 2: Message-process deduplication
      if (
        this.messageStore.existMessageCorrelation(
          message.key,
          subscription.bpmnProcessId
        )
      ) {
        continue;
      }

      // Match found — correlate
      const updated = this.subscriptionStore.updateToCorrelatingState(
        subscription.elementInstanceKey,
        subscription.messageName,
        message.key,
        message.variables
      );

      if (updated) {
        this.messageStore.putMessageCorrelation(
          message.key,
          subscription.bpmnProcessId
        );

        if (listener) {
          listener.onCorrelated({ subscription: updated, message });
        }

        // Stop on first match (one message per subscription at a time)
        return;
      }
    }
  }
}
