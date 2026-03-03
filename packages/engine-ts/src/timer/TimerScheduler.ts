/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import type { TimerDefinition } from "./TimerDefinition.js";
import { TimerType, parseDuration, parseCycle } from "./TimerDefinition.js";

// Timer globals available in both browser and Node.js environments
declare function setTimeout(callback: () => void, ms: number): number;
declare function clearTimeout(handle: number): void;

/**
 * Represents an active timer instance scheduled by the engine.
 *
 * Mirrors Zeebe's `TimerInstance` state, adapted for the browser engine
 * where timers are backed by `setTimeout` instead of a deterministic
 * timer wheel.
 */
export interface TimerInstance {
  /** Unique key identifying this timer instance. */
  readonly key: number;

  /** The element instance key of the event that created this timer. */
  readonly elementInstanceKey: number;

  /** The process instance this timer belongs to. */
  readonly processInstanceKey: number;

  /** The process definition key. */
  readonly processDefinitionKey: number;

  /** The timer definition from the BPMN model. */
  readonly timerDefinition: TimerDefinition;

  /** Absolute timestamp (ms since epoch) when the timer fires. */
  readonly dueDate: number;

  /**
   * Remaining repetitions for cycle timers.
   * -1 means infinite repetitions.
   * For non-cycle timers, this is always 1.
   */
  readonly repetitionsLeft: number;
}

/**
 * Callback interface for timer events.
 */
export interface TimerCallback {
  /** Called when a timer fires. */
  onTimerTriggered(instance: TimerInstance): void;
}

/**
 * Browser-adapted timer scheduler using `setTimeout`.
 *
 * Replaces Zeebe's deterministic `DueDateTimerChecker` + actor-based scheduling
 * with simple `setTimeout` calls suitable for a single-threaded browser environment.
 *
 * Features:
 * - Schedule timers for duration, date, and cycle definitions
 * - Cancel individual timers by element instance key
 * - Cancel all timers for a process instance
 * - Cycle timers automatically reschedule until repetitions are exhausted
 */
export class TimerScheduler {
  private readonly activeTimers = new Map<
    number,
    { instance: TimerInstance; handle: number }
  >();
  private nextKey = 1;
  private readonly callback: TimerCallback;
  private readonly clock: () => number;

  constructor(callback: TimerCallback, clock: () => number = Date.now) {
    this.callback = callback;
    this.clock = clock;
  }

  /**
   * Schedules a timer based on the given definition.
   *
   * @param elementInstanceKey - The element instance that created this timer
   * @param processInstanceKey - The owning process instance
   * @param processDefinitionKey - The process definition key
   * @param definition - The timer definition (type + value)
   * @returns The created TimerInstance
   */
  scheduleTimer(
    elementInstanceKey: number,
    processInstanceKey: number,
    processDefinitionKey: number,
    definition: TimerDefinition
  ): TimerInstance {
    const now = this.clock();
    let dueDate: number;
    let repetitionsLeft: number;

    switch (definition.type) {
      case TimerType.DATE:
        dueDate = new Date(definition.value).getTime();
        repetitionsLeft = 1;
        break;

      case TimerType.DURATION:
        dueDate = now + parseDuration(definition.value);
        repetitionsLeft = 1;
        break;

      case TimerType.CYCLE: {
        const { repetitions, intervalMs } = parseCycle(definition.value);
        dueDate = now + intervalMs;
        repetitionsLeft = repetitions;
        break;
      }
    }

    const instance: TimerInstance = {
      key: this.nextKey++,
      elementInstanceKey,
      processInstanceKey,
      processDefinitionKey,
      timerDefinition: definition,
      dueDate,
      repetitionsLeft,
    };

    this.scheduleInstance(instance);
    return instance;
  }

  /**
   * Cancels the timer for the given element instance.
   *
   * @returns true if a timer was found and cancelled
   */
  cancelTimer(elementInstanceKey: number): boolean {
    const entry = this.activeTimers.get(elementInstanceKey);
    if (!entry) {
      return false;
    }
    clearTimeout(entry.handle);
    this.activeTimers.delete(elementInstanceKey);
    return true;
  }

  /**
   * Cancels all timers belonging to the given process instance.
   */
  cancelAllTimers(processInstanceKey: number): void {
    for (const [elemKey, entry] of this.activeTimers) {
      if (entry.instance.processInstanceKey === processInstanceKey) {
        clearTimeout(entry.handle);
        this.activeTimers.delete(elemKey);
      }
    }
  }

  /**
   * Returns the active timer for the given element instance, or undefined.
   */
  getTimer(elementInstanceKey: number): TimerInstance | undefined {
    return this.activeTimers.get(elementInstanceKey)?.instance;
  }

  /**
   * Returns the number of currently active timers.
   */
  get activeCount(): number {
    return this.activeTimers.size;
  }

  /**
   * Cancels all active timers and resets internal state.
   */
  clear(): void {
    for (const entry of this.activeTimers.values()) {
      clearTimeout(entry.handle);
    }
    this.activeTimers.clear();
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private scheduleInstance(instance: TimerInstance): void {
    const now = this.clock();
    const delay = Math.max(0, instance.dueDate - now);

    const handle: number = setTimeout(() => {
      this.activeTimers.delete(instance.elementInstanceKey);
      this.callback.onTimerTriggered(instance);

      // Reschedule for cycle timers
      if (
        instance.timerDefinition.type === TimerType.CYCLE &&
        instance.repetitionsLeft !== 1
      ) {
        const { intervalMs } = parseCycle(instance.timerDefinition.value);
        const nextInstance: TimerInstance = {
          ...instance,
          key: this.nextKey++,
          dueDate: instance.dueDate + intervalMs,
          repetitionsLeft:
            instance.repetitionsLeft === -1
              ? -1
              : instance.repetitionsLeft - 1,
        };
        this.scheduleInstance(nextInstance);
      }
    }, delay) as unknown as number;

    this.activeTimers.set(instance.elementInstanceKey, {
      instance,
      handle,
    });
  }
}
