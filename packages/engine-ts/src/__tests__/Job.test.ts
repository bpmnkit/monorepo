/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import { describe, expect, it, beforeEach, vi } from "vitest";
import { JobIntent, isJobCommand, isJobEvent } from "../job/JobIntent.js";
import {
  completeJob,
  failJob,
  throwError,
} from "../job/JobResult.js";
import { DefaultJobClient } from "../job/JobClient.js";
import { JobWorkerRegistry } from "../job/JobWorkerRegistry.js";
import type { ActivatedJob } from "../job/ActivatedJob.js";
import type { JobHandler } from "../job/JobHandler.js";

// --- Helper ---

function createTestJob(overrides: Partial<ActivatedJob> = {}): ActivatedJob {
  return {
    key: 1001,
    type: "test-task",
    retries: 3,
    variables: { orderId: "ORD-123" },
    customHeaders: { priority: "high" },
    elementId: "Task_1",
    elementInstanceKey: 2001,
    processInstanceKey: 3001,
    bpmnProcessId: "order-process",
    processDefinitionKey: 4001,
    ...overrides,
  };
}

// =============================================================================
// JobIntent
// =============================================================================

describe("JobIntent", () => {
  describe("isJobCommand", () => {
    it.each([
      JobIntent.COMPLETE,
      JobIntent.FAIL,
      JobIntent.THROW_ERROR,
      JobIntent.UPDATE_RETRIES,
      JobIntent.YIELD,
      JobIntent.UPDATE,
      JobIntent.RECUR_AFTER_BACKOFF,
      JobIntent.TIME_OUT,
    ])("should classify %s as a command", (intent) => {
      expect(isJobCommand(intent)).toBe(true);
    });

    it.each([
      JobIntent.CREATED,
      JobIntent.COMPLETED,
      JobIntent.FAILED,
      JobIntent.ERROR_THROWN,
      JobIntent.TIMED_OUT,
      JobIntent.CANCELED,
      JobIntent.YIELDED,
      JobIntent.RETRIES_UPDATED,
      JobIntent.RECURRED_AFTER_BACKOFF,
      JobIntent.UPDATED,
      JobIntent.MIGRATED,
    ])("should not classify %s as a command", (intent) => {
      expect(isJobCommand(intent)).toBe(false);
    });
  });

  describe("isJobEvent", () => {
    it.each([
      JobIntent.CREATED,
      JobIntent.COMPLETED,
      JobIntent.FAILED,
      JobIntent.ERROR_THROWN,
      JobIntent.TIMED_OUT,
      JobIntent.CANCELED,
      JobIntent.YIELDED,
      JobIntent.RETRIES_UPDATED,
      JobIntent.RECURRED_AFTER_BACKOFF,
      JobIntent.UPDATED,
      JobIntent.MIGRATED,
    ])("should classify %s as an event", (intent) => {
      expect(isJobEvent(intent)).toBe(true);
    });

    it.each([
      JobIntent.COMPLETE,
      JobIntent.FAIL,
      JobIntent.THROW_ERROR,
      JobIntent.UPDATE_RETRIES,
      JobIntent.YIELD,
      JobIntent.UPDATE,
      JobIntent.RECUR_AFTER_BACKOFF,
      JobIntent.TIME_OUT,
    ])("should not classify %s as an event", (intent) => {
      expect(isJobEvent(intent)).toBe(false);
    });
  });

  it("should have every intent classified as either command or event", () => {
    for (const intent of Object.values(JobIntent)) {
      const classified = isJobCommand(intent) || isJobEvent(intent);
      expect(classified).toBe(true);
    }
  });

  it("should not classify any intent as both command and event", () => {
    for (const intent of Object.values(JobIntent)) {
      if (isJobCommand(intent)) {
        expect(isJobEvent(intent)).toBe(false);
      }
    }
  });
});

// =============================================================================
// JobResult
// =============================================================================

describe("JobResult", () => {
  describe("completeJob", () => {
    it("should create a complete result with variables", () => {
      const result = completeJob(42, { amount: 100 });
      expect(result._tag).toBe("complete");
      expect(result.jobKey).toBe(42);
      expect(result.variables).toEqual({ amount: 100 });
    });

    it("should default to empty variables", () => {
      const result = completeJob(42);
      expect(result.variables).toEqual({});
    });
  });

  describe("failJob", () => {
    it("should create a fail result with all fields", () => {
      const result = failJob(42, 2, "timeout", 5000);
      expect(result._tag).toBe("fail");
      expect(result.jobKey).toBe(42);
      expect(result.retries).toBe(2);
      expect(result.errorMessage).toBe("timeout");
      expect(result.retryBackoff).toBe(5000);
    });

    it("should default retryBackoff to 0", () => {
      const result = failJob(42, 1, "error");
      expect(result.retryBackoff).toBe(0);
    });
  });

  describe("throwError", () => {
    it("should create a throw error result", () => {
      const result = throwError(42, "PAYMENT_FAILED", "Card declined");
      expect(result._tag).toBe("throwError");
      expect(result.jobKey).toBe(42);
      expect(result.errorCode).toBe("PAYMENT_FAILED");
      expect(result.errorMessage).toBe("Card declined");
    });

    it("should default errorMessage to empty string", () => {
      const result = throwError(42, "ERR_001");
      expect(result.errorMessage).toBe("");
    });
  });
});

