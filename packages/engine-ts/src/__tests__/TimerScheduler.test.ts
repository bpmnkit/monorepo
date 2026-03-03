/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { TimerType, parseDuration, parseCycle } from "../timer/TimerDefinition.js";
import type { TimerCallback, TimerInstance } from "../timer/TimerScheduler.js";
import { TimerScheduler } from "../timer/TimerScheduler.js";

describe("TimerDefinition", () => {
  describe("parseDuration", () => {
    it("should parse seconds", () => {
      expect(parseDuration("PT30S")).toBe(30_000);
    });

    it("should parse minutes", () => {
      expect(parseDuration("PT5M")).toBe(300_000);
    });

    it("should parse hours", () => {
      expect(parseDuration("PT2H")).toBe(7_200_000);
    });

    it("should parse days", () => {
      expect(parseDuration("P1D")).toBe(86_400_000);
    });

    it("should parse combined duration", () => {
      expect(parseDuration("P1DT2H30M15S")).toBe(
        86_400_000 + 7_200_000 + 1_800_000 + 15_000
      );
    });

    it("should parse fractional seconds", () => {
      expect(parseDuration("PT1.5S")).toBe(1_500);
    });

    it("should parse years and months (approximated)", () => {
      const yearMs = 365 * 24 * 60 * 60 * 1000;
      const monthMs = 30 * 24 * 60 * 60 * 1000;
      expect(parseDuration("P1Y2M")).toBe(yearMs + 2 * monthMs);
    });

    it("should throw for invalid duration", () => {
      expect(() => parseDuration("invalid")).toThrow("Invalid ISO 8601 duration");
    });

    it("should throw for empty string", () => {
      expect(() => parseDuration("")).toThrow("Invalid ISO 8601 duration");
    });
  });

  describe("parseCycle", () => {
    it("should parse finite cycle", () => {
      const result = parseCycle("R3/PT10S");
      expect(result.repetitions).toBe(3);
      expect(result.intervalMs).toBe(10_000);
    });

    it("should parse infinite cycle", () => {
      const result = parseCycle("R/PT5M");
      expect(result.repetitions).toBe(-1);
      expect(result.intervalMs).toBe(300_000);
    });

    it("should parse R0 as unlimited", () => {
      const result = parseCycle("R0/PT1S");
      expect(result.repetitions).toBe(0);
    });

    it("should throw for invalid cycle format", () => {
      expect(() => parseCycle("invalid")).toThrow(
        "Invalid ISO 8601 repeating interval"
      );
    });

    it("should throw for missing slash", () => {
      expect(() => parseCycle("R3PT10S")).toThrow(
        "Invalid ISO 8601 repeating interval"
      );
    });
  });

  describe("TimerType enum", () => {
    it("should have DATE, DURATION, and CYCLE values", () => {
      expect(TimerType.DATE).toBe("DATE");
      expect(TimerType.DURATION).toBe("DURATION");
      expect(TimerType.CYCLE).toBe("CYCLE");
    });
  });
});

