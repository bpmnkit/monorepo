/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import type { BpmnEventElement } from "../event/BpmnEventElement.js";
import { BpmnEventDefinitionType } from "../event/BpmnEventDefinitionType.js";
import type { BpmnElementContext } from "../processor/BpmnElementContext.js";
import type { Either } from "../types/Either.js";
import { left, right } from "../types/Either.js";
import { Failure, ErrorType } from "../processor/Failure.js";
import { NO_PARENT } from "../state/VariableState.js";

// ---------------------------------------------------------------------------
// Lookup Interfaces
// ---------------------------------------------------------------------------

/**
 * Represents an element instance in the scope chain.
 *
 * Mirrors the subset of `io.camunda.zeebe.engine.state.instance.ElementInstance`
 * needed for scope-chain walking.
 */
export interface ElementInstanceRecord {
  /** Unique key identifying this element instance. */
  readonly elementInstanceKey: number;

  /** BPMN element ID from the process model. */
  readonly elementId: string;

  /** Key of the flow scope (parent container) element instance. */
  readonly flowScopeKey: number;
}

/**
 * Lookup interface for element instance runtime state.
 *
 * Provides access to element instances for scope-chain walking.
 */
export interface ElementInstanceLookup {
  /**
   * Returns the element instance for the given key,
   * or undefined if no instance exists with that key.
   */
  getInstance(key: number): ElementInstanceRecord | undefined;
}

/**
 * Lookup interface for process model structure.
 *
 * Provides structural queries about catch events attached to elements
 * in the process model (boundary events, event sub-process start events).
 */
export interface ProcessModelLookup {
  /**
   * Returns boundary events attached to the element with the given ID.
   * These are potential catch events for errors/escalations thrown within the element.
   */
  getBoundaryEvents(
    attachedToElementId: string
  ): readonly BpmnEventElement[];

  /**
   * Returns error/escalation start events of event sub-processes within the given scope.
   * Event sub-processes can catch errors/escalations thrown within their parent scope.
   */
  getEventSubProcessStartEvents(
    scopeElementId: string
  ): readonly BpmnEventElement[];
}

// ---------------------------------------------------------------------------
// Result Type
// ---------------------------------------------------------------------------

/**
 * Result of finding a matching catch event in the scope chain.
 *
 * Mirrors `io.camunda.zeebe.engine.state.analyzers.CatchEventAnalyzer.CatchEventTuple`.
 */
export interface CatchEventTuple {
  /** The matched catch event element (boundary event or event sub-process start event). */
  readonly catchEvent: BpmnEventElement;

  /** The key of the element instance where the catch event was found (the scope). */
  readonly elementInstanceKey: number;

  /** The element ID of the scope where the catch event was found. */
  readonly catchScopeElementId: string;
}

// ---------------------------------------------------------------------------
// Analyzer
// ---------------------------------------------------------------------------

/**
 * Walks the scope chain to find matching catch events for errors and escalations.
 *
 * Mirrors `io.camunda.zeebe.engine.state.analyzers.CatchEventAnalyzer`.
 *
 * ## Algorithm
 *
 * Starting from the throwing element's flow scope, the analyzer walks up the
 * scope chain (parent → grandparent → … → process). At each scope it collects
 * candidate catch events from:
 *
 * 1. **Boundary events** attached to the scope element
 * 2. **Event sub-process start events** within the scope element
 *
 * Candidates are filtered by event definition type (ERROR or ESCALATION) and
 * matched against the thrown code. **Code-specific matches take priority over
 * catch-all matches** at the same scope level. The first (innermost) matching
 * scope wins.
 *
 * ## Browser Adaptations
 *
 * - No cross-partition routing (single-threaded browser engine)
 * - No DirectBuffer — plain string error/escalation codes
 * - Simplified scope chain (no multi-process walking; call activities are not yet supported)
 */
export class CatchEventAnalyzer {
  private readonly modelLookup: ProcessModelLookup;
  private readonly instanceLookup: ElementInstanceLookup;

  constructor(
    modelLookup: ProcessModelLookup,
    instanceLookup: ElementInstanceLookup
  ) {
    this.modelLookup = modelLookup;
    this.instanceLookup = instanceLookup;
  }

