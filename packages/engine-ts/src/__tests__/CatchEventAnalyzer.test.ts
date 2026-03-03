/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import { describe, expect, it, beforeEach } from "vitest";
import {
  CatchEventAnalyzer,
  type ElementInstanceLookup,
  type ElementInstanceRecord,
  type ProcessModelLookup,
} from "../error/CatchEventAnalyzer.js";
import { BpmnEventDefinitionType } from "../event/BpmnEventDefinitionType.js";
import type { BpmnEventElement } from "../event/BpmnEventElement.js";
import type { BpmnElementContext } from "../processor/BpmnElementContext.js";
import { ErrorType } from "../processor/Failure.js";
import { isLeft, isRight } from "../types/Either.js";
import { NO_PARENT } from "../state/VariableState.js";

// --- Test Helpers ---

function makeContext(
  overrides?: Partial<BpmnElementContext>
): BpmnElementContext {
  return {
    elementInstanceKey: 10,
    flowScopeKey: 1,
    processInstanceKey: 100,
    processDefinitionKey: 200,
    elementId: "Task_1",
    bpmnProcessId: "test-process",
    ...overrides,
  };
}

function makeEvent(
  overrides?: Partial<BpmnEventElement>
): BpmnEventElement {
  return {
    elementId: "BoundaryEvent_1",
    eventDefinitionType: BpmnEventDefinitionType.ERROR,
    interrupting: true,
    ...overrides,
  };
}

function makeInstance(
  key: number,
  elementId: string,
  flowScopeKey: number
): ElementInstanceRecord {
  return { elementInstanceKey: key, elementId, flowScopeKey };
}

/**
 * Simple in-memory implementations of the lookup interfaces for testing.
 */
function makeLookups(config: {
  instances: Map<number, ElementInstanceRecord>;
  boundaryEvents: Map<string, BpmnEventElement[]>;
  espStartEvents?: Map<string, BpmnEventElement[]>;
}): { model: ProcessModelLookup; state: ElementInstanceLookup } {
  return {
    model: {
      getBoundaryEvents: (id) => config.boundaryEvents.get(id) ?? [],
      getEventSubProcessStartEvents: (id) =>
        config.espStartEvents?.get(id) ?? [],
    },
    state: {
      getInstance: (key) => config.instances.get(key),
    },
  };
}

// --- Tests ---

