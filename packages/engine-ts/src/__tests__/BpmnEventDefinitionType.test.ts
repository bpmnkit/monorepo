/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import { describe, expect, it } from "vitest";
import {
  BpmnEventDefinitionType,
  isWaitState,
  isPassthrough,
} from "../event/BpmnEventDefinitionType.js";

describe("BpmnEventDefinitionType", () => {
  it("should have all expected enum values", () => {
    expect(BpmnEventDefinitionType.NONE).toBe("NONE");
    expect(BpmnEventDefinitionType.MESSAGE).toBe("MESSAGE");
    expect(BpmnEventDefinitionType.TIMER).toBe("TIMER");
    expect(BpmnEventDefinitionType.ERROR).toBe("ERROR");
    expect(BpmnEventDefinitionType.ESCALATION).toBe("ESCALATION");
    expect(BpmnEventDefinitionType.SIGNAL).toBe("SIGNAL");
    expect(BpmnEventDefinitionType.LINK).toBe("LINK");
    expect(BpmnEventDefinitionType.TERMINATE).toBe("TERMINATE");
    expect(BpmnEventDefinitionType.COMPENSATION).toBe("COMPENSATION");
  });

  describe("isWaitState", () => {
    it("should return true for MESSAGE", () => {
      expect(isWaitState(BpmnEventDefinitionType.MESSAGE)).toBe(true);
    });

    it("should return true for TIMER", () => {
      expect(isWaitState(BpmnEventDefinitionType.TIMER)).toBe(true);
    });

    it("should return true for SIGNAL", () => {
      expect(isWaitState(BpmnEventDefinitionType.SIGNAL)).toBe(true);
    });

    it("should return false for NONE", () => {
      expect(isWaitState(BpmnEventDefinitionType.NONE)).toBe(false);
    });

    it("should return false for ERROR", () => {
      expect(isWaitState(BpmnEventDefinitionType.ERROR)).toBe(false);
    });

    it("should return false for LINK", () => {
      expect(isWaitState(BpmnEventDefinitionType.LINK)).toBe(false);
    });
  });

  describe("isPassthrough", () => {
    it("should return true for NONE", () => {
      expect(isPassthrough(BpmnEventDefinitionType.NONE)).toBe(true);
    });

    it("should return true for LINK", () => {
      expect(isPassthrough(BpmnEventDefinitionType.LINK)).toBe(true);
    });

    it("should return true for TERMINATE", () => {
      expect(isPassthrough(BpmnEventDefinitionType.TERMINATE)).toBe(true);
    });

    it("should return true for COMPENSATION", () => {
      expect(isPassthrough(BpmnEventDefinitionType.COMPENSATION)).toBe(true);
    });

    it("should return false for MESSAGE", () => {
      expect(isPassthrough(BpmnEventDefinitionType.MESSAGE)).toBe(false);
    });

    it("should return false for TIMER", () => {
      expect(isPassthrough(BpmnEventDefinitionType.TIMER)).toBe(false);
    });

    it("should return false for ERROR", () => {
      expect(isPassthrough(BpmnEventDefinitionType.ERROR)).toBe(false);
    });
  });
});