describe("TimerScheduler", () => {
  let scheduler: TimerScheduler;
  let triggered: TimerInstance[];
  let mockCallback: TimerCallback;
  let currentTime: number;

  beforeEach(() => {
    vi.useFakeTimers();
    currentTime = 1000;
    triggered = [];
    mockCallback = {
      onTimerTriggered: vi.fn((instance: TimerInstance) => {
        triggered.push(instance);
      }),
    };
    scheduler = new TimerScheduler(mockCallback, () => currentTime);
  });

  afterEach(() => {
    scheduler.clear();
    vi.useRealTimers();
  });

  describe("Duration timers", () => {
    it("should schedule a duration timer", () => {
      const instance = scheduler.scheduleTimer(1, 100, 200, {
        type: TimerType.DURATION,
        value: "PT10S",
      });

      expect(instance.elementInstanceKey).toBe(1);
      expect(instance.processInstanceKey).toBe(100);
      expect(instance.dueDate).toBe(1000 + 10_000);
      expect(instance.repetitionsLeft).toBe(1);
      expect(scheduler.activeCount).toBe(1);
    });

    it("should fire duration timer after delay", () => {
      scheduler.scheduleTimer(1, 100, 200, {
        type: TimerType.DURATION,
        value: "PT5S",
      });

      vi.advanceTimersByTime(5_000);

      expect(triggered).toHaveLength(1);
      expect(triggered[0].elementInstanceKey).toBe(1);
      expect(scheduler.activeCount).toBe(0);
    });

    it("should not fire before delay", () => {
      scheduler.scheduleTimer(1, 100, 200, {
        type: TimerType.DURATION,
        value: "PT10S",
      });

      vi.advanceTimersByTime(9_999);
      expect(triggered).toHaveLength(0);
      expect(scheduler.activeCount).toBe(1);
    });
  });

  describe("Date timers", () => {
    it("should schedule a date timer", () => {
      const futureDate = new Date(currentTime + 60_000).toISOString();
      const instance = scheduler.scheduleTimer(2, 100, 200, {
        type: TimerType.DATE,
        value: futureDate,
      });

      expect(instance.dueDate).toBe(currentTime + 60_000);
      expect(instance.repetitionsLeft).toBe(1);
    });

    it("should fire date timer at correct time", () => {
      const futureDate = new Date(currentTime + 3_000).toISOString();
      scheduler.scheduleTimer(2, 100, 200, {
        type: TimerType.DATE,
        value: futureDate,
      });

      vi.advanceTimersByTime(3_000);
      expect(triggered).toHaveLength(1);
    });
  });

  describe("Cycle timers", () => {
    it("should schedule a cycle timer", () => {
      const instance = scheduler.scheduleTimer(3, 100, 200, {
        type: TimerType.CYCLE,
        value: "R3/PT2S",
      });

      expect(instance.dueDate).toBe(currentTime + 2_000);
      expect(instance.repetitionsLeft).toBe(3);
    });

    it("should fire and reschedule cycle timer", () => {
      scheduler.scheduleTimer(3, 100, 200, {
        type: TimerType.CYCLE,
        value: "R3/PT2S",
      });

      // First fire
      currentTime = 1000 + 2_000;
      vi.advanceTimersByTime(2_000);
      expect(triggered).toHaveLength(1);
      expect(scheduler.activeCount).toBe(1); // rescheduled

      // Second fire
      currentTime = 1000 + 4_000;
      vi.advanceTimersByTime(2_000);
      expect(triggered).toHaveLength(2);
      expect(scheduler.activeCount).toBe(1); // rescheduled again

      // Third fire (final)
      currentTime = 1000 + 6_000;
      vi.advanceTimersByTime(2_000);
      expect(triggered).toHaveLength(3);
      expect(scheduler.activeCount).toBe(0); // no more repetitions
    });
  });

  describe("Cancellation", () => {
    it("should cancel a specific timer", () => {
      scheduler.scheduleTimer(1, 100, 200, {
        type: TimerType.DURATION,
        value: "PT10S",
      });

      const cancelled = scheduler.cancelTimer(1);
      expect(cancelled).toBe(true);
      expect(scheduler.activeCount).toBe(0);

      vi.advanceTimersByTime(10_000);
      expect(triggered).toHaveLength(0);
    });

    it("should return false when cancelling non-existent timer", () => {
      expect(scheduler.cancelTimer(999)).toBe(false);
    });

    it("should cancel all timers for a process instance", () => {
      scheduler.scheduleTimer(1, 100, 200, {
        type: TimerType.DURATION,
        value: "PT10S",
      });
      scheduler.scheduleTimer(2, 100, 200, {
        type: TimerType.DURATION,
        value: "PT20S",
      });
      scheduler.scheduleTimer(3, 200, 200, {
        type: TimerType.DURATION,
        value: "PT30S",
      });

      scheduler.cancelAllTimers(100);
      expect(scheduler.activeCount).toBe(1); // only timer 3 remains

      vi.advanceTimersByTime(30_000);
      expect(triggered).toHaveLength(1);
      expect(triggered[0].elementInstanceKey).toBe(3);
    });
  });

  describe("Lookup", () => {
    it("should return timer for element instance", () => {
      scheduler.scheduleTimer(5, 100, 200, {
        type: TimerType.DURATION,
        value: "PT1S",
      });

      const timer = scheduler.getTimer(5);
      expect(timer).toBeDefined();
      expect(timer!.elementInstanceKey).toBe(5);
    });

    it("should return undefined for non-existent timer", () => {
      expect(scheduler.getTimer(999)).toBeUndefined();
    });
  });

  describe("Clear", () => {
    it("should cancel all timers", () => {
      scheduler.scheduleTimer(1, 100, 200, {
        type: TimerType.DURATION,
        value: "PT10S",
      });
      scheduler.scheduleTimer(2, 100, 200, {
        type: TimerType.DURATION,
        value: "PT20S",
      });

      scheduler.clear();
      expect(scheduler.activeCount).toBe(0);

      vi.advanceTimersByTime(20_000);
      expect(triggered).toHaveLength(0);
    });
  });
});
