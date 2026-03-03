/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  MessageIntent,
  isMessageCommand,
  isMessageEvent,
} from "../message/MessageIntent.js";
import {
  MessageSubscriptionIntent,
  isSubscriptionCommand,
  isSubscriptionEvent,
} from "../message/MessageSubscriptionIntent.js";
import { MessageStore } from "../message/MessageStore.js";
import { MessageSubscriptionStore } from "../message/MessageSubscriptionStore.js";
import {
  MessageCorrelationBehavior,
  type CorrelationResult,
  type CorrelationListener,
} from "../message/MessageCorrelationBehavior.js";
import type { Message } from "../message/Message.js";
import type { MessageSubscription } from "../message/MessageSubscription.js";

// =============================================================================
// MessageIntent
// =============================================================================

describe("MessageIntent", () => {
  it("should define all expected intents", () => {
    expect(MessageIntent.PUBLISH).toBe("PUBLISH");
    expect(MessageIntent.PUBLISHED).toBe("PUBLISHED");
    expect(MessageIntent.EXPIRE).toBe("EXPIRE");
    expect(MessageIntent.EXPIRED).toBe("EXPIRED");
  });

  it("should classify commands correctly", () => {
    expect(isMessageCommand(MessageIntent.PUBLISH)).toBe(true);
    expect(isMessageCommand(MessageIntent.EXPIRE)).toBe(true);
    expect(isMessageCommand(MessageIntent.PUBLISHED)).toBe(false);
    expect(isMessageCommand(MessageIntent.EXPIRED)).toBe(false);
  });

  it("should classify events correctly", () => {
    expect(isMessageEvent(MessageIntent.PUBLISHED)).toBe(true);
    expect(isMessageEvent(MessageIntent.EXPIRED)).toBe(true);
    expect(isMessageEvent(MessageIntent.PUBLISH)).toBe(false);
    expect(isMessageEvent(MessageIntent.EXPIRE)).toBe(false);
  });

  it("should have no overlap between commands and events", () => {
    for (const intent of Object.values(MessageIntent)) {
      const isCmd = isMessageCommand(intent);
      const isEvt = isMessageEvent(intent);
      expect(isCmd && isEvt).toBe(false);
      expect(isCmd || isEvt).toBe(true);
    }
  });
});

// =============================================================================
// MessageSubscriptionIntent
// =============================================================================

describe("MessageSubscriptionIntent", () => {
  it("should define all expected intents", () => {
    expect(MessageSubscriptionIntent.CREATE).toBe("CREATE");
    expect(MessageSubscriptionIntent.CREATED).toBe("CREATED");
    expect(MessageSubscriptionIntent.CORRELATING).toBe("CORRELATING");
    expect(MessageSubscriptionIntent.CORRELATE).toBe("CORRELATE");
    expect(MessageSubscriptionIntent.CORRELATED).toBe("CORRELATED");
    expect(MessageSubscriptionIntent.REJECT).toBe("REJECT");
    expect(MessageSubscriptionIntent.REJECTED).toBe("REJECTED");
    expect(MessageSubscriptionIntent.DELETE).toBe("DELETE");
    expect(MessageSubscriptionIntent.DELETED).toBe("DELETED");
  });

  it("should classify commands correctly", () => {
    expect(isSubscriptionCommand(MessageSubscriptionIntent.CREATE)).toBe(true);
    expect(isSubscriptionCommand(MessageSubscriptionIntent.CORRELATE)).toBe(
      true
    );
    expect(isSubscriptionCommand(MessageSubscriptionIntent.REJECT)).toBe(true);
    expect(isSubscriptionCommand(MessageSubscriptionIntent.DELETE)).toBe(true);
    expect(isSubscriptionCommand(MessageSubscriptionIntent.CREATED)).toBe(
      false
    );
  });

  it("should classify events correctly", () => {
    expect(isSubscriptionEvent(MessageSubscriptionIntent.CREATED)).toBe(true);
    expect(isSubscriptionEvent(MessageSubscriptionIntent.CORRELATING)).toBe(
      true
    );
    expect(isSubscriptionEvent(MessageSubscriptionIntent.CORRELATED)).toBe(
      true
    );
    expect(isSubscriptionEvent(MessageSubscriptionIntent.REJECTED)).toBe(true);
    expect(isSubscriptionEvent(MessageSubscriptionIntent.DELETED)).toBe(true);
    expect(isSubscriptionEvent(MessageSubscriptionIntent.CREATE)).toBe(false);
  });

  it("should have no overlap between commands and events", () => {
    for (const intent of Object.values(MessageSubscriptionIntent)) {
      const isCmd = isSubscriptionCommand(intent);
      const isEvt = isSubscriptionEvent(intent);
      expect(isCmd && isEvt).toBe(false);
      expect(isCmd || isEvt).toBe(true);
    }
  });
});

