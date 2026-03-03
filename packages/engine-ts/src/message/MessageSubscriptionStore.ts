/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import type { MessageSubscription } from "./MessageSubscription.js";
import type { MessageSubscriptionState } from "./MessageSubscriptionState.js";

/**
 * Mutable, in-memory implementation of message subscription state.
 *
 * Replaces Zeebe's `DbMessageSubscriptionState` (backed by RocksDB column families)
 * with plain `Map` instances suitable for a single-threaded browser environment.
 *
 * Storage layout (mirrors Zeebe's column families):
 * - `subscriptions`:           "elemKey|msgName" → subscription  (primary lookup)
 * - `subscriptionsByNameKey`:  "msgName|corrKey" → Set<"elemKey|msgName">  (correlation lookup)
 */
export class MessageSubscriptionStore implements MessageSubscriptionState {
  /** "elementInstanceKey|messageName" → MessageSubscription */
  private readonly subscriptions = new Map<string, MessageSubscription>();

  /** "messageName|correlationKey" → Set<"elementInstanceKey|messageName"> */
  private readonly subscriptionsByNameKey = new Map<string, Set<string>>();

  // ---------------------------------------------------------------------------
  // Read operations (MessageSubscriptionState interface)
  // ---------------------------------------------------------------------------

  getSubscription(
    elementInstanceKey: number,
    messageName: string
  ): MessageSubscription | undefined {
    return this.subscriptions.get(
      this.subscriptionKey(elementInstanceKey, messageName)
    );
  }

  findSubscriptions(
    messageName: string,
    correlationKey: string
  ): ReadonlyArray<MessageSubscription> {
    const indexKey = this.nameCorrelationKey(messageName, correlationKey);
    const keys = this.subscriptionsByNameKey.get(indexKey);
    if (!keys || keys.size === 0) {
      return [];
    }
    const result: MessageSubscription[] = [];
    for (const subKey of keys) {
      const subscription = this.subscriptions.get(subKey);
      if (subscription && !subscription.correlating) {
        result.push(subscription);
      }
    }
    return result;
  }

  existSubscription(
    elementInstanceKey: number,
    messageName: string
  ): boolean {
    return this.subscriptions.has(
      this.subscriptionKey(elementInstanceKey, messageName)
    );
  }

  // ---------------------------------------------------------------------------
  // Write operations
  // ---------------------------------------------------------------------------

  /**
   * Adds a new subscription. If a subscription already exists for the same
   * (elementInstanceKey, messageName), it is overwritten.
   */
  putSubscription(subscription: MessageSubscription): void {
    const subKey = this.subscriptionKey(
      subscription.elementInstanceKey,
      subscription.messageName
    );
    this.subscriptions.set(subKey, subscription);

    // Index by messageName + correlationKey
    const indexKey = this.nameCorrelationKey(
      subscription.messageName,
      subscription.correlationKey
    );
    let keySet = this.subscriptionsByNameKey.get(indexKey);
    if (!keySet) {
      keySet = new Set<string>();
      this.subscriptionsByNameKey.set(indexKey, keySet);
    }
    keySet.add(subKey);
  }

  /**
   * Updates a subscription to the correlating state, marking it with the
   * message key and variables from the correlated message.
   *
   * Returns the updated subscription.
   */
  updateToCorrelatingState(
    elementInstanceKey: number,
    messageName: string,
    messageKey: number,
    variables: Record<string, unknown>
  ): MessageSubscription | undefined {
    const subKey = this.subscriptionKey(elementInstanceKey, messageName);
    const existing = this.subscriptions.get(subKey);
    if (!existing) {
      return undefined;
    }

    const updated: MessageSubscription = {
      ...existing,
      correlating: true,
      messageKey,
      variables,
    };
    this.subscriptions.set(subKey, updated);
    return updated;
  }

  /**
   * Updates a subscription back from the correlating state to the open state.
   * Used when correlation completes or is rejected.
   *
   * Returns the updated subscription.
   */
  updateToCorrelatedState(
    elementInstanceKey: number,
    messageName: string
  ): MessageSubscription | undefined {
    const subKey = this.subscriptionKey(elementInstanceKey, messageName);
    const existing = this.subscriptions.get(subKey);
    if (!existing) {
      return undefined;
    }

    const updated: MessageSubscription = {
      ...existing,
      correlating: false,
      messageKey: 0,
      variables: {},
    };
    this.subscriptions.set(subKey, updated);
    return updated;
  }

  /**
   * Removes a subscription and cleans up indexes.
   */
  removeSubscription(
    elementInstanceKey: number,
    messageName: string
  ): boolean {
    const subKey = this.subscriptionKey(elementInstanceKey, messageName);
    const existing = this.subscriptions.get(subKey);
    if (!existing) {
      return false;
    }

    this.subscriptions.delete(subKey);

    // Clean up the name+correlationKey index
    const indexKey = this.nameCorrelationKey(
      existing.messageName,
      existing.correlationKey
    );
    const keySet = this.subscriptionsByNameKey.get(indexKey);
    if (keySet) {
      keySet.delete(subKey);
      if (keySet.size === 0) {
        this.subscriptionsByNameKey.delete(indexKey);
      }
    }

    return true;
  }

  /**
   * Returns the total number of stored subscriptions.
   */
  get size(): number {
    return this.subscriptions.size;
  }

  // ---------------------------------------------------------------------------
  // Composite key helpers
  // ---------------------------------------------------------------------------

  private subscriptionKey(
    elementInstanceKey: number,
    messageName: string
  ): string {
    return `${elementInstanceKey}\0${messageName}`;
  }

  private nameCorrelationKey(
    messageName: string,
    correlationKey: string
  ): string {
    return `${messageName}\0${correlationKey}`;
  }
}
