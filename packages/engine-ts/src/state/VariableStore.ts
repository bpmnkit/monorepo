/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import type { VariableState } from "./VariableState.js";
import { NO_PARENT } from "./VariableState.js";

/**
 * Mutable, in-memory implementation of variable state.
 *
 * Replaces Zeebe's `DbVariableState` (backed by RocksDB column families) with
 * plain `Map` instances suitable for a single-threaded browser environment.
 *
 * Storage layout:
 * - `variables`: scopeKey → (name → value)   — mirrors VARIABLES column family
 * - `parentScopes`: childKey → parentKey      — mirrors ELEMENT_INSTANCE_CHILD_PARENT
 */
export class VariableStore implements VariableState {
  /** scopeKey → (variableName → value) */
  private readonly variables = new Map<number, Map<string, unknown>>();

  /** childScopeKey → parentScopeKey */
  private readonly parentScopes = new Map<number, number>();

  // ---------------------------------------------------------------------------
  // Read operations (VariableState interface)
  // ---------------------------------------------------------------------------

  getVariable(scopeKey: number, name: string): unknown | undefined {
    let currentScope = scopeKey;
    do {
      const value = this.getVariableLocal(currentScope, name);
      if (value !== undefined) {
        return value;
      }
      currentScope = this.getParentScopeKey(currentScope);
    } while (currentScope !== NO_PARENT);
    return undefined;
  }

  getVariableLocal(scopeKey: number, name: string): unknown | undefined {
    const scopeVars = this.variables.get(scopeKey);
    if (scopeVars === undefined) {
      return undefined;
    }
    // Use has() check to correctly handle null values (which are valid JSON)
    if (!scopeVars.has(name)) {
      return undefined;
    }
    return scopeVars.get(name);
  }

  hasVariableLocal(scopeKey: number, name: string): boolean {
    const scopeVars = this.variables.get(scopeKey);
    return scopeVars !== undefined && scopeVars.has(name);
  }

  getVariablesLocal(scopeKey: number): ReadonlyMap<string, unknown> {
    return this.variables.get(scopeKey) ?? new Map<string, unknown>();
  }

  getVariablesInScope(scopeKey: number): ReadonlyMap<string, unknown> {
    // Collect scope chain from leaf to root
    const scopeChain: number[] = [];
    let currentScope = scopeKey;
    do {
      scopeChain.push(currentScope);
      currentScope = this.getParentScopeKey(currentScope);
    } while (currentScope !== NO_PARENT);

    // Merge from root to leaf so inner scopes shadow outer scopes
    const result = new Map<string, unknown>();
    for (let i = scopeChain.length - 1; i >= 0; i--) {
      const scopeVars = this.variables.get(scopeChain[i]);
      if (scopeVars) {
        for (const [name, value] of scopeVars) {
          result.set(name, value);
        }
      }
    }
    return result;
  }

  getParentScopeKey(childKey: number): number {
    return this.parentScopes.get(childKey) ?? NO_PARENT;
  }

  // ---------------------------------------------------------------------------
  // Write operations
  // ---------------------------------------------------------------------------

  /**
   * Sets a variable at the specified scope. Creates the scope's variable map
   * if it does not already exist.
   */
  setVariableLocal(scopeKey: number, name: string, value: unknown): void {
    let scopeVars = this.variables.get(scopeKey);
    if (!scopeVars) {
      scopeVars = new Map<string, unknown>();
      this.variables.set(scopeKey, scopeVars);
    }
    scopeVars.set(name, value);
  }

  /**
   * Registers a parent-child scope relationship.
   * Use `NO_PARENT` as `parentKey` for root scopes.
   */
  createScope(childKey: number, parentKey: number): void {
    this.parentScopes.set(childKey, parentKey);
  }

  /**
   * Removes all variables and the parent link for the given scope.
   * Does not cascade to child scopes — callers must remove children explicitly.
   */
  removeScope(scopeKey: number): void {
    this.variables.delete(scopeKey);
    this.parentScopes.delete(scopeKey);
  }
}