// =============================================================================
// DefaultJobClient
// =============================================================================

describe("DefaultJobClient", () => {
  it("should capture complete result", () => {
    const client = new DefaultJobClient(42);
    client.complete({ output: "done" });
    expect(client.result).toEqual({
      _tag: "complete",
      jobKey: 42,
      variables: { output: "done" },
    });
  });

  it("should capture complete with default empty variables", () => {
    const client = new DefaultJobClient(42);
    client.complete();
    expect(client.result).toEqual({
      _tag: "complete",
      jobKey: 42,
      variables: {},
    });
  });

  it("should capture fail result", () => {
    const client = new DefaultJobClient(42);
    client.fail(2, "connection timeout", 3000);
    expect(client.result).toEqual({
      _tag: "fail",
      jobKey: 42,
      retries: 2,
      errorMessage: "connection timeout",
      retryBackoff: 3000,
    });
  });

  it("should capture throwError result", () => {
    const client = new DefaultJobClient(42);
    client.throwError("INVALID_INPUT", "Missing required field");
    expect(client.result).toEqual({
      _tag: "throwError",
      jobKey: 42,
      errorCode: "INVALID_INPUT",
      errorMessage: "Missing required field",
    });
  });

  it("should have undefined result before any command", () => {
    const client = new DefaultJobClient(42);
    expect(client.result).toBeUndefined();
  });

  it("should throw on second complete call", () => {
    const client = new DefaultJobClient(42);
    client.complete();
    expect(() => client.complete()).toThrow(/already been submitted/);
  });

  it("should throw on fail after complete", () => {
    const client = new DefaultJobClient(42);
    client.complete();
    expect(() => client.fail(1, "oops")).toThrow(/already been submitted/);
  });

  it("should throw on throwError after fail", () => {
    const client = new DefaultJobClient(42);
    client.fail(0, "done");
    expect(() => client.throwError("ERR")).toThrow(/already been submitted/);
  });

  it("should throw on complete after throwError", () => {
    const client = new DefaultJobClient(42);
    client.throwError("ERR");
    expect(() => client.complete()).toThrow(/already been submitted/);
  });
});

// =============================================================================
// JobWorkerRegistry
// =============================================================================

