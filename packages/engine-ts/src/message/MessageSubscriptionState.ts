/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import type { MessageSubscription } from "./MessageSubscription.js";

/**
 * Read-only access to message subscription state.
 *
 * Mirrors the immutable portion of
 * `io.camunda.zeebe.engine.state.message.MessageSubscriptionState`,
 * adapted for the browser engine with in-memory Maps.
 */
export interface MessageSubscriptionState {
  /**
   * Returns the subscription for the given element instance and message name,
   * or undefined if not found.
   */
  getSubscription(
    elementInstanceKey: number,
    messageName: string
  ): MessageSubscription | undefined;

  /**
   * Returns all subscriptions matching the given message name and correlation key
   * that are not currently correlating.
   */
  findSubscriptions(
    messageName: string,
    correlationKey: string
  ): ReadonlyArray<MessageSubscription>;

  /**
   * Returns true if a subscription exists for the given element instance
   * and message name.
   */
  existSubscription(
    elementInstanceKey: number,
    messageName: string
  ): boolean;
}
