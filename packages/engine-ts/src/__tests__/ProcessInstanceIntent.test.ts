/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import { describe, expect, it } from "vitest";
import {
  ProcessInstanceIntent,
  isProcessInstanceCommand,
  isBpmnElementCommand,
  isBpmnElementEvent,
  isEvent,
} from "../intent/ProcessInstanceIntent.js";

describe("ProcessInstanceIntent", () => {
  describe("isProcessInstanceCommand", () => {
    it("should classify CANCEL as a process instance command", () => {
      expect(isProcessInstanceCommand(ProcessInstanceIntent.CANCEL)).toBe(true);
    });

    it("should not classify lifecycle events as process instance commands", () => {
      expect(
        isProcessInstanceCommand(ProcessInstanceIntent.ELEMENT_ACTIVATING)
      ).toBe(false);
      expect(
        isProcessInstanceCommand(ProcessInstanceIntent.ELEMENT_ACTIVATED)
      ).toBe(false);
    });

    it("should not classify element commands as process instance commands", () => {
      expect(
        isProcessInstanceCommand(ProcessInstanceIntent.ACTIVATE_ELEMENT)
      ).toBe(false);
    });
  });

  describe("isBpmnElementCommand", () => {
    it("should classify ACTIVATE_ELEMENT as a BPMN element command", () => {
      expect(
        isBpmnElementCommand(ProcessInstanceIntent.ACTIVATE_ELEMENT)
      ).toBe(true);
    });

    it("should classify COMPLETE_ELEMENT as a BPMN element command", () => {
      expect(
        isBpmnElementCommand(ProcessInstanceIntent.COMPLETE_ELEMENT)
      ).toBe(true);
    });

    it("should classify TERMINATE_ELEMENT as a BPMN element command", () => {
      expect(
        isBpmnElementCommand(ProcessInstanceIntent.TERMINATE_ELEMENT)
      ).toBe(true);
    });

    it("should classify COMPLETE_EXECUTION_LISTENER as a BPMN element command", () => {
      expect(
        isBpmnElementCommand(ProcessInstanceIntent.COMPLETE_EXECUTION_LISTENER)
      ).toBe(true);
    });

    it("should classify CONTINUE_TERMINATING_ELEMENT as a BPMN element command", () => {
      expect(
        isBpmnElementCommand(
          ProcessInstanceIntent.CONTINUE_TERMINATING_ELEMENT
        )
      ).toBe(true);
    });

    it("should not classify lifecycle events as element commands", () => {
      expect(
        isBpmnElementCommand(ProcessInstanceIntent.ELEMENT_ACTIVATING)
      ).toBe(false);
    });

    it("should not classify CANCEL as an element command", () => {
      expect(isBpmnElementCommand(ProcessInstanceIntent.CANCEL)).toBe(false);
    });
  });

  describe("isBpmnElementEvent", () => {
    it("should classify all 6 lifecycle states as element events", () => {
      const lifecycleStates = [
        ProcessInstanceIntent.ELEMENT_ACTIVATING,
        ProcessInstanceIntent.ELEMENT_ACTIVATED,
        ProcessInstanceIntent.ELEMENT_COMPLETING,
        ProcessInstanceIntent.ELEMENT_COMPLETED,
        ProcessInstanceIntent.ELEMENT_TERMINATING,
        ProcessInstanceIntent.ELEMENT_TERMINATED,
      ];
      for (const state of lifecycleStates) {
        expect(isBpmnElementEvent(state)).toBe(true);
      }
    });

    it("should classify SEQUENCE_FLOW_TAKEN as an element event", () => {
      expect(
        isBpmnElementEvent(ProcessInstanceIntent.SEQUENCE_FLOW_TAKEN)
      ).toBe(true);
    });

    it("should classify migration intents as element events", () => {
      expect(
        isBpmnElementEvent(ProcessInstanceIntent.ELEMENT_MIGRATED)
      ).toBe(true);
      expect(
        isBpmnElementEvent(ProcessInstanceIntent.ANCESTOR_MIGRATED)
      ).toBe(true);
    });

    it("should not classify CANCEL as an element event", () => {
      expect(isBpmnElementEvent(ProcessInstanceIntent.CANCEL)).toBe(false);
    });

    it("should not classify element commands as element events", () => {
      expect(
        isBpmnElementEvent(ProcessInstanceIntent.ACTIVATE_ELEMENT)
      ).toBe(false);
    });
  });

  describe("isEvent", () => {
    it("should return true for all events (not commands)", () => {
      expect(isEvent(ProcessInstanceIntent.ELEMENT_ACTIVATING)).toBe(true);
      expect(isEvent(ProcessInstanceIntent.SEQUENCE_FLOW_TAKEN)).toBe(true);
      expect(isEvent(ProcessInstanceIntent.CANCELING)).toBe(true);
    });

    it("should return false for commands", () => {
      expect(isEvent(ProcessInstanceIntent.CANCEL)).toBe(false);
      expect(isEvent(ProcessInstanceIntent.ACTIVATE_ELEMENT)).toBe(false);
      expect(isEvent(ProcessInstanceIntent.COMPLETE_ELEMENT)).toBe(false);
      expect(isEvent(ProcessInstanceIntent.TERMINATE_ELEMENT)).toBe(false);
    });
  });
});