describe("JobWorkerRegistry", () => {
  let registry: JobWorkerRegistry;

  beforeEach(() => {
    registry = new JobWorkerRegistry();
  });

  describe("handler registration", () => {
    it("should register a handler for a job type", () => {
      const handler: JobHandler = vi.fn();
      registry.registerHandler("payment", handler);
      expect(registry.hasHandler("payment")).toBe(true);
    });

    it("should report no handler for unregistered type", () => {
      expect(registry.hasHandler("unknown")).toBe(false);
    });

    it("should overwrite existing handler for same type", () => {
      const handler1: JobHandler = vi.fn();
      const handler2: JobHandler = vi.fn();
      registry.registerHandler("payment", handler1);
      registry.registerHandler("payment", handler2);
      expect(registry.size).toBe(1);
    });

    it("should unregister a handler", () => {
      registry.registerHandler("payment", vi.fn());
      expect(registry.unregisterHandler("payment")).toBe(true);
      expect(registry.hasHandler("payment")).toBe(false);
    });

    it("should return false when unregistering non-existent handler", () => {
      expect(registry.unregisterHandler("unknown")).toBe(false);
    });

    it("should return registered types", () => {
      registry.registerHandler("payment", vi.fn());
      registry.registerHandler("email", vi.fn());
      const types = registry.getRegisteredTypes();
      expect(types).toEqual(new Set(["payment", "email"]));
    });

    it("should report correct size", () => {
      expect(registry.size).toBe(0);
      registry.registerHandler("a", vi.fn());
      registry.registerHandler("b", vi.fn());
      expect(registry.size).toBe(2);
    });

    it("should clear all handlers", () => {
      registry.registerHandler("a", vi.fn());
      registry.registerHandler("b", vi.fn());
      registry.clear();
      expect(registry.size).toBe(0);
      expect(registry.hasHandler("a")).toBe(false);
    });
  });

  describe("job activation — sync handler", () => {
    it("should return complete result from handler", async () => {
      const handler: JobHandler = (client) => {
        client.complete({ result: "ok" });
      };
      registry.registerHandler("test-task", handler);

      const result = await registry.activateJob(createTestJob());
      expect(result._tag).toBe("complete");
      if (result._tag === "complete") {
        expect(result.jobKey).toBe(1001);
        expect(result.variables).toEqual({ result: "ok" });
      }
    });

    it("should return fail result from handler", async () => {
      const handler: JobHandler = (client) => {
        client.fail(2, "temporary error", 1000);
      };
      registry.registerHandler("test-task", handler);

      const result = await registry.activateJob(createTestJob());
      expect(result._tag).toBe("fail");
      if (result._tag === "fail") {
        expect(result.retries).toBe(2);
        expect(result.errorMessage).toBe("temporary error");
        expect(result.retryBackoff).toBe(1000);
      }
    });

    it("should return throwError result from handler", async () => {
      const handler: JobHandler = (client) => {
        client.throwError("VALIDATION_ERROR", "Invalid amount");
      };
      registry.registerHandler("test-task", handler);

      const result = await registry.activateJob(createTestJob());
      expect(result._tag).toBe("throwError");
      if (result._tag === "throwError") {
        expect(result.errorCode).toBe("VALIDATION_ERROR");
        expect(result.errorMessage).toBe("Invalid amount");
      }
    });

    it("should pass job data to handler", async () => {
      const handler: JobHandler = vi.fn((client) => client.complete());
      registry.registerHandler("test-task", handler);

      const job = createTestJob();
      await registry.activateJob(job);

      expect(handler).toHaveBeenCalledOnce();
      const receivedJob = vi.mocked(handler).mock.calls[0][1];
      expect(receivedJob.key).toBe(1001);
      expect(receivedJob.type).toBe("test-task");
      expect(receivedJob.variables).toEqual({ orderId: "ORD-123" });
      expect(receivedJob.customHeaders).toEqual({ priority: "high" });
      expect(receivedJob.elementId).toBe("Task_1");
      expect(receivedJob.processInstanceKey).toBe(3001);
    });
  });

  describe("job activation — async handler", () => {
    it("should await async handler and return result", async () => {
      const handler: JobHandler = async (client) => {
        await Promise.resolve();
        client.complete({ async: true });
      };
      registry.registerHandler("test-task", handler);

      const result = await registry.activateJob(createTestJob());
      expect(result._tag).toBe("complete");
      if (result._tag === "complete") {
        expect(result.variables).toEqual({ async: true });
      }
    });
  });

  describe("error handling", () => {
    it("should auto-fail when handler throws without calling client", async () => {
      const handler: JobHandler = () => {
        throw new Error("handler crashed");
      };
      registry.registerHandler("test-task", handler);

      const result = await registry.activateJob(
        createTestJob({ retries: 3 })
      );
      expect(result._tag).toBe("fail");
      if (result._tag === "fail") {
        expect(result.retries).toBe(2);
        expect(result.errorMessage).toContain("handler crashed");
      }
    });

    it("should auto-fail with retries 0 when retries already 1", async () => {
      const handler: JobHandler = () => {
        throw new Error("boom");
      };
      registry.registerHandler("test-task", handler);

      const result = await registry.activateJob(
        createTestJob({ retries: 1 })
      );
      expect(result._tag).toBe("fail");
      if (result._tag === "fail") {
        expect(result.retries).toBe(0);
      }
    });

    it("should not go below 0 retries on auto-fail", async () => {
      const handler: JobHandler = () => {
        throw new Error("boom");
      };
      registry.registerHandler("test-task", handler);

      const result = await registry.activateJob(
        createTestJob({ retries: 0 })
      );
      expect(result._tag).toBe("fail");
      if (result._tag === "fail") {
        expect(result.retries).toBe(0);
      }
    });

    it("should auto-fail async handler that rejects", async () => {
      const handler: JobHandler = async () => {
        throw new Error("async failure");
      };
      registry.registerHandler("test-task", handler);

      const result = await registry.activateJob(createTestJob());
      expect(result._tag).toBe("fail");
      if (result._tag === "fail") {
        expect(result.errorMessage).toContain("async failure");
      }
    });

    it("should use captured result when handler calls client then throws", async () => {
      const handler: JobHandler = (client) => {
        client.complete({ partial: true });
        throw new Error("post-complete crash");
      };
      registry.registerHandler("test-task", handler);

      const result = await registry.activateJob(createTestJob());
      expect(result._tag).toBe("complete");
      if (result._tag === "complete") {
        expect(result.variables).toEqual({ partial: true });
      }
    });

    it("should fail when no handler is registered", async () => {
      const result = await registry.activateJob(createTestJob());
      expect(result._tag).toBe("fail");
      if (result._tag === "fail") {
        expect(result.errorMessage).toContain(
          "No handler registered for job type"
        );
        expect(result.retries).toBe(3);
      }
    });

    it("should fail when handler does not call any client method", async () => {
      const handler: JobHandler = () => {
        // handler forgot to call client method
      };
      registry.registerHandler("test-task", handler);

      const result = await registry.activateJob(createTestJob());
      expect(result._tag).toBe("fail");
      if (result._tag === "fail") {
        expect(result.errorMessage).toContain(
          "did not call complete, fail, or throwError"
        );
      }
    });

    it("should handle non-Error throw values", async () => {
      const handler: JobHandler = () => {
        throw "string error";
      };
      registry.registerHandler("test-task", handler);

      const result = await registry.activateJob(createTestJob());
      expect(result._tag).toBe("fail");
      if (result._tag === "fail") {
        expect(result.errorMessage).toContain("string error");
      }
    });
  });
});
