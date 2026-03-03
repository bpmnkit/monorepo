/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import { describe, expect, it } from "vitest";
import { ProcessInstanceIntent } from "../intent/ProcessInstanceIntent.js";
import {
  canTransition,
  isFinalState,
  isInitialState,
  isElementInstanceState,
  isTokenState,
  canTerminate,
  isActive,
  isTerminating,
} from "../lifecycle/ProcessInstanceLifecycle.js";

const {
  ELEMENT_ACTIVATING,
  ELEMENT_ACTIVATED,
  ELEMENT_COMPLETING,
  ELEMENT_COMPLETED,
  ELEMENT_TERMINATING,
  ELEMENT_TERMINATED,
  SEQUENCE_FLOW_TAKEN,
  CANCEL,
} = ProcessInstanceIntent;

describe("ProcessInstanceLifecycle", () => {
  describe("canTransition", () => {
    // --- ELEMENT_ACTIVATING transitions ---
    it("should allow ACTIVATING → ACTIVATED", () => {
      expect(canTransition(ELEMENT_ACTIVATING, ELEMENT_ACTIVATED)).toBe(true);
    });

    it("should allow ACTIVATING → TERMINATING", () => {
      expect(canTransition(ELEMENT_ACTIVATING, ELEMENT_TERMINATING)).toBe(true);
    });

    it("should not allow ACTIVATING → COMPLETING", () => {
      expect(canTransition(ELEMENT_ACTIVATING, ELEMENT_COMPLETING)).toBe(false);
    });

    it("should not allow ACTIVATING → COMPLETED", () => {
      expect(canTransition(ELEMENT_ACTIVATING, ELEMENT_COMPLETED)).toBe(false);
    });

    // --- ELEMENT_ACTIVATED transitions ---
    it("should allow ACTIVATED → COMPLETING", () => {
      expect(canTransition(ELEMENT_ACTIVATED, ELEMENT_COMPLETING)).toBe(true);
    });

    it("should allow ACTIVATED → TERMINATING", () => {
      expect(canTransition(ELEMENT_ACTIVATED, ELEMENT_TERMINATING)).toBe(true);
    });

    it("should not allow ACTIVATED → COMPLETED", () => {
      expect(canTransition(ELEMENT_ACTIVATED, ELEMENT_COMPLETED)).toBe(false);
    });

    it("should not allow ACTIVATED → ACTIVATING", () => {
      expect(canTransition(ELEMENT_ACTIVATED, ELEMENT_ACTIVATING)).toBe(false);
    });

    // --- ELEMENT_COMPLETING transitions ---
    it("should allow COMPLETING → COMPLETED", () => {
      expect(canTransition(ELEMENT_COMPLETING, ELEMENT_COMPLETED)).toBe(true);
    });

    it("should allow COMPLETING → TERMINATING", () => {
      expect(canTransition(ELEMENT_COMPLETING, ELEMENT_TERMINATING)).toBe(true);
    });

    it("should not allow COMPLETING → ACTIVATED", () => {
      expect(canTransition(ELEMENT_COMPLETING, ELEMENT_ACTIVATED)).toBe(false);
    });

    // --- ELEMENT_TERMINATING transitions ---
    it("should allow TERMINATING → TERMINATED", () => {
      expect(canTransition(ELEMENT_TERMINATING, ELEMENT_TERMINATED)).toBe(true);
    });

    it("should not allow TERMINATING → COMPLETED", () => {
      expect(canTransition(ELEMENT_TERMINATING, ELEMENT_COMPLETED)).toBe(false);
    });

    it("should not allow TERMINATING → ACTIVATING", () => {
      expect(canTransition(ELEMENT_TERMINATING, ELEMENT_ACTIVATING)).toBe(
        false
      );
    });

    // --- ELEMENT_COMPLETED transitions ---
    it("should allow COMPLETED → SEQUENCE_FLOW_TAKEN", () => {
      expect(canTransition(ELEMENT_COMPLETED, SEQUENCE_FLOW_TAKEN)).toBe(true);
    });

    it("should not allow COMPLETED → ACTIVATING", () => {
      expect(canTransition(ELEMENT_COMPLETED, ELEMENT_ACTIVATING)).toBe(false);
    });

    // --- ELEMENT_TERMINATED transitions (final — no outgoing transitions) ---
    it("should not allow TERMINATED → anything", () => {
      expect(canTransition(ELEMENT_TERMINATED, ELEMENT_ACTIVATING)).toBe(false);
      expect(canTransition(ELEMENT_TERMINATED, ELEMENT_ACTIVATED)).toBe(false);
      expect(canTransition(ELEMENT_TERMINATED, ELEMENT_COMPLETING)).toBe(false);
      expect(canTransition(ELEMENT_TERMINATED, ELEMENT_COMPLETED)).toBe(false);
      expect(canTransition(ELEMENT_TERMINATED, ELEMENT_TERMINATING)).toBe(
        false
      );
      expect(canTransition(ELEMENT_TERMINATED, ELEMENT_TERMINATED)).toBe(false);
    });

    // --- SEQUENCE_FLOW_TAKEN transitions ---
    it("should allow SEQUENCE_FLOW_TAKEN → ACTIVATING", () => {
      expect(canTransition(SEQUENCE_FLOW_TAKEN, ELEMENT_ACTIVATING)).toBe(true);
    });

    it("should not allow SEQUENCE_FLOW_TAKEN → ACTIVATED", () => {
      expect(canTransition(SEQUENCE_FLOW_TAKEN, ELEMENT_ACTIVATED)).toBe(false);
    });

    // --- Invalid from-state ---
    it("should throw for unrecognized from-state", () => {
      expect(() => canTransition(CANCEL, ELEMENT_ACTIVATING)).toThrow(
        "not a recognized lifecycle state"
      );
    });
  });

  describe("isFinalState", () => {
    it("should return true for COMPLETED", () => {
      expect(isFinalState(ELEMENT_COMPLETED)).toBe(true);
    });

    it("should return true for TERMINATED", () => {
      expect(isFinalState(ELEMENT_TERMINATED)).toBe(true);
    });

    it("should return false for non-final states", () => {
      expect(isFinalState(ELEMENT_ACTIVATING)).toBe(false);
      expect(isFinalState(ELEMENT_ACTIVATED)).toBe(false);
      expect(isFinalState(ELEMENT_COMPLETING)).toBe(false);
      expect(isFinalState(ELEMENT_TERMINATING)).toBe(false);
    });
  });

  describe("isInitialState", () => {
    it("should return true for ACTIVATING", () => {
      expect(isInitialState(ELEMENT_ACTIVATING)).toBe(true);
    });

    it("should return false for non-initial states", () => {
      expect(isInitialState(ELEMENT_ACTIVATED)).toBe(false);
      expect(isInitialState(ELEMENT_COMPLETED)).toBe(false);
      expect(isInitialState(ELEMENT_TERMINATED)).toBe(false);
    });
  });

  describe("isElementInstanceState", () => {
    it("should return true for all 6 element instance states", () => {
      const states = [
        ELEMENT_ACTIVATING,
        ELEMENT_ACTIVATED,
        ELEMENT_COMPLETING,
        ELEMENT_COMPLETED,
        ELEMENT_TERMINATING,
        ELEMENT_TERMINATED,
      ];
      for (const state of states) {
        expect(isElementInstanceState(state)).toBe(true);
      }
    });

    it("should return false for token states", () => {
      expect(isElementInstanceState(SEQUENCE_FLOW_TAKEN)).toBe(false);
    });

    it("should return false for commands", () => {
      expect(isElementInstanceState(CANCEL)).toBe(false);
    });
  });

  describe("isTokenState", () => {
    it("should return true for SEQUENCE_FLOW_TAKEN", () => {
      expect(isTokenState(SEQUENCE_FLOW_TAKEN)).toBe(true);
    });

    it("should return false for element instance states", () => {
      expect(isTokenState(ELEMENT_ACTIVATING)).toBe(false);
      expect(isTokenState(ELEMENT_TERMINATED)).toBe(false);
    });
  });

  describe("canTerminate", () => {
    it("should return true for terminatable states", () => {
      expect(canTerminate(ELEMENT_ACTIVATING)).toBe(true);
      expect(canTerminate(ELEMENT_ACTIVATED)).toBe(true);
      expect(canTerminate(ELEMENT_COMPLETING)).toBe(true);
    });

    it("should return false for non-terminatable states", () => {
      expect(canTerminate(ELEMENT_COMPLETED)).toBe(false);
      expect(canTerminate(ELEMENT_TERMINATING)).toBe(false);
      expect(canTerminate(ELEMENT_TERMINATED)).toBe(false);
    });
  });

  describe("isActive", () => {
    it("should return true only for ACTIVATED", () => {
      expect(isActive(ELEMENT_ACTIVATED)).toBe(true);
    });

    it("should return false for other states", () => {
      expect(isActive(ELEMENT_ACTIVATING)).toBe(false);
      expect(isActive(ELEMENT_COMPLETING)).toBe(false);
      expect(isActive(ELEMENT_TERMINATING)).toBe(false);
    });
  });

  describe("isTerminating", () => {
    it("should return true only for TERMINATING", () => {
      expect(isTerminating(ELEMENT_TERMINATING)).toBe(true);
    });

    it("should return false for other states", () => {
      expect(isTerminating(ELEMENT_ACTIVATING)).toBe(false);
      expect(isTerminating(ELEMENT_ACTIVATED)).toBe(false);
      expect(isTerminating(ELEMENT_TERMINATED)).toBe(false);
    });
  });
});
