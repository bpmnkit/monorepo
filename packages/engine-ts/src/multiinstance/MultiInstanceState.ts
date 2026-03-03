/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

/**
 * Tracks per-instance counters for a multi-instance body element.
 *
 * Mirrors the child instance count fields on Zeebe's `ElementInstance`:
 * - `numberOfElementInstances` (total activated)
 * - `numberOfActiveElementInstances` (currently executing)
 * - `numberOfCompletedElementInstances` (finished successfully)
 * - `numberOfTerminatedElementInstances` (cancelled/terminated)
 *
 * Also tracks the loop counter per child instance (1-based).
 */
export interface MultiInstanceInstanceCounts {
  /** Total number of child instances that have been activated. */
  totalActivated: number;
  /** Number of currently executing child instances. */
  active: number;
  /** Number of child instances that completed successfully. */
  completed: number;
  /** Number of child instances that were terminated. */
  terminated: number;
}

/**
 * In-memory state tracking for multi-instance body elements.
 *
 * Replaces the child instance counters stored on Zeebe's `ElementInstance` (backed by RocksDB)
 * with plain `Map` instances suitable for the browser engine.
 *
 * Each multi-instance body element instance (identified by its elementInstanceKey)
 * has its own set of counters and a loop counter tracking the next iteration index.
 */
export class MultiInstanceState {
  /** elementInstanceKey → instance counts */
  private readonly counts = new Map<number, MultiInstanceInstanceCounts>();

  /** childElementInstanceKey → loop counter (1-based) */
  private readonly loopCounters = new Map<number, number>();

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Initializes tracking for a multi-instance body instance.
   * Must be called when the MI body is activated.
   */
  initializeBody(elementInstanceKey: number): void {
    this.counts.set(elementInstanceKey, {
      totalActivated: 0,
      active: 0,
      completed: 0,
      terminated: 0,
    });
  }

  /**
   * Removes all tracking state for a multi-instance body instance.
   * Should be called when the MI body is completed or terminated.
   */
  removeBody(elementInstanceKey: number): void {
    this.counts.delete(elementInstanceKey);
  }

  // ---------------------------------------------------------------------------
  // Instance counts
  // ---------------------------------------------------------------------------

  /**
   * Returns the instance counts for a multi-instance body, or undefined if not tracked.
   */
  getCounts(elementInstanceKey: number): MultiInstanceInstanceCounts | undefined {
    return this.counts.get(elementInstanceKey);
  }

  /**
   * Records that a new child instance has been activated.
   * Increments both `totalActivated` and `active`.
   */
  incrementActivated(elementInstanceKey: number): void {
    const counts = this.requireCounts(elementInstanceKey);
    counts.totalActivated++;
    counts.active++;
  }

  /**
   * Records that a child instance has completed successfully.
   * Decrements `active` and increments `completed`.
   */
  incrementCompleted(elementInstanceKey: number): void {
    const counts = this.requireCounts(elementInstanceKey);
    counts.active--;
    counts.completed++;
  }

  /**
   * Records that a child instance has been terminated.
   * Decrements `active` and increments `terminated`.
   */
  incrementTerminated(elementInstanceKey: number): void {
    const counts = this.requireCounts(elementInstanceKey);
    counts.active--;
    counts.terminated++;
  }

  // ---------------------------------------------------------------------------
  // Loop counters
  // ---------------------------------------------------------------------------

  /**
   * Sets the loop counter for a child element instance.
   * The loop counter is 1-based (first iteration = 1).
   */
  setLoopCounter(childElementInstanceKey: number, loopCounter: number): void {
    this.loopCounters.set(childElementInstanceKey, loopCounter);
  }

  /**
   * Returns the loop counter for a child element instance, or 0 if not set.
   */
  getLoopCounter(childElementInstanceKey: number): number {
    return this.loopCounters.get(childElementInstanceKey) ?? 0;
  }

  /**
   * Removes the loop counter for a child element instance.
   */
  removeLoopCounter(childElementInstanceKey: number): void {
    this.loopCounters.delete(childElementInstanceKey);
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private requireCounts(
    elementInstanceKey: number
  ): MultiInstanceInstanceCounts {
    const counts = this.counts.get(elementInstanceKey);
    if (!counts) {
      throw new Error(
        `No multi-instance state initialized for element instance key: ${elementInstanceKey}`
      );
    }
    return counts;
  }
}
