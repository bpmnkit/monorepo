/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { VariableStore } from "../state/VariableStore.js";
import { NO_PARENT } from "../state/VariableState.js";
import { VariableIntent } from "../state/VariableIntent.js";
import { VariableBehavior } from "../variable/VariableBehavior.js";

/*
 * Scope tree used by most tests:
 *
 *   Process (key=1, root — no parent)
 *     └─ SubProcess (key=2, parent=1)
 *         └─ Task (key=3, parent=2)
 */

describe("VariableScoping", () => {
  let store: VariableStore;
  let behavior: VariableBehavior;

  beforeEach(() => {
    store = new VariableStore();
    behavior = new VariableBehavior(store);

    // given — a three-level scope tree
    store.createScope(1, NO_PARENT);
    store.createScope(2, 1);
    store.createScope(3, 2);
  });

  // -------------------------------------------------------------------------
  // VariableStore — scope tree
  // -------------------------------------------------------------------------

  describe("VariableStore", () => {
    describe("scope tree", () => {
      it("should return NO_PARENT for root scope", () => {
        expect(store.getParentScopeKey(1)).toBe(NO_PARENT);
      });

      it("should return parent scope key for child scopes", () => {
        expect(store.getParentScopeKey(2)).toBe(1);
        expect(store.getParentScopeKey(3)).toBe(2);
      });

      it("should return NO_PARENT for unknown scope", () => {
        expect(store.getParentScopeKey(999)).toBe(NO_PARENT);
      });
    });

    // -----------------------------------------------------------------------
    // VariableStore — getVariableLocal
    // -----------------------------------------------------------------------

    describe("getVariableLocal", () => {
      it("should return undefined when variable does not exist", () => {
        expect(store.getVariableLocal(1, "x")).toBeUndefined();
      });

      it("should return value when variable exists at scope", () => {
        store.setVariableLocal(1, "x", 42);
        expect(store.getVariableLocal(1, "x")).toBe(42);
      });

      it("should NOT find variable from parent scope", () => {
        store.setVariableLocal(1, "x", 42);
        expect(store.getVariableLocal(2, "x")).toBeUndefined();
      });

      it("should handle null values correctly", () => {
        store.setVariableLocal(1, "x", null);
        expect(store.getVariableLocal(1, "x")).toBeNull();
      });
    });

    // -----------------------------------------------------------------------
    // VariableStore — hasVariableLocal
    // -----------------------------------------------------------------------

    describe("hasVariableLocal", () => {
      it("should return false when variable does not exist", () => {
        expect(store.hasVariableLocal(1, "x")).toBe(false);
      });

      it("should return true when variable exists", () => {
        store.setVariableLocal(1, "x", 42);
        expect(store.hasVariableLocal(1, "x")).toBe(true);
      });

      it("should return true for null-valued variable", () => {
        store.setVariableLocal(1, "x", null);
        expect(store.hasVariableLocal(1, "x")).toBe(true);
      });

      it("should return false for scope with no variables", () => {
        expect(store.hasVariableLocal(2, "x")).toBe(false);
      });
    });

    // -----------------------------------------------------------------------
    // VariableStore — getVariable (scope-walking)
    // -----------------------------------------------------------------------

    describe("getVariable", () => {
      it("should find variable at current scope", () => {
        store.setVariableLocal(3, "x", 10);
        expect(store.getVariable(3, "x")).toBe(10);
      });

      it("should find variable at parent scope", () => {
        store.setVariableLocal(1, "x", 42);
        expect(store.getVariable(3, "x")).toBe(42);
      });

      it("should find variable at intermediate scope", () => {
        store.setVariableLocal(2, "x", 20);
        expect(store.getVariable(3, "x")).toBe(20);
      });

      it("should return closest scope value when shadowed", () => {
        // given — variable defined at root and intermediate scope
        store.setVariableLocal(1, "x", 10);
        store.setVariableLocal(2, "x", 20);

        // then — inner scope sees the intermediate value
        expect(store.getVariable(3, "x")).toBe(20);
      });

      it("should return undefined when variable not found anywhere", () => {
        expect(store.getVariable(3, "missing")).toBeUndefined();
      });

      it("should find null-valued variable via scope walk", () => {
        store.setVariableLocal(1, "x", null);
        expect(store.getVariable(3, "x")).toBeNull();
      });
    });

    // -----------------------------------------------------------------------
    // VariableStore — getVariablesLocal
    // -----------------------------------------------------------------------

    describe("getVariablesLocal", () => {
      it("should return empty map for scope with no variables", () => {
        expect(store.getVariablesLocal(1).size).toBe(0);
      });

      it("should return all variables at scope", () => {
        store.setVariableLocal(1, "a", 1);
        store.setVariableLocal(1, "b", 2);
        const vars = store.getVariablesLocal(1);
        expect(vars.size).toBe(2);
        expect(vars.get("a")).toBe(1);
        expect(vars.get("b")).toBe(2);
      });

      it("should not include variables from child scopes", () => {
        store.setVariableLocal(1, "a", 1);
        store.setVariableLocal(2, "b", 2);
        const vars = store.getVariablesLocal(1);
        expect(vars.size).toBe(1);
        expect(vars.has("b")).toBe(false);
      });
    });

    // -----------------------------------------------------------------------
    // VariableStore — getVariablesInScope
    // -----------------------------------------------------------------------

    describe("getVariablesInScope", () => {
      it("should collect variables from all ancestor scopes", () => {
        store.setVariableLocal(1, "a", 1);
        store.setVariableLocal(2, "b", 2);
        store.setVariableLocal(3, "c", 3);
        const vars = store.getVariablesInScope(3);
        expect(vars.size).toBe(3);
        expect(vars.get("a")).toBe(1);
        expect(vars.get("b")).toBe(2);
        expect(vars.get("c")).toBe(3);
      });

      it("should shadow parent variables with child variables", () => {
        store.setVariableLocal(1, "x", "root");
        store.setVariableLocal(3, "x", "task");
        const vars = store.getVariablesInScope(3);
        expect(vars.get("x")).toBe("task");
      });

      it("should return empty map when no variables exist", () => {
        expect(store.getVariablesInScope(3).size).toBe(0);
      });

      it("should only return variables at root for root scope", () => {
        store.setVariableLocal(1, "a", 1);
        store.setVariableLocal(2, "b", 2);
        const vars = store.getVariablesInScope(1);
        expect(vars.size).toBe(1);
        expect(vars.get("a")).toBe(1);
      });
    });

    // -----------------------------------------------------------------------
    // VariableStore — removeScope
    // -----------------------------------------------------------------------

    describe("removeScope", () => {
      it("should remove all variables for the scope", () => {
        store.setVariableLocal(3, "x", 42);
        store.setVariableLocal(3, "y", 99);
        store.removeScope(3);
        expect(store.getVariableLocal(3, "x")).toBeUndefined();
        expect(store.getVariableLocal(3, "y")).toBeUndefined();
      });

      it("should remove the parent link", () => {
        store.removeScope(3);
        expect(store.getParentScopeKey(3)).toBe(NO_PARENT);
      });

      it("should not affect other scopes", () => {
        store.setVariableLocal(2, "x", 10);
        store.removeScope(3);
        expect(store.getVariableLocal(2, "x")).toBe(10);
        expect(store.getParentScopeKey(2)).toBe(1);
      });
    });
  });

  // -------------------------------------------------------------------------
  // VariableBehavior — mergeLocal
  // -------------------------------------------------------------------------

  describe("VariableBehavior", () => {
    describe("mergeLocal", () => {
      it("should create variables at specified scope", () => {
        const events = behavior.mergeLocal(2, { x: 1, y: "hello" });

        expect(events).toHaveLength(2);
        expect(events[0]).toEqual({
          intent: VariableIntent.CREATED,
          scopeKey: 2,
          name: "x",
          value: 1,
        });
        expect(events[1]).toEqual({
          intent: VariableIntent.CREATED,
          scopeKey: 2,
          name: "y",
          value: "hello",
        });
        expect(store.getVariableLocal(2, "x")).toBe(1);
        expect(store.getVariableLocal(2, "y")).toBe("hello");
      });

      it("should update existing variable at scope", () => {
        store.setVariableLocal(2, "x", 1);

        const events = behavior.mergeLocal(2, { x: 2 });

        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({
          intent: VariableIntent.UPDATED,
          scopeKey: 2,
          name: "x",
          value: 2,
          oldValue: 1,
        });
        expect(store.getVariableLocal(2, "x")).toBe(2);
      });

      it("should not emit event when value is unchanged", () => {
        store.setVariableLocal(2, "x", 1);

        const events = behavior.mergeLocal(2, { x: 1 });

        expect(events).toHaveLength(0);
      });

      it("should NOT walk scope tree", () => {
        // given — variable exists at parent scope
        store.setVariableLocal(1, "x", 10);

        // when — merging into child scope
        const events = behavior.mergeLocal(2, { x: 20 });

        // then — creates at child scope, does NOT update parent
        expect(events).toHaveLength(1);
        expect(events[0].intent).toBe(VariableIntent.CREATED);
        expect(events[0].scopeKey).toBe(2);
        expect(store.getVariableLocal(1, "x")).toBe(10);
        expect(store.getVariableLocal(2, "x")).toBe(20);
      });

      it("should handle empty document", () => {
        const events = behavior.mergeLocal(2, {});
        expect(events).toHaveLength(0);
      });

      it("should handle null values", () => {
        const events = behavior.mergeLocal(2, { x: null });
        expect(events).toHaveLength(1);
        expect(events[0].value).toBeNull();
        expect(store.getVariableLocal(2, "x")).toBeNull();
      });

      it("should handle complex JSON values", () => {
        const complex = { nested: { key: [1, 2, 3] } };

        const events = behavior.mergeLocal(2, { data: complex });

        expect(events).toHaveLength(1);
        expect(events[0].value).toEqual(complex);
        expect(store.getVariableLocal(2, "data")).toEqual(complex);
      });
    });

    // -----------------------------------------------------------------------
    // VariableBehavior — mergeDocument
    // -----------------------------------------------------------------------

    describe("mergeDocument", () => {
      it("should create all variables at root when starting from root scope", () => {
        const events = behavior.mergeDocument(1, { a: 1, b: 2 });

        expect(events).toHaveLength(2);
        events.forEach((e) => {
          expect(e.intent).toBe(VariableIntent.CREATED);
          expect(e.scopeKey).toBe(1);
        });
      });

      it("should create new variables at root scope when not found in ancestors", () => {
        const events = behavior.mergeDocument(3, { x: 42 });

        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({
          intent: VariableIntent.CREATED,
          scopeKey: 1,
          name: "x",
          value: 42,
        });
        // Variable is at root, not at the starting scope
        expect(store.getVariableLocal(1, "x")).toBe(42);
        expect(store.getVariableLocal(2, "x")).toBeUndefined();
        expect(store.getVariableLocal(3, "x")).toBeUndefined();
      });

      it("should update existing variable at the scope where it is found", () => {
        store.setVariableLocal(2, "x", 10);

        const events = behavior.mergeDocument(3, { x: 20 });

        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({
          intent: VariableIntent.UPDATED,
          scopeKey: 2,
          name: "x",
          value: 20,
          oldValue: 10,
        });
        expect(store.getVariableLocal(2, "x")).toBe(20);
      });

      it("should update at closest scope when variable exists in multiple scopes", () => {
        // given — variable at both root and task scope
        store.setVariableLocal(1, "x", 10);
        store.setVariableLocal(3, "x", 30);

        // when — merging from task scope
        const events = behavior.mergeDocument(3, { x: 99 });

        // then — updates at task scope (closest), root unchanged
        expect(events).toHaveLength(1);
        expect(events[0].scopeKey).toBe(3);
        expect(events[0].intent).toBe(VariableIntent.UPDATED);
        expect(store.getVariableLocal(3, "x")).toBe(99);
        expect(store.getVariableLocal(1, "x")).toBe(10);
      });

      it("should handle mix of update and create", () => {
        store.setVariableLocal(2, "existing", "old");

        const events = behavior.mergeDocument(3, {
          existing: "new",
          fresh: 42,
        });

        expect(events).toHaveLength(2);

        const updateEvent = events.find((e) => e.name === "existing")!;
        expect(updateEvent.intent).toBe(VariableIntent.UPDATED);
        expect(updateEvent.scopeKey).toBe(2);
        expect(updateEvent.value).toBe("new");
        expect(updateEvent.oldValue).toBe("old");

        const createEvent = events.find((e) => e.name === "fresh")!;
        expect(createEvent.intent).toBe(VariableIntent.CREATED);
        expect(createEvent.scopeKey).toBe(1); // created at root
        expect(createEvent.value).toBe(42);
      });

      it("should not emit event when value is unchanged", () => {
        store.setVariableLocal(2, "x", 42);

        const events = behavior.mergeDocument(3, { x: 42 });

        expect(events).toHaveLength(0);
      });

      it("should handle empty document", () => {
        const events = behavior.mergeDocument(3, {});
        expect(events).toHaveLength(0);
      });

      it("should handle complex JSON values", () => {
        const complexValue = { nested: { key: [1, 2, 3] } };

        const events = behavior.mergeDocument(3, { data: complexValue });

        expect(events).toHaveLength(1);
        expect(events[0].value).toEqual(complexValue);
        expect(store.getVariable(3, "data")).toEqual(complexValue);
      });

      it("should update existing root variable (not create duplicate)", () => {
        store.setVariableLocal(1, "x", 10);

        const events = behavior.mergeDocument(1, { x: 20 });

        expect(events).toHaveLength(1);
        expect(events[0].intent).toBe(VariableIntent.UPDATED);
        expect(events[0].scopeKey).toBe(1);
        expect(store.getVariableLocal(1, "x")).toBe(20);
      });

      it("should detect changes in complex objects", () => {
        store.setVariableLocal(2, "obj", { a: 1 });

        const events = behavior.mergeDocument(3, { obj: { a: 2 } });

        expect(events).toHaveLength(1);
        expect(events[0].intent).toBe(VariableIntent.UPDATED);
        expect(events[0].oldValue).toEqual({ a: 1 });
        expect(events[0].value).toEqual({ a: 2 });
      });

      it("should handle null values", () => {
        const events = behavior.mergeDocument(3, { x: null });

        expect(events).toHaveLength(1);
        expect(events[0].intent).toBe(VariableIntent.CREATED);
        expect(events[0].value).toBeNull();
      });

      it("should update variables at multiple ancestor scopes in one merge", () => {
        // given — different variables at different scopes
        store.setVariableLocal(3, "local", "a");
        store.setVariableLocal(2, "mid", "b");

        // when — merging a document that touches both
        const events = behavior.mergeDocument(3, {
          local: "A",
          mid: "B",
          newVar: "C",
        });

        // then — each is updated at its scope, newVar created at root
        expect(events).toHaveLength(3);
        expect(events.find((e) => e.name === "local")!.scopeKey).toBe(3);
        expect(events.find((e) => e.name === "mid")!.scopeKey).toBe(2);
        expect(events.find((e) => e.name === "newVar")!.scopeKey).toBe(1);
      });
    });
  });

  // -------------------------------------------------------------------------
  // Deep equality (tested indirectly through merge behavior)
  // -------------------------------------------------------------------------

  describe("deep equality", () => {
    it("should consider equal primitive values as unchanged", () => {
      store.setVariableLocal(2, "num", 42);
      store.setVariableLocal(2, "str", "hello");
      store.setVariableLocal(2, "bool", true);

      const events = behavior.mergeLocal(2, {
        num: 42,
        str: "hello",
        bool: true,
      });
      expect(events).toHaveLength(0);
    });

    it("should consider equal objects as unchanged", () => {
      store.setVariableLocal(2, "obj", { a: 1, b: [2, 3] });

      const events = behavior.mergeLocal(2, { obj: { a: 1, b: [2, 3] } });

      expect(events).toHaveLength(0);
    });

    it("should detect array length changes", () => {
      store.setVariableLocal(2, "arr", [1, 2]);

      const events = behavior.mergeLocal(2, { arr: [1, 2, 3] });

      expect(events).toHaveLength(1);
    });

    it("should detect nested object changes", () => {
      store.setVariableLocal(2, "nested", { a: { b: { c: 1 } } });

      const events = behavior.mergeLocal(2, {
        nested: { a: { b: { c: 2 } } },
      });

      expect(events).toHaveLength(1);
    });

    it("should detect null vs object difference", () => {
      store.setVariableLocal(2, "x", null);

      const events = behavior.mergeLocal(2, { x: {} });

      expect(events).toHaveLength(1);
    });

    it("should detect type changes (number to string)", () => {
      store.setVariableLocal(2, "x", 42);

      const events = behavior.mergeLocal(2, { x: "42" });

      expect(events).toHaveLength(1);
    });

    it("should consider empty objects as equal", () => {
      store.setVariableLocal(2, "x", {});

      const events = behavior.mergeLocal(2, { x: {} });

      expect(events).toHaveLength(0);
    });

    it("should consider empty arrays as equal", () => {
      store.setVariableLocal(2, "x", []);

      const events = behavior.mergeLocal(2, { x: [] });

      expect(events).toHaveLength(0);
    });

    it("should detect object key count difference", () => {
      store.setVariableLocal(2, "x", { a: 1 });

      const events = behavior.mergeLocal(2, { x: { a: 1, b: 2 } });

      expect(events).toHaveLength(1);
    });
  });
});
