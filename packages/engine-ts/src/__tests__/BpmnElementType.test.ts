/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import { describe, expect, it } from "vitest";
import {
  BpmnElementType,
  getElementTypeName,
  isContainerType,
  isTaskType,
  isGatewayType,
  isEventType,
  isFlowNode,
} from "../types/BpmnElementType.js";

describe("BpmnElementType", () => {
  it("should have 26 element types", () => {
    const values = Object.values(BpmnElementType);
    expect(values).toHaveLength(26);
  });

  describe("getElementTypeName", () => {
    it("should return BPMN XML name for PROCESS", () => {
      expect(getElementTypeName(BpmnElementType.PROCESS)).toBe("process");
    });

    it("should return BPMN XML name for SERVICE_TASK", () => {
      expect(getElementTypeName(BpmnElementType.SERVICE_TASK)).toBe(
        "serviceTask"
      );
    });

    it("should return BPMN XML name for EXCLUSIVE_GATEWAY", () => {
      expect(getElementTypeName(BpmnElementType.EXCLUSIVE_GATEWAY)).toBe(
        "exclusiveGateway"
      );
    });

    it("should return BPMN XML name for START_EVENT", () => {
      expect(getElementTypeName(BpmnElementType.START_EVENT)).toBe(
        "startEvent"
      );
    });

    it("should return BPMN XML name for SEQUENCE_FLOW", () => {
      expect(getElementTypeName(BpmnElementType.SEQUENCE_FLOW)).toBe(
        "sequenceFlow"
      );
    });

    it("should return BPMN XML name for CALL_ACTIVITY", () => {
      expect(getElementTypeName(BpmnElementType.CALL_ACTIVITY)).toBe(
        "callActivity"
      );
    });

    it("should return undefined for MULTI_INSTANCE_BODY", () => {
      expect(
        getElementTypeName(BpmnElementType.MULTI_INSTANCE_BODY)
      ).toBeUndefined();
    });

    it("should return undefined for UNSPECIFIED", () => {
      expect(getElementTypeName(BpmnElementType.UNSPECIFIED)).toBeUndefined();
    });

    it("should return undefined for AD_HOC_SUB_PROCESS_INNER_INSTANCE", () => {
      expect(
        getElementTypeName(BpmnElementType.AD_HOC_SUB_PROCESS_INNER_INSTANCE)
      ).toBeUndefined();
    });

    it("should map EVENT_SUB_PROCESS to subProcess", () => {
      expect(getElementTypeName(BpmnElementType.EVENT_SUB_PROCESS)).toBe(
        "subProcess"
      );
    });
  });

  describe("isContainerType", () => {
    it.each([
      BpmnElementType.PROCESS,
      BpmnElementType.SUB_PROCESS,
      BpmnElementType.EVENT_SUB_PROCESS,
      BpmnElementType.AD_HOC_SUB_PROCESS,
      BpmnElementType.AD_HOC_SUB_PROCESS_INNER_INSTANCE,
      BpmnElementType.MULTI_INSTANCE_BODY,
    ])("should return true for container type %s", (type) => {
      expect(isContainerType(type)).toBe(true);
    });

    it.each([
      BpmnElementType.SERVICE_TASK,
      BpmnElementType.EXCLUSIVE_GATEWAY,
      BpmnElementType.START_EVENT,
      BpmnElementType.SEQUENCE_FLOW,
      BpmnElementType.CALL_ACTIVITY,
      BpmnElementType.UNSPECIFIED,
    ])("should return false for non-container type %s", (type) => {
      expect(isContainerType(type)).toBe(false);
    });
  });

  describe("isTaskType", () => {
    it.each([
      BpmnElementType.SERVICE_TASK,
      BpmnElementType.RECEIVE_TASK,
      BpmnElementType.USER_TASK,
      BpmnElementType.MANUAL_TASK,
      BpmnElementType.TASK,
      BpmnElementType.BUSINESS_RULE_TASK,
      BpmnElementType.SCRIPT_TASK,
      BpmnElementType.SEND_TASK,
    ])("should return true for task type %s", (type) => {
      expect(isTaskType(type)).toBe(true);
    });

    it.each([
      BpmnElementType.PROCESS,
      BpmnElementType.EXCLUSIVE_GATEWAY,
      BpmnElementType.START_EVENT,
    ])("should return false for non-task type %s", (type) => {
      expect(isTaskType(type)).toBe(false);
    });
  });

  describe("isGatewayType", () => {
    it.each([
      BpmnElementType.EXCLUSIVE_GATEWAY,
      BpmnElementType.PARALLEL_GATEWAY,
      BpmnElementType.EVENT_BASED_GATEWAY,
      BpmnElementType.INCLUSIVE_GATEWAY,
    ])("should return true for gateway type %s", (type) => {
      expect(isGatewayType(type)).toBe(true);
    });

    it("should return false for SERVICE_TASK", () => {
      expect(isGatewayType(BpmnElementType.SERVICE_TASK)).toBe(false);
    });
  });

  describe("isEventType", () => {
    it.each([
      BpmnElementType.START_EVENT,
      BpmnElementType.INTERMEDIATE_CATCH_EVENT,
      BpmnElementType.INTERMEDIATE_THROW_EVENT,
      BpmnElementType.BOUNDARY_EVENT,
      BpmnElementType.END_EVENT,
    ])("should return true for event type %s", (type) => {
      expect(isEventType(type)).toBe(true);
    });

    it("should return false for SERVICE_TASK", () => {
      expect(isEventType(BpmnElementType.SERVICE_TASK)).toBe(false);
    });
  });

  describe("isFlowNode", () => {
    it("should return false for SEQUENCE_FLOW", () => {
      expect(isFlowNode(BpmnElementType.SEQUENCE_FLOW)).toBe(false);
    });

    it("should return false for UNSPECIFIED", () => {
      expect(isFlowNode(BpmnElementType.UNSPECIFIED)).toBe(false);
    });

    it.each([
      BpmnElementType.SERVICE_TASK,
      BpmnElementType.PROCESS,
      BpmnElementType.EXCLUSIVE_GATEWAY,
      BpmnElementType.START_EVENT,
      BpmnElementType.CALL_ACTIVITY,
      BpmnElementType.MULTI_INSTANCE_BODY,
    ])("should return true for flow node type %s", (type) => {
      expect(isFlowNode(type)).toBe(true);
    });
  });
});