// =============================================================================
// MessageStore
// =============================================================================

describe("MessageStore", () => {
  let store: MessageStore;

  const createMessage = (
    key: number,
    overrides: Partial<Message> = {}
  ): Message => ({
    key,
    name: "order-placed",
    correlationKey: "order-123",
    messageId: undefined,
    variables: {},
    timeToLive: 60000,
    deadline: Date.now() + 60000,
    ...overrides,
  });

  beforeEach(() => {
    store = new MessageStore();
  });

  describe("putMessage and getMessage", () => {
    it("should store and retrieve a message by key", () => {
      const msg = createMessage(1);
      store.putMessage(msg);
      expect(store.getMessage(1)).toBe(msg);
    });

    it("should return undefined for unknown key", () => {
      expect(store.getMessage(999)).toBeUndefined();
    });

    it("should track message count", () => {
      expect(store.size).toBe(0);
      store.putMessage(createMessage(1));
      expect(store.size).toBe(1);
      store.putMessage(createMessage(2));
      expect(store.size).toBe(2);
    });
  });

  describe("findByNameAndCorrelationKey", () => {
    it("should find messages by name and correlation key", () => {
      const msg1 = createMessage(1);
      const msg2 = createMessage(2);
      store.putMessage(msg1);
      store.putMessage(msg2);

      const found = store.findByNameAndCorrelationKey(
        "order-placed",
        "order-123"
      );
      expect(found).toHaveLength(2);
      expect(found[0]).toBe(msg1);
      expect(found[1]).toBe(msg2);
    });

    it("should return empty array when no messages match", () => {
      store.putMessage(createMessage(1));
      const found = store.findByNameAndCorrelationKey(
        "unknown",
        "order-123"
      );
      expect(found).toHaveLength(0);
    });

    it("should not return messages with different correlation key", () => {
      store.putMessage(createMessage(1, { correlationKey: "order-456" }));
      const found = store.findByNameAndCorrelationKey(
        "order-placed",
        "order-123"
      );
      expect(found).toHaveLength(0);
    });
  });

  describe("removeMessage", () => {
    it("should remove a message and clean up indexes", () => {
      const msg = createMessage(1);
      store.putMessage(msg);
      store.removeMessage(1);

      expect(store.getMessage(1)).toBeUndefined();
      expect(store.size).toBe(0);
      expect(
        store.findByNameAndCorrelationKey("order-placed", "order-123")
      ).toHaveLength(0);
    });

    it("should not throw when removing non-existent message", () => {
      expect(() => store.removeMessage(999)).not.toThrow();
    });

    it("should clean up message ID dedup entry on removal", () => {
      const msg = createMessage(1, { messageId: "dedup-1" });
      store.putMessage(msg);
      expect(
        store.existMessageId("order-placed", "order-123", "dedup-1")
      ).toBe(true);

      store.removeMessage(1);
      expect(
        store.existMessageId("order-placed", "order-123", "dedup-1")
      ).toBe(false);
    });
  });

  describe("message ID deduplication (layer 1)", () => {
    it("should detect duplicate message IDs", () => {
      store.putMessage(createMessage(1, { messageId: "unique-1" }));
      expect(
        store.existMessageId("order-placed", "order-123", "unique-1")
      ).toBe(true);
    });

    it("should not detect non-existent message IDs", () => {
      expect(
        store.existMessageId("order-placed", "order-123", "unique-1")
      ).toBe(false);
    });

    it("should not match different name", () => {
      store.putMessage(createMessage(1, { messageId: "unique-1" }));
      expect(
        store.existMessageId("different-name", "order-123", "unique-1")
      ).toBe(false);
    });

    it("should not match different correlation key", () => {
      store.putMessage(createMessage(1, { messageId: "unique-1" }));
      expect(
        store.existMessageId("order-placed", "different-key", "unique-1")
      ).toBe(false);
    });

    it("should not index messages without messageId", () => {
      store.putMessage(createMessage(1, { messageId: undefined }));
      // No messageId entry should exist
      expect(store.existMessageId("order-placed", "order-123", "")).toBe(
        false
      );
    });
  });

  describe("message-process correlation deduplication (layer 2)", () => {
    it("should track message-process correlations", () => {
      store.putMessageCorrelation(1, "order-process");
      expect(store.existMessageCorrelation(1, "order-process")).toBe(true);
    });

    it("should not cross-match different message keys", () => {
      store.putMessageCorrelation(1, "order-process");
      expect(store.existMessageCorrelation(2, "order-process")).toBe(false);
    });

    it("should not cross-match different process IDs", () => {
      store.putMessageCorrelation(1, "order-process");
      expect(store.existMessageCorrelation(1, "payment-process")).toBe(false);
    });

    it("should allow removing message-process correlations", () => {
      store.putMessageCorrelation(1, "order-process");
      store.removeMessageCorrelation(1, "order-process");
      expect(store.existMessageCorrelation(1, "order-process")).toBe(false);
    });
  });

  describe("active process instance deduplication (layer 3)", () => {
    it("should track active process instances", () => {
      store.putActiveProcessInstance("order-process", "order-123");
      expect(
        store.existActiveProcessInstance("order-process", "order-123")
      ).toBe(true);
    });

    it("should not cross-match different process IDs", () => {
      store.putActiveProcessInstance("order-process", "order-123");
      expect(
        store.existActiveProcessInstance("payment-process", "order-123")
      ).toBe(false);
    });

    it("should not cross-match different correlation keys", () => {
      store.putActiveProcessInstance("order-process", "order-123");
      expect(
        store.existActiveProcessInstance("order-process", "order-456")
      ).toBe(false);
    });

    it("should allow removing active process instances", () => {
      store.putActiveProcessInstance("order-process", "order-123");
      store.removeActiveProcessInstance("order-process", "order-123");
      expect(
        store.existActiveProcessInstance("order-process", "order-123")
      ).toBe(false);
    });
  });
});

