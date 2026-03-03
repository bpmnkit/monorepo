/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import type { VariableEvent } from "../state/VariableEvent.js";
import { VariableIntent } from "../state/VariableIntent.js";
import { NO_PARENT } from "../state/VariableState.js";
import type { VariableStore } from "../state/VariableStore.js";

/**
 * A set of variable name-value pairs to be merged into a scope.
 * Values must be JSON-compatible (null, boolean, number, string, array, object).
 */
export type VariableDocument = Record<string, unknown>;

/**
 * High-level variable mutation operations that mirror Zeebe's `VariableBehavior`.
 *
 * Provides two merge strategies:
 * - `mergeDocument`: walks up the scope tree, updating existing variables at each
 *   ancestor scope and creating remaining variables at the root scope.
 * - `mergeLocal`: writes all variables directly to the specified scope.
 *
 * Both methods return an array of `VariableEvent` records describing what changed.
 */
export class VariableBehavior {
  private readonly store: VariableStore;

  constructor(store: VariableStore) {
    this.store = store;
  }

  /**
   * Merges a variable document by walking up the scope tree.
   *
   * Algorithm (mirrors `VariableBehavior.mergeDocument` in Zeebe):
   * 1. Start at `scopeKey` and walk upward through parent scopes.
   * 2. At each non-root scope: if a variable from the document exists locally,
   *    update it (if the value changed) and remove it from the remaining set.
   * 3. After reaching the root: create (or update) all remaining variables there.
   *
   * @param scopeKey - the scope to start the walk from (typically the current element)
   * @param document - name-value pairs to merge
   * @returns events describing each CREATED or UPDATED variable
   */
  mergeDocument(
    scopeKey: number,
    document: VariableDocument
  ): VariableEvent[] {
    const events: VariableEvent[] = [];
    const remaining = new Map(Object.entries(document));

    if (remaining.size === 0) {
      return events;
    }

    let currentScope = scopeKey;

    // Walk up through non-root scopes, updating existing variables in place
    while (this.store.getParentScopeKey(currentScope) !== NO_PARENT) {
      for (const [name, value] of remaining) {
        if (this.store.hasVariableLocal(currentScope, name)) {
          const existing = this.store.getVariableLocal(currentScope, name);
          if (!deepEqual(existing, value)) {
            this.store.setVariableLocal(currentScope, name, value);
            events.push({
              intent: VariableIntent.UPDATED,
              scopeKey: currentScope,
              name,
              value,
              oldValue: existing,
            });
          }
          remaining.delete(name);
        }
      }
      currentScope = this.store.getParentScopeKey(currentScope);
    }

    // At root scope: create or update remaining variables
    for (const [name, value] of remaining) {
      const event = this.applyLocalVariable(currentScope, name, value);
      if (event) {
        events.push(event);
      }
    }

    return events;
  }

  /**
   * Merges a variable document directly into the specified scope.
   * Does NOT walk the scope tree — all variables are written to `scopeKey`.
   *
   * Mirrors `VariableBehavior.mergeLocalDocument` in Zeebe.
   *
   * @param scopeKey - the scope to write all variables to
   * @param document - name-value pairs to merge
   * @returns events describing each CREATED or UPDATED variable
   */
  mergeLocal(
    scopeKey: number,
    document: VariableDocument
  ): VariableEvent[] {
    const events: VariableEvent[] = [];
    for (const [name, value] of Object.entries(document)) {
      const event = this.applyLocalVariable(scopeKey, name, value);
      if (event) {
        events.push(event);
      }
    }
    return events;
  }

  /**
   * Sets a single variable at the given scope, emitting a CREATED or UPDATED event.
   * Returns `undefined` if the value is unchanged (no event needed).
   *
   * Mirrors the private `setLocalVariable` in Zeebe's `VariableBehavior`.
   */
  private applyLocalVariable(
    scopeKey: number,
    name: string,
    value: unknown
  ): VariableEvent | undefined {
    if (this.store.hasVariableLocal(scopeKey, name)) {
      const existing = this.store.getVariableLocal(scopeKey, name);
      if (!deepEqual(existing, value)) {
        this.store.setVariableLocal(scopeKey, name, value);
        return {
          intent: VariableIntent.UPDATED,
          scopeKey,
          name,
          value,
          oldValue: existing,
        };
      }
      // Same value — no event, no write
      return undefined;
    }

    this.store.setVariableLocal(scopeKey, name, value);
    return {
      intent: VariableIntent.CREATED,
      scopeKey,
      name,
      value,
    };
  }
}

// ---------------------------------------------------------------------------
// Deep equality for JSON-compatible values
// ---------------------------------------------------------------------------

/**
 * Compares two JSON-compatible values for deep structural equality.
 * Handles null, primitives, arrays, and plain objects.
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (a === null || b === null) {
    return false;
  }
  if (typeof a !== typeof b) {
    return false;
  }

  if (Array.isArray(a)) {
    if (!Array.isArray(b)) {
      return false;
    }
    if (a.length !== b.length) {
      return false;
    }
    return a.every((val, idx) => deepEqual(val, b[idx]));
  }

  if (typeof a === "object" && typeof b === "object") {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);
    if (aKeys.length !== bKeys.length) {
      return false;
    }
    return aKeys.every(
      (key) => key in bObj && deepEqual(aObj[key], bObj[key])
    );
  }

  return false;
}