  /**
   * Finds the nearest error catch event for the given error code,
   * walking up the scope chain from the throwing element's flow scope.
   *
   * @param errorCode - The BPMN error code to match
   * @param context - The context of the element that threw the error
   * @returns Right(CatchEventTuple) if a match is found,
   *          Left(Failure) with UNHANDLED_ERROR_EVENT if no match exists
   */
  findErrorCatchEvent(
    errorCode: string,
    context: BpmnElementContext
  ): Either<Failure, CatchEventTuple> {
    let currentScopeKey = context.flowScopeKey;
    const availableCodes: string[] = [];

    while (currentScopeKey !== NO_PARENT) {
      const scopeInstance =
        this.instanceLookup.getInstance(currentScopeKey);
      if (!scopeInstance) {
        break;
      }

      const candidates = this.collectCatchCandidates(
        scopeInstance.elementId,
        BpmnEventDefinitionType.ERROR
      );

      for (const c of candidates) {
        availableCodes.push(c.errorCode ?? "<catch-all>");
      }

      const match = this.findMatchingEvent(
        candidates,
        errorCode,
        (e) => e.errorCode
      );
      if (match) {
        return right({
          catchEvent: match,
          elementInstanceKey: currentScopeKey,
          catchScopeElementId: scopeInstance.elementId,
        });
      }

      currentScopeKey = scopeInstance.flowScopeKey;
    }

    return left(
      new Failure(
        `No matching error catch event found for error code '${errorCode}'. ` +
          `Available error catch events: [${availableCodes.join(", ")}]`,
        ErrorType.UNHANDLED_ERROR_EVENT
      )
    );
  }

  /**
   * Finds the nearest escalation catch event for the given escalation code,
   * walking up the scope chain from the throwing element's flow scope.
   *
   * Unlike errors, unhandled escalations do not create incidents — they are
   * silently ignored (per BPMN spec).
   *
   * @param escalationCode - The BPMN escalation code to match
   * @param context - The context of the element that threw the escalation
   * @returns The matching CatchEventTuple, or undefined if no match exists
   */
  findEscalationCatchEvent(
    escalationCode: string,
    context: BpmnElementContext
  ): CatchEventTuple | undefined {
    let currentScopeKey = context.flowScopeKey;

    while (currentScopeKey !== NO_PARENT) {
      const scopeInstance =
        this.instanceLookup.getInstance(currentScopeKey);
      if (!scopeInstance) {
        break;
      }

      const candidates = this.collectCatchCandidates(
        scopeInstance.elementId,
        BpmnEventDefinitionType.ESCALATION
      );

      const match = this.findMatchingEvent(
        candidates,
        escalationCode,
        (e) => e.escalationCode
      );
      if (match) {
        return {
          catchEvent: match,
          elementInstanceKey: currentScopeKey,
          catchScopeElementId: scopeInstance.elementId,
        };
      }

      currentScopeKey = scopeInstance.flowScopeKey;
    }

    return undefined;
  }

  /**
   * Collects all catch event candidates of the given definition type at a scope.
   */
  private collectCatchCandidates(
    scopeElementId: string,
    definitionType: BpmnEventDefinitionType
  ): BpmnEventElement[] {
    const boundary =
      this.modelLookup.getBoundaryEvents(scopeElementId);
    const espStarts =
      this.modelLookup.getEventSubProcessStartEvents(scopeElementId);
    return [...boundary, ...espStarts].filter(
      (e) => e.eventDefinitionType === definitionType
    );
  }

  /**
   * Finds a matching catch event: code-specific match takes priority over catch-all.
   *
   * Mirrors Zeebe's `ERROR_CODE_COMPARATOR` sorting behavior that prioritizes
   * events with a specific code over events with an empty/undefined code.
   *
   * @param candidates - Candidate catch events filtered by definition type
   * @param code - The error or escalation code to match
   * @param getCode - Accessor function to extract the code from a candidate
   */
  private findMatchingEvent(
    candidates: BpmnEventElement[],
    code: string,
    getCode: (e: BpmnEventElement) => string | undefined
  ): BpmnEventElement | undefined {
    // Code-specific match first
    const codeMatch = candidates.find((e) => {
      const eventCode = getCode(e);
      return (
        eventCode !== undefined && eventCode !== "" && eventCode === code
      );
    });
    if (codeMatch) {
      return codeMatch;
    }

    // Catch-all match (empty or undefined code)
    return candidates.find((e) => {
      const eventCode = getCode(e);
      return eventCode === undefined || eventCode === "";
    });
  }
}