// =============================================================================
// MessageSubscriptionStore
// =============================================================================

describe("MessageSubscriptionStore", () => {
  let store: MessageSubscriptionStore;

  const createSubscription = (
    overrides: Partial<MessageSubscription> = {}
  ): MessageSubscription => ({
    messageName: "order-placed",
    correlationKey: "order-123",
    processInstanceKey: 100,
    elementInstanceKey: 200,
    bpmnProcessId: "order-process",
    interrupting: false,
    correlating: false,
    messageKey: 0,
    variables: {},
    ...overrides,
  });

  beforeEach(() => {
    store = new MessageSubscriptionStore();
  });

  describe("putSubscription and getSubscription", () => {
    it("should store and retrieve a subscription", () => {
      const sub = createSubscription();
      store.putSubscription(sub);

      const found = store.getSubscription(200, "order-placed");
      expect(found).toEqual(sub);
    });

    it("should return undefined for unknown subscription", () => {
      expect(store.getSubscription(999, "order-placed")).toBeUndefined();
    });

    it("should track subscription count", () => {
      expect(store.size).toBe(0);
      store.putSubscription(createSubscription());
      expect(store.size).toBe(1);
    });

    it("should overwrite existing subscription with same key", () => {
      store.putSubscription(createSubscription({ interrupting: false }));
      store.putSubscription(createSubscription({ interrupting: true }));
      expect(store.size).toBe(1);

      const found = store.getSubscription(200, "order-placed");
      expect(found?.interrupting).toBe(true);
    });
  });

  describe("existSubscription", () => {
    it("should return true for existing subscription", () => {
      store.putSubscription(createSubscription());
      expect(store.existSubscription(200, "order-placed")).toBe(true);
    });

    it("should return false for non-existent subscription", () => {
      expect(store.existSubscription(200, "order-placed")).toBe(false);
    });
  });

  describe("findSubscriptions", () => {
    it("should find subscriptions by name and correlation key", () => {
      store.putSubscription(createSubscription({ elementInstanceKey: 200 }));
      store.putSubscription(createSubscription({ elementInstanceKey: 300 }));

      const found = store.findSubscriptions("order-placed", "order-123");
      expect(found).toHaveLength(2);
    });

    it("should exclude correlating subscriptions", () => {
      store.putSubscription(
        createSubscription({ elementInstanceKey: 200, correlating: false })
      );
      store.putSubscription(
        createSubscription({ elementInstanceKey: 300, correlating: true })
      );

      const found = store.findSubscriptions("order-placed", "order-123");
      expect(found).toHaveLength(1);
      expect(found[0].elementInstanceKey).toBe(200);
    });

    it("should return empty array when no subscriptions match", () => {
      store.putSubscription(createSubscription());
      const found = store.findSubscriptions("unknown", "order-123");
      expect(found).toHaveLength(0);
    });
  });

  describe("updateToCorrelatingState", () => {
    it("should mark subscription as correlating", () => {
      store.putSubscription(createSubscription());

      const updated = store.updateToCorrelatingState(
        200,
        "order-placed",
        42,
        { orderId: "123" }
      );

      expect(updated).toBeDefined();
      expect(updated!.correlating).toBe(true);
      expect(updated!.messageKey).toBe(42);
      expect(updated!.variables).toEqual({ orderId: "123" });

      // Verify state is persisted
      const found = store.getSubscription(200, "order-placed");
      expect(found!.correlating).toBe(true);
    });

    it("should return undefined for non-existent subscription", () => {
      const result = store.updateToCorrelatingState(
        999,
        "unknown",
        42,
        {}
      );
      expect(result).toBeUndefined();
    });
  });

  describe("updateToCorrelatedState", () => {
    it("should reset subscription from correlating to open state", () => {
      store.putSubscription(
        createSubscription({ correlating: true, messageKey: 42 })
      );

      const updated = store.updateToCorrelatedState(200, "order-placed");

      expect(updated).toBeDefined();
      expect(updated!.correlating).toBe(false);
      expect(updated!.messageKey).toBe(0);
      expect(updated!.variables).toEqual({});
    });

    it("should return undefined for non-existent subscription", () => {
      const result = store.updateToCorrelatedState(999, "unknown");
      expect(result).toBeUndefined();
    });
  });

  describe("removeSubscription", () => {
    it("should remove a subscription", () => {
      store.putSubscription(createSubscription());
      const removed = store.removeSubscription(200, "order-placed");

      expect(removed).toBe(true);
      expect(store.size).toBe(0);
      expect(store.getSubscription(200, "order-placed")).toBeUndefined();
    });

    it("should return false for non-existent subscription", () => {
      expect(store.removeSubscription(999, "unknown")).toBe(false);
    });

    it("should clean up name+correlation key index on removal", () => {
      store.putSubscription(createSubscription());
      store.removeSubscription(200, "order-placed");

      const found = store.findSubscriptions("order-placed", "order-123");
      expect(found).toHaveLength(0);
    });
  });
});