describe("CatchEventAnalyzer", () => {
  describe("findErrorCatchEvent", () => {
    describe("CodeSpecificMatch", () => {
      it("should find error boundary event with matching error code", () => {
        // given
        // Process (key=1) → Task_1 (key=10) throws ERR_PAYMENT
        // Task_1 has a boundary event catching ERR_PAYMENT
        const errorBoundary = makeEvent({
          elementId: "ErrorBoundary_1",
          errorCode: "ERR_PAYMENT",
        });
        const { model, state } = makeLookups({
          instances: new Map([
            [1, makeInstance(1, "Process_1", NO_PARENT)],
          ]),
          boundaryEvents: new Map([["Process_1", [errorBoundary]]]),
        });
        const analyzer = new CatchEventAnalyzer(model, state);
        const context = makeContext({ flowScopeKey: 1 });

        // when
        const result = analyzer.findErrorCatchEvent("ERR_PAYMENT", context);

        // then
        expect(isRight(result)).toBe(true);
        if (isRight(result)) {
          expect(result.value.catchEvent).toBe(errorBoundary);
          expect(result.value.elementInstanceKey).toBe(1);
          expect(result.value.catchScopeElementId).toBe("Process_1");
        }
      });

      it("should not match boundary event with different error code", () => {
        // given
        const errorBoundary = makeEvent({
          elementId: "ErrorBoundary_1",
          errorCode: "ERR_INVENTORY",
        });
        const { model, state } = makeLookups({
          instances: new Map([
            [1, makeInstance(1, "Process_1", NO_PARENT)],
          ]),
          boundaryEvents: new Map([["Process_1", [errorBoundary]]]),
        });
        const analyzer = new CatchEventAnalyzer(model, state);
        const context = makeContext({ flowScopeKey: 1 });

        // when
        const result = analyzer.findErrorCatchEvent("ERR_PAYMENT", context);

        // then
        expect(isLeft(result)).toBe(true);
      });
    });

    describe("CatchAllMatch", () => {
      it("should find catch-all error boundary event when no code-specific match", () => {
        // given
        const catchAllBoundary = makeEvent({
          elementId: "ErrorBoundary_CatchAll",
          // no errorCode — catches all errors
        });
        const { model, state } = makeLookups({
          instances: new Map([
            [1, makeInstance(1, "Process_1", NO_PARENT)],
          ]),
          boundaryEvents: new Map([["Process_1", [catchAllBoundary]]]),
        });
        const analyzer = new CatchEventAnalyzer(model, state);
        const context = makeContext({ flowScopeKey: 1 });

        // when
        const result = analyzer.findErrorCatchEvent("ANY_ERROR", context);

        // then
        expect(isRight(result)).toBe(true);
        if (isRight(result)) {
          expect(result.value.catchEvent).toBe(catchAllBoundary);
        }
      });

      it("should treat empty string error code as catch-all", () => {
        // given
        const catchAllBoundary = makeEvent({
          elementId: "ErrorBoundary_Empty",
          errorCode: "",
        });
        const { model, state } = makeLookups({
          instances: new Map([
            [1, makeInstance(1, "Process_1", NO_PARENT)],
          ]),
          boundaryEvents: new Map([["Process_1", [catchAllBoundary]]]),
        });
        const analyzer = new CatchEventAnalyzer(model, state);
        const context = makeContext({ flowScopeKey: 1 });

        // when
        const result = analyzer.findErrorCatchEvent("SOME_ERROR", context);

        // then
        expect(isRight(result)).toBe(true);
        if (isRight(result)) {
          expect(result.value.catchEvent).toBe(catchAllBoundary);
        }
      });
    });

    describe("Priority", () => {
      it("should prioritize code-specific over catch-all at same scope", () => {
        // given
        const catchAllBoundary = makeEvent({
          elementId: "ErrorBoundary_CatchAll",
          // no errorCode
        });
        const specificBoundary = makeEvent({
          elementId: "ErrorBoundary_Specific",
          errorCode: "ERR_PAYMENT",
        });
        const { model, state } = makeLookups({
          instances: new Map([
            [1, makeInstance(1, "SubProcess_1", NO_PARENT)],
          ]),
          boundaryEvents: new Map([
            ["SubProcess_1", [catchAllBoundary, specificBoundary]],
          ]),
        });
        const analyzer = new CatchEventAnalyzer(model, state);
        const context = makeContext({ flowScopeKey: 1 });

        // when
        const result = analyzer.findErrorCatchEvent("ERR_PAYMENT", context);

        // then
        expect(isRight(result)).toBe(true);
        if (isRight(result)) {
          expect(result.value.catchEvent).toBe(specificBoundary);
          expect(result.value.catchEvent.errorCode).toBe("ERR_PAYMENT");
        }
      });

      it("should fall back to catch-all when code does not match specific", () => {
        // given
        const catchAllBoundary = makeEvent({
          elementId: "ErrorBoundary_CatchAll",
        });
        const specificBoundary = makeEvent({
          elementId: "ErrorBoundary_Specific",
          errorCode: "ERR_INVENTORY",
        });
        const { model, state } = makeLookups({
          instances: new Map([
            [1, makeInstance(1, "SubProcess_1", NO_PARENT)],
          ]),
          boundaryEvents: new Map([
            ["SubProcess_1", [catchAllBoundary, specificBoundary]],
          ]),
        });
        const analyzer = new CatchEventAnalyzer(model, state);
        const context = makeContext({ flowScopeKey: 1 });

        // when
        const result = analyzer.findErrorCatchEvent("ERR_PAYMENT", context);

        // then
        expect(isRight(result)).toBe(true);
        if (isRight(result)) {
          expect(result.value.catchEvent).toBe(catchAllBoundary);
        }
      });
    });

    describe("ScopeChainWalking", () => {
      it("should walk up scope chain to find error catch event", () => {
        // given
        // Process (key=1) → SubProcess (key=2) → Task (key=10, throws error)
        // Error boundary is on Process_1, not SubProcess_1
        const errorBoundary = makeEvent({
          elementId: "ErrorBoundary_OnProcess",
          errorCode: "ERR_PAYMENT",
        });
        const { model, state } = makeLookups({
          instances: new Map([
            [1, makeInstance(1, "Process_1", NO_PARENT)],
            [2, makeInstance(2, "SubProcess_1", 1)],
          ]),
          boundaryEvents: new Map([
            ["SubProcess_1", []], // no boundary events on sub-process
            ["Process_1", [errorBoundary]], // boundary on process
          ]),
        });
        const analyzer = new CatchEventAnalyzer(model, state);
        const context = makeContext({
          elementInstanceKey: 10,
          flowScopeKey: 2,
        });

        // when
        const result = analyzer.findErrorCatchEvent("ERR_PAYMENT", context);

        // then
        expect(isRight(result)).toBe(true);
        if (isRight(result)) {
          expect(result.value.catchEvent).toBe(errorBoundary);
          expect(result.value.elementInstanceKey).toBe(1);
          expect(result.value.catchScopeElementId).toBe("Process_1");
        }
      });

      it("should find innermost matching scope first", () => {
        // given
        // Process (key=1) → SubProcess (key=2) → Task (key=10)
        // Both scopes have error boundary events
        const outerBoundary = makeEvent({
          elementId: "ErrorBoundary_Outer",
          errorCode: "ERR_PAYMENT",
        });
        const innerBoundary = makeEvent({
          elementId: "ErrorBoundary_Inner",
          errorCode: "ERR_PAYMENT",
        });
        const { model, state } = makeLookups({
          instances: new Map([
            [1, makeInstance(1, "Process_1", NO_PARENT)],
            [2, makeInstance(2, "SubProcess_1", 1)],
          ]),
          boundaryEvents: new Map([
            ["SubProcess_1", [innerBoundary]],
            ["Process_1", [outerBoundary]],
          ]),
        });
        const analyzer = new CatchEventAnalyzer(model, state);
        const context = makeContext({ flowScopeKey: 2 });

        // when
        const result = analyzer.findErrorCatchEvent("ERR_PAYMENT", context);

        // then
        expect(isRight(result)).toBe(true);
        if (isRight(result)) {
          expect(result.value.catchEvent).toBe(innerBoundary);
          expect(result.value.elementInstanceKey).toBe(2);
        }
      });
    });

    describe("EventSubProcess", () => {
      it("should find error catch in event sub-process start event", () => {
        // given
        const espStartEvent = makeEvent({
          elementId: "ESPStartEvent_1",
          eventDefinitionType: BpmnEventDefinitionType.ERROR,
          errorCode: "ERR_PAYMENT",
          interrupting: true,
        });
        const { model, state } = makeLookups({
          instances: new Map([
            [1, makeInstance(1, "Process_1", NO_PARENT)],
          ]),
          boundaryEvents: new Map(),
          espStartEvents: new Map([["Process_1", [espStartEvent]]]),
        });
        const analyzer = new CatchEventAnalyzer(model, state);
        const context = makeContext({ flowScopeKey: 1 });

        // when
        const result = analyzer.findErrorCatchEvent("ERR_PAYMENT", context);

        // then
        expect(isRight(result)).toBe(true);
        if (isRight(result)) {
          expect(result.value.catchEvent).toBe(espStartEvent);
          expect(result.value.catchScopeElementId).toBe("Process_1");
        }
      });

      it("should prioritize boundary event over event sub-process at same scope", () => {
        // given
        // Both a boundary event and an ESP start event at the same scope
        const boundaryEvent = makeEvent({
          elementId: "ErrorBoundary_1",
          errorCode: "ERR_PAYMENT",
        });
        const espStartEvent = makeEvent({
          elementId: "ESPStartEvent_1",
          errorCode: "ERR_PAYMENT",
        });
        const { model, state } = makeLookups({
          instances: new Map([
            [1, makeInstance(1, "Process_1", NO_PARENT)],
          ]),
          boundaryEvents: new Map([["Process_1", [boundaryEvent]]]),
          espStartEvents: new Map([["Process_1", [espStartEvent]]]),
        });
        const analyzer = new CatchEventAnalyzer(model, state);
        const context = makeContext({ flowScopeKey: 1 });

        // when
        const result = analyzer.findErrorCatchEvent("ERR_PAYMENT", context);

        // then
        expect(isRight(result)).toBe(true);
        if (isRight(result)) {
          // Boundary events are collected before ESP start events
          expect(result.value.catchEvent).toBe(boundaryEvent);
        }
      });
    });

    describe("NoMatch", () => {
      it("should return failure when no matching error catch event found", () => {
        // given
        const { model, state } = makeLookups({
          instances: new Map([
            [1, makeInstance(1, "Process_1", NO_PARENT)],
          ]),
          boundaryEvents: new Map(),
        });
        const analyzer = new CatchEventAnalyzer(model, state);
        const context = makeContext({ flowScopeKey: 1 });

        // when
        const result = analyzer.findErrorCatchEvent("ERR_PAYMENT", context);

        // then
        expect(isLeft(result)).toBe(true);
        if (isLeft(result)) {
          expect(result.value.errorType).toBe(
            ErrorType.UNHANDLED_ERROR_EVENT
          );
          expect(result.value.message).toContain("ERR_PAYMENT");
        }
      });

      it("should include available error codes in failure message", () => {
        // given
        const boundary1 = makeEvent({
          elementId: "ErrorBoundary_1",
          errorCode: "ERR_INVENTORY",
        });
        const boundary2 = makeEvent({
          elementId: "ErrorBoundary_2",
          // catch-all
        });
        // But they're on a scope that doesn't match the code AND the
        // catch-all is for a different event type
        const timerBoundary = makeEvent({
          elementId: "TimerBoundary_1",
          eventDefinitionType: BpmnEventDefinitionType.TIMER,
        });
        const { model, state } = makeLookups({
          instances: new Map([
            [1, makeInstance(1, "SubProcess_1", 2)],
            [2, makeInstance(2, "Process_1", NO_PARENT)],
          ]),
          // SubProcess has a specific error boundary for INVENTORY
          // Process has no error boundaries
          boundaryEvents: new Map([
            ["SubProcess_1", [boundary1, timerBoundary]],
            ["Process_1", []],
          ]),
        });
        const analyzer = new CatchEventAnalyzer(model, state);
        const context = makeContext({ flowScopeKey: 1 });

        // when — ERR_PAYMENT doesn't match ERR_INVENTORY, but there's
        // also a catch-all (boundary2) ... wait, let me adjust: only ERR_INVENTORY
        // Actually, there IS a catch-all (boundary2) which would match.
        // Let me remove the catch-all to test the failure message properly.
        // Hmm, boundary2 was declared but not added to any scope. Let me
        // re-structure: only ERR_INVENTORY boundary exists, no catch-all.
        const result = analyzer.findErrorCatchEvent("ERR_PAYMENT", context);

        // then
        expect(isLeft(result)).toBe(true);
        if (isLeft(result)) {
          expect(result.value.message).toContain("ERR_INVENTORY");
          expect(result.value.message).not.toContain("TIMER");
        }
      });

      it("should handle empty scope chain (flowScopeKey is NO_PARENT)", () => {
        // given
        const { model, state } = makeLookups({
          instances: new Map(),
          boundaryEvents: new Map(),
        });
        const analyzer = new CatchEventAnalyzer(model, state);
        const context = makeContext({ flowScopeKey: NO_PARENT });

        // when
        const result = analyzer.findErrorCatchEvent("ERR_PAYMENT", context);

        // then
        expect(isLeft(result)).toBe(true);
        if (isLeft(result)) {
          expect(result.value.errorType).toBe(
            ErrorType.UNHANDLED_ERROR_EVENT
          );
        }
      });

      it("should handle missing scope instance gracefully", () => {
        // given — scope key exists but no instance record
        const { model, state } = makeLookups({
          instances: new Map(), // empty — getInstance returns undefined
          boundaryEvents: new Map(),
        });
        const analyzer = new CatchEventAnalyzer(model, state);
        const context = makeContext({ flowScopeKey: 999 });

        // when
        const result = analyzer.findErrorCatchEvent("ERR_PAYMENT", context);

        // then
        expect(isLeft(result)).toBe(true);
        if (isLeft(result)) {
          expect(result.value.errorType).toBe(
            ErrorType.UNHANDLED_ERROR_EVENT
          );
        }
      });
    });

    describe("FilteringNonErrorEvents", () => {
      it("should ignore non-error boundary events when searching for errors", () => {
        // given
        const timerBoundary = makeEvent({
          elementId: "TimerBoundary_1",
          eventDefinitionType: BpmnEventDefinitionType.TIMER,
        });
        const messageBoundary = makeEvent({
          elementId: "MessageBoundary_1",
          eventDefinitionType: BpmnEventDefinitionType.MESSAGE,
          messageName: "test-message",
        });
        const { model, state } = makeLookups({
          instances: new Map([
            [1, makeInstance(1, "Process_1", NO_PARENT)],
          ]),
          boundaryEvents: new Map([
            ["Process_1", [timerBoundary, messageBoundary]],
          ]),
        });
        const analyzer = new CatchEventAnalyzer(model, state);
        const context = makeContext({ flowScopeKey: 1 });

        // when
        const result = analyzer.findErrorCatchEvent("ERR_PAYMENT", context);

        // then
        expect(isLeft(result)).toBe(true);
      });
    });
  });

  describe("findEscalationCatchEvent", () => {
    describe("CodeSpecificMatch", () => {
      it("should find escalation boundary event with matching code", () => {
        // given
        const escalationBoundary = makeEvent({
          elementId: "EscalationBoundary_1",
          eventDefinitionType: BpmnEventDefinitionType.ESCALATION,
          escalationCode: "ESC_APPROVAL",
          interrupting: false,
        });
        const { model, state } = makeLookups({
          instances: new Map([
            [1, makeInstance(1, "Process_1", NO_PARENT)],
          ]),
          boundaryEvents: new Map([
            ["Process_1", [escalationBoundary]],
          ]),
        });
        const analyzer = new CatchEventAnalyzer(model, state);
        const context = makeContext({ flowScopeKey: 1 });

        // when
        const result = analyzer.findEscalationCatchEvent(
          "ESC_APPROVAL",
          context
        );

        // then
        expect(result).toBeDefined();
        expect(result!.catchEvent).toBe(escalationBoundary);
        expect(result!.elementInstanceKey).toBe(1);
        expect(result!.catchScopeElementId).toBe("Process_1");
      });
    });

    describe("CatchAllMatch", () => {
      it("should find catch-all escalation boundary event", () => {
        // given
        const catchAllEscalation = makeEvent({
          elementId: "EscalationBoundary_CatchAll",
          eventDefinitionType: BpmnEventDefinitionType.ESCALATION,
          // no escalationCode — catches all
          interrupting: false,
        });
        const { model, state } = makeLookups({
          instances: new Map([
            [1, makeInstance(1, "Process_1", NO_PARENT)],
          ]),
          boundaryEvents: new Map([
            ["Process_1", [catchAllEscalation]],
          ]),
        });
        const analyzer = new CatchEventAnalyzer(model, state);
        const context = makeContext({ flowScopeKey: 1 });

        // when
        const result = analyzer.findEscalationCatchEvent(
          "ANY_ESCALATION",
          context
        );

        // then
        expect(result).toBeDefined();
        expect(result!.catchEvent).toBe(catchAllEscalation);
      });
    });

    describe("Priority", () => {
      it("should prioritize code-specific over catch-all for escalation", () => {
        // given
        const catchAll = makeEvent({
          elementId: "EscalationBoundary_CatchAll",
          eventDefinitionType: BpmnEventDefinitionType.ESCALATION,
          interrupting: false,
        });
        const specific = makeEvent({
          elementId: "EscalationBoundary_Specific",
          eventDefinitionType: BpmnEventDefinitionType.ESCALATION,
          escalationCode: "ESC_APPROVAL",
          interrupting: false,
        });
        const { model, state } = makeLookups({
          instances: new Map([
            [1, makeInstance(1, "Process_1", NO_PARENT)],
          ]),
          boundaryEvents: new Map([
            ["Process_1", [catchAll, specific]],
          ]),
        });
        const analyzer = new CatchEventAnalyzer(model, state);
        const context = makeContext({ flowScopeKey: 1 });

        // when
        const result = analyzer.findEscalationCatchEvent(
          "ESC_APPROVAL",
          context
        );

        // then
        expect(result).toBeDefined();
        expect(result!.catchEvent).toBe(specific);
      });
    });

    describe("NoMatch", () => {
      it("should return undefined when no matching escalation catch event", () => {
        // given
        const { model, state } = makeLookups({
          instances: new Map([
            [1, makeInstance(1, "Process_1", NO_PARENT)],
          ]),
          boundaryEvents: new Map(),
        });
        const analyzer = new CatchEventAnalyzer(model, state);
        const context = makeContext({ flowScopeKey: 1 });

        // when
        const result = analyzer.findEscalationCatchEvent(
          "ESC_APPROVAL",
          context
        );

        // then
        expect(result).toBeUndefined();
      });
    });

    describe("ScopeChainWalking", () => {
      it("should walk up scope chain for escalation catch events", () => {
        // given
        // Process (key=1) → SubProcess (key=2) → Task (key=10, throws escalation)
        const escalationBoundary = makeEvent({
          elementId: "EscalationBoundary_OnProcess",
          eventDefinitionType: BpmnEventDefinitionType.ESCALATION,
          escalationCode: "ESC_APPROVAL",
          interrupting: false,
        });
        const { model, state } = makeLookups({
          instances: new Map([
            [1, makeInstance(1, "Process_1", NO_PARENT)],
            [2, makeInstance(2, "SubProcess_1", 1)],
          ]),
          boundaryEvents: new Map([
            ["SubProcess_1", []], // no catch at inner scope
            ["Process_1", [escalationBoundary]], // catch at outer scope
          ]),
        });
        const analyzer = new CatchEventAnalyzer(model, state);
        const context = makeContext({ flowScopeKey: 2 });

        // when
        const result = analyzer.findEscalationCatchEvent(
          "ESC_APPROVAL",
          context
        );

        // then
        expect(result).toBeDefined();
        expect(result!.catchEvent).toBe(escalationBoundary);
        expect(result!.elementInstanceKey).toBe(1);
        expect(result!.catchScopeElementId).toBe("Process_1");
      });
    });
  });
});
