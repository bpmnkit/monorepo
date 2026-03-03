/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

/**
 * Sentinel value indicating a scope has no parent (it is a root scope).
 *
 * Mirrors the constant used in `DbVariableState` and `ElementInstance`.
 */
export const NO_PARENT = -1;

/**
 * Read-only access to variable state, supporting scope-tree traversal.
 *
 * Mirrors the immutable portion of `io.camunda.zeebe.engine.state.variable.VariableState`.
 *
 * Variables are JSON-compatible values (null, boolean, number, string, array, object).
 * A return value of `undefined` means "variable not found".
 */
export interface VariableState {
  /**
   * Resolves a variable by walking up the scope tree from the given scope.
   * Returns the value from the closest (innermost) scope where it exists,
   * or `undefined` if not found in any ancestor.
   */
  getVariable(scopeKey: number, name: string): unknown | undefined;

  /**
   * Returns the variable value at exactly the given scope, without walking the tree.
   * Returns `undefined` if the variable does not exist at this scope.
   */
  getVariableLocal(scopeKey: number, name: string): unknown | undefined;

  /**
   * Returns true if a variable with the given name exists at exactly the given scope.
   */
  hasVariableLocal(scopeKey: number, name: string): boolean;

  /**
   * Returns all variables defined at exactly the given scope.
   */
  getVariablesLocal(scopeKey: number): ReadonlyMap<string, unknown>;

  /**
   * Returns all variables visible from the given scope by walking up the scope tree.
   * Inner scope variables shadow outer scope variables with the same name.
   */
  getVariablesInScope(scopeKey: number): ReadonlyMap<string, unknown>;

  /**
   * Returns the parent scope key for the given child scope.
   * Returns `NO_PARENT` (-1) if the scope has no parent or is unknown.
   */
  getParentScopeKey(childKey: number): number;
}