// =============================================================================
// MessageCorrelationBehavior
// =============================================================================

describe("MessageCorrelationBehavior", () => {
  let messageStore: MessageStore;
  let subscriptionStore: MessageSubscriptionStore;
  let behavior: MessageCorrelationBehavior;
  let currentTime: number;

  beforeEach(() => {
    messageStore = new MessageStore();
    subscriptionStore = new MessageSubscriptionStore();
    currentTime = 1000;
    behavior = new MessageCorrelationBehavior(
      messageStore,
      subscriptionStore,
      () => currentTime
    );
  });

  // Helper to collect correlation results
  function createCollectingListener(): {
    results: CorrelationResult[];
    listener: CorrelationListener;
  } {
    const results: CorrelationResult[] = [];
    return {
      results,
      listener: {
        onCorrelated(result: CorrelationResult) {
          results.push(result);
        },
      },
    };
  }

  describe("publishMessage", () => {
    it("should publish a message and assign a key", () => {
      const result = behavior.publishMessage(
        "order-placed",
        "order-123",
        { amount: 99 },
        60000
      );

      expect(result.outcome).toBe("published");
      if (result.outcome === "published") {
        expect(result.message.key).toBe(1);
        expect(result.message.name).toBe("order-placed");
        expect(result.message.correlationKey).toBe("order-123");
        expect(result.message.variables).toEqual({ amount: 99 });
        expect(result.message.timeToLive).toBe(60000);
        expect(result.message.deadline).toBe(1000 + 60000);
      }
    });

    it("should assign sequential keys to messages", () => {
      const r1 = behavior.publishMessage("msg-1", "key-1");
      const r2 = behavior.publishMessage("msg-2", "key-2");

      expect(r1.outcome).toBe("published");
      expect(r2.outcome).toBe("published");
      if (r1.outcome === "published" && r2.outcome === "published") {
        expect(r1.message.key).toBe(1);
        expect(r2.message.key).toBe(2);
      }
    });

    it("should store the message for future correlation", () => {
      behavior.publishMessage("order-placed", "order-123", {}, 60000);
      expect(messageStore.size).toBe(1);
    });

    it("should expire message immediately when TTL is 0", () => {
      behavior.publishMessage("order-placed", "order-123", {}, 0);
      expect(messageStore.size).toBe(0);
    });

    it("should expire message immediately when TTL is negative", () => {
      behavior.publishMessage("order-placed", "order-123", {}, -1);
      expect(messageStore.size).toBe(0);
    });
  });

  describe("message ID deduplication (layer 1)", () => {
    it("should reject duplicate message with same ID", () => {
      const r1 = behavior.publishMessage(
        "order-placed",
        "order-123",
        {},
        60000,
        "msg-id-1"
      );
      const r2 = behavior.publishMessage(
        "order-placed",
        "order-123",
        {},
        60000,
        "msg-id-1"
      );

      expect(r1.outcome).toBe("published");
      expect(r2.outcome).toBe("rejected");
      if (r2.outcome === "rejected") {
        expect(r2.reason).toContain("msg-id-1");
        expect(r2.reason).toContain("already exists");
      }
    });

    it("should allow same message ID with different name", () => {
      const r1 = behavior.publishMessage(
        "order-placed",
        "order-123",
        {},
        60000,
        "msg-id-1"
      );
      const r2 = behavior.publishMessage(
        "order-shipped",
        "order-123",
        {},
        60000,
        "msg-id-1"
      );

      expect(r1.outcome).toBe("published");
      expect(r2.outcome).toBe("published");
    });

    it("should allow same message ID with different correlation key", () => {
      const r1 = behavior.publishMessage(
        "order-placed",
        "order-123",
        {},
        60000,
        "msg-id-1"
      );
      const r2 = behavior.publishMessage(
        "order-placed",
        "order-456",
        {},
        60000,
        "msg-id-1"
      );

      expect(r1.outcome).toBe("published");
      expect(r2.outcome).toBe("published");
    });

    it("should allow messages without messageId (no deduplication)", () => {
      const r1 = behavior.publishMessage("order-placed", "order-123");
      const r2 = behavior.publishMessage("order-placed", "order-123");

      expect(r1.outcome).toBe("published");
      expect(r2.outcome).toBe("published");
    });
  });

  describe("publish → correlate to existing subscriptions", () => {
    it("should correlate a published message to a waiting subscription", () => {
      // given: a waiting subscription
      behavior.openSubscription(
        "order-placed",
        "order-123",
        100,
        200,
        "order-process"
      );

      // when: a matching message is published
      const { results, listener } = createCollectingListener();
      behavior.publishMessage(
        "order-placed",
        "order-123",
        { amount: 99 },
        60000,
        undefined,
        listener
      );

      // then: correlation occurred
      expect(results).toHaveLength(1);
      expect(results[0].subscription.elementInstanceKey).toBe(200);
      expect(results[0].subscription.correlating).toBe(true);
      expect(results[0].subscription.variables).toEqual({ amount: 99 });
      expect(results[0].message.name).toBe("order-placed");
    });

    it("should not correlate when message name does not match", () => {
      behavior.openSubscription(
        "order-placed",
        "order-123",
        100,
        200,
        "order-process"
      );

      const { results, listener } = createCollectingListener();
      behavior.publishMessage(
        "order-shipped",
        "order-123",
        {},
        60000,
        undefined,
        listener
      );

      expect(results).toHaveLength(0);
    });

    it("should not correlate when correlation key does not match", () => {
      behavior.openSubscription(
        "order-placed",
        "order-123",
        100,
        200,
        "order-process"
      );

      const { results, listener } = createCollectingListener();
      behavior.publishMessage(
        "order-placed",
        "order-456",
        {},
        60000,
        undefined,
        listener
      );

      expect(results).toHaveLength(0);
    });

    it("should correlate to multiple subscriptions with different process IDs", () => {
      behavior.openSubscription(
        "order-placed",
        "order-123",
        100,
        200,
        "order-process"
      );
      behavior.openSubscription(
        "order-placed",
        "order-123",
        101,
        300,
        "payment-process"
      );

      const { results, listener } = createCollectingListener();
      behavior.publishMessage(
        "order-placed",
        "order-123",
        {},
        60000,
        undefined,
        listener
      );

      expect(results).toHaveLength(2);
    });

    it("should not correlate to already correlating subscriptions", () => {
      // given: a subscription already in correlating state
      subscriptionStore.putSubscription({
        messageName: "order-placed",
        correlationKey: "order-123",
        processInstanceKey: 100,
        elementInstanceKey: 200,
        bpmnProcessId: "order-process",
        interrupting: false,
        correlating: true,
        messageKey: 50,
        variables: {},
      });

      // when: another message is published
      const { results, listener } = createCollectingListener();
      behavior.publishMessage(
        "order-placed",
        "order-123",
        {},
        60000,
        undefined,
        listener
      );

      // then: no new correlation (subscription is busy)
      expect(results).toHaveLength(0);
    });
  });

  describe("message-process deduplication (layer 2)", () => {
    it("should not correlate same message to same process twice", () => {
      // given: two subscriptions from the same process
      behavior.openSubscription(
        "order-placed",
        "order-123",
        100,
        200,
        "order-process"
      );
      behavior.openSubscription(
        "order-placed",
        "order-123",
        101,
        300,
        "order-process"
      );

      // when: a message is published
      const { results, listener } = createCollectingListener();
      behavior.publishMessage(
        "order-placed",
        "order-123",
        {},
        60000,
        undefined,
        listener
      );

      // then: only one correlation (same bpmnProcessId)
      expect(results).toHaveLength(1);
    });

    it("should allow same message to correlate to different processes", () => {
      behavior.openSubscription(
        "order-placed",
        "order-123",
        100,
        200,
        "process-A"
      );
      behavior.openSubscription(
        "order-placed",
        "order-123",
        101,
        300,
        "process-B"
      );

      const { results, listener } = createCollectingListener();
      behavior.publishMessage(
        "order-placed",
        "order-123",
        {},
        60000,
        undefined,
        listener
      );

      expect(results).toHaveLength(2);
    });

    it("should prevent re-correlation after first correlation is recorded", () => {
      // given: first subscription correlated
      behavior.openSubscription(
        "order-placed",
        "order-123",
        100,
        200,
        "order-process"
      );
      behavior.publishMessage("order-placed", "order-123", {}, 60000);

      // complete first correlation
      behavior.completeCorrelation(200, "order-placed");

      // open a new subscription from same process
      behavior.openSubscription(
        "order-placed",
        "order-123",
        102,
        400,
        "order-process"
      );

      // then: new subscription should NOT correlate to the same buffered message
      const sub = subscriptionStore.getSubscription(400, "order-placed");
      expect(sub?.correlating).toBe(false);
    });
  });

  describe("subscription → correlate to existing messages", () => {
    it("should correlate a new subscription to a buffered message", () => {
      // given: a buffered message
      behavior.publishMessage("order-placed", "order-123", { x: 1 }, 60000);

      // when: a matching subscription opens
      const { results, listener } = createCollectingListener();
      behavior.openSubscription(
        "order-placed",
        "order-123",
        100,
        200,
        "order-process",
        false,
        listener
      );

      // then: correlation occurred
      expect(results).toHaveLength(1);
      expect(results[0].subscription.correlating).toBe(true);
      expect(results[0].subscription.variables).toEqual({ x: 1 });
    });

    it("should not correlate to expired messages", () => {
      // given: a message published with deadline in the past
      behavior.publishMessage("order-placed", "order-123", {}, 60000);

      // advance time past the deadline
      currentTime = 1000 + 60001;

      // when: subscription opens after message expired
      const { results, listener } = createCollectingListener();
      behavior.openSubscription(
        "order-placed",
        "order-123",
        100,
        200,
        "order-process",
        false,
        listener
      );

      // then: no correlation
      expect(results).toHaveLength(0);
    });

    it("should correlate only the first matching message", () => {
      // given: two buffered messages
      behavior.publishMessage("order-placed", "order-123", { n: 1 }, 60000);
      behavior.publishMessage("order-placed", "order-123", { n: 2 }, 60000);

      // when: subscription opens
      const { results, listener } = createCollectingListener();
      behavior.openSubscription(
        "order-placed",
        "order-123",
        100,
        200,
        "order-process",
        false,
        listener
      );

      // then: only one correlation (first message)
      expect(results).toHaveLength(1);
      expect(results[0].message.variables).toEqual({ n: 1 });
    });

    it("should skip messages already correlated to the same process", () => {
      // given: first subscription correlated to first message
      behavior.openSubscription(
        "order-placed",
        "order-123",
        100,
        200,
        "order-process"
      );
      behavior.publishMessage("order-placed", "order-123", { n: 1 }, 60000);
      behavior.publishMessage("order-placed", "order-123", { n: 2 }, 60000);

      // complete first correlation
      behavior.completeCorrelation(200, "order-placed");

      // open new subscription from same process
      const { results, listener } = createCollectingListener();
      behavior.openSubscription(
        "order-placed",
        "order-123",
        101,
        300,
        "order-process",
        false,
        listener
      );

      // then: should correlate to second message (first was already used)
      expect(results).toHaveLength(1);
      expect(results[0].message.variables).toEqual({ n: 2 });
    });
  });

  describe("TTL and deadline handling", () => {
    it("should compute deadline as publishTime + TTL", () => {
      currentTime = 5000;
      const result = behavior.publishMessage(
        "order-placed",
        "order-123",
        {},
        30000
      );

      if (result.outcome === "published") {
        expect(result.message.deadline).toBe(35000);
      }
    });

    it("should not correlate an expired message to a new subscription", () => {
      currentTime = 1000;
      behavior.publishMessage("order-placed", "order-123", {}, 5000);

      // Time advances past deadline (1000 + 5000 = 6000)
      currentTime = 6001;

      const { results, listener } = createCollectingListener();
      behavior.openSubscription(
        "order-placed",
        "order-123",
        100,
        200,
        "order-process",
        false,
        listener
      );

      expect(results).toHaveLength(0);
    });

    it("should correlate a message right at its deadline boundary", () => {
      currentTime = 1000;
      behavior.publishMessage("order-placed", "order-123", {}, 5000);

      // Time is exactly at the deadline (1000 + 5000 = 6000)
      // deadline <= now → expired
      currentTime = 6000;

      const { results, listener } = createCollectingListener();
      behavior.openSubscription(
        "order-placed",
        "order-123",
        100,
        200,
        "order-process",
        false,
        listener
      );

      // At exact deadline, message is expired (deadline <= now)
      expect(results).toHaveLength(0);
    });

    it("should correlate a message just before its deadline", () => {
      currentTime = 1000;
      behavior.publishMessage("order-placed", "order-123", {}, 5000);

      // Time is 1ms before deadline
      currentTime = 5999;

      const { results, listener } = createCollectingListener();
      behavior.openSubscription(
        "order-placed",
        "order-123",
        100,
        200,
        "order-process",
        false,
        listener
      );

      expect(results).toHaveLength(1);
    });

    it("should remove message from store when TTL is 0", () => {
      behavior.publishMessage("order-placed", "order-123", {}, 0);
      expect(messageStore.size).toBe(0);
    });
  });

  describe("closeSubscription", () => {
    it("should remove a subscription", () => {
      behavior.openSubscription(
        "order-placed",
        "order-123",
        100,
        200,
        "order-process"
      );

      const removed = behavior.closeSubscription(200, "order-placed");
      expect(removed).toBe(true);
      expect(subscriptionStore.size).toBe(0);
    });

    it("should return false for non-existent subscription", () => {
      expect(behavior.closeSubscription(999, "unknown")).toBe(false);
    });
  });

  describe("completeCorrelation", () => {
    it("should reset subscription to open state after correlation completes", () => {
      behavior.openSubscription(
        "order-placed",
        "order-123",
        100,
        200,
        "order-process"
      );
      behavior.publishMessage("order-placed", "order-123", {}, 60000);

      // Subscription should be correlating
      let sub = subscriptionStore.getSubscription(200, "order-placed");
      expect(sub?.correlating).toBe(true);

      // Complete the correlation
      behavior.completeCorrelation(200, "order-placed");

      // Subscription should be open again
      sub = subscriptionStore.getSubscription(200, "order-placed");
      expect(sub?.correlating).toBe(false);
      expect(sub?.messageKey).toBe(0);
      expect(sub?.variables).toEqual({});
    });
  });

  describe("active process instance deduplication (layer 3)", () => {
    it("should track active process instances via the store", () => {
      messageStore.putActiveProcessInstance("order-process", "order-123");

      expect(
        messageStore.existActiveProcessInstance("order-process", "order-123")
      ).toBe(true);
    });

    it("should allow cleanup of active process instances", () => {
      messageStore.putActiveProcessInstance("order-process", "order-123");
      messageStore.removeActiveProcessInstance("order-process", "order-123");

      expect(
        messageStore.existActiveProcessInstance("order-process", "order-123")
      ).toBe(false);
    });
  });

  describe("end-to-end scenarios", () => {
    it("should handle publish-then-subscribe flow", () => {
      const { results, listener } = createCollectingListener();

      // Publish a message first
      behavior.publishMessage(
        "payment-received",
        "order-42",
        { amount: 100 },
        60000
      );

      // Then open a subscription
      behavior.openSubscription(
        "payment-received",
        "order-42",
        100,
        200,
        "order-process",
        false,
        listener
      );

      expect(results).toHaveLength(1);
      expect(results[0].subscription.variables).toEqual({ amount: 100 });
    });

    it("should handle subscribe-then-publish flow", () => {
      const { results, listener } = createCollectingListener();

      // Open subscription first
      behavior.openSubscription(
        "payment-received",
        "order-42",
        100,
        200,
        "order-process"
      );

      // Then publish
      behavior.publishMessage(
        "payment-received",
        "order-42",
        { amount: 200 },
        60000,
        undefined,
        listener
      );

      expect(results).toHaveLength(1);
      expect(results[0].subscription.variables).toEqual({ amount: 200 });
    });

    it("should handle multiple correlation cycles on same subscription", () => {
      const allResults: CorrelationResult[] = [];
      const listener: CorrelationListener = {
        onCorrelated(r) {
          allResults.push(r);
        },
      };

      // Open a non-interrupting subscription
      behavior.openSubscription(
        "order-update",
        "order-1",
        100,
        200,
        "order-process"
      );

      // First message correlates
      behavior.publishMessage(
        "order-update",
        "order-1",
        { status: "pending" },
        60000,
        "upd-1",
        listener
      );
      expect(allResults).toHaveLength(1);

      // Complete the first correlation
      behavior.completeCorrelation(200, "order-update");

      // Second message correlates
      behavior.publishMessage(
        "order-update",
        "order-1",
        { status: "shipped" },
        60000,
        "upd-2",
        listener
      );
      expect(allResults).toHaveLength(2);
      expect(allResults[1].subscription.variables).toEqual({
        status: "shipped",
      });
    });

    it("should handle complex multi-process scenario", () => {
      // Two different processes waiting for same message name
      behavior.openSubscription(
        "payment",
        "order-1",
        100,
        200,
        "order-process"
      );
      behavior.openSubscription(
        "payment",
        "order-1",
        101,
        300,
        "shipping-process"
      );

      const { results, listener } = createCollectingListener();
      behavior.publishMessage(
        "payment",
        "order-1",
        { paid: true },
        60000,
        undefined,
        listener
      );

      // Both processes should be correlated
      expect(results).toHaveLength(2);

      // Verify both subscriptions are in correlating state
      const sub1 = subscriptionStore.getSubscription(200, "payment");
      const sub2 = subscriptionStore.getSubscription(300, "payment");
      expect(sub1?.correlating).toBe(true);
      expect(sub2?.correlating).toBe(true);
    });
  });
});
