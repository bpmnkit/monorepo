/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import type { Either } from "../types/Either.js";
import { left, right } from "../types/Either.js";
import type { BpmnElementContext } from "../processor/BpmnElementContext.js";
import type { BpmnElementContainerProcessor } from "../processor/BpmnElementContainerProcessor.js";
import { Failure, ErrorType } from "../processor/Failure.js";
import { TransitionOutcome } from "../processor/TransitionOutcome.js";
import type { VariableBehavior } from "../variable/VariableBehavior.js";
import type { VariableState } from "../state/VariableState.js";
import type { CompletionConditionContext } from "./LoopCharacteristics.js";
import type { MultiInstanceBody } from "./MultiInstanceBody.js";
import type { MultiInstanceState } from "./MultiInstanceState.js";

/**
 * Callback interface for lifecycle actions that the multi-instance body processor
 * needs to trigger on the engine runtime.
 *
 * In Zeebe, these are provided by `BpmnStateTransitionBehavior` and other behaviors.
 * In the browser engine, the runtime provides these callbacks to decouple the processor
 * from engine internals.
 */
export interface MultiInstanceActions {
  /**
   * Creates and activates a child instance of the inner activity.
   * @param parentContext - the MI body context (flow scope for the child)
   * @param innerActivityId - the BPMN element ID of the inner activity
   * @param loopCounter - the 1-based loop counter for this iteration
   * @returns the context of the newly created child instance
   */
  createChildInstance(
    parentContext: BpmnElementContext,
    innerActivityId: string,
    loopCounter: number
  ): BpmnElementContext;

  /**
   * Signals that the multi-instance body should complete.
   * @param context - the MI body context
   */
  completeElement(context: BpmnElementContext): void;

  /**
   * Terminates all active child instances of the multi-instance body.
   * @param context - the MI body context
   * @returns true if there are no remaining active children after termination
   */
  terminateChildInstances(context: BpmnElementContext): boolean;
}

/**
 * Processor for BPMN multi-instance body elements.
 *
 * Mirrors `io.camunda.zeebe.engine.processing.bpmn.container.MultiInstanceBodyProcessor`.
 *
 * Implements the full multi-instance lifecycle:
 *
 * **Activation** (`onActivate`):
 * 1. Read the input collection from variables
 * 2. Initialize the output collection (if configured) with null values
 * 3. If empty collection → complete immediately
 * 4. Sequential → create one child instance
 * 5. Parallel → create all child instances
 *
 * **Child Activating** (`onChildActivating`):
 * - Inject loop variables: `loopCounter`, input element, output element (nil init)
 *
 * **Before Execution Path Completed** (`beforeExecutionPathCompleted`):
 * - Update the output collection with the child's output element value
 * - Evaluate the completion condition
 *
 * **After Execution Path Completed** (`afterExecutionPathCompleted`):
 * - If completion condition satisfied → terminate remaining children, complete
 * - If sequential and more items → create next child instance
 * - If all children done → complete
 *
 * **Child Terminated** (`onChildTerminated`):
 * - If MI body is terminating → finalize termination when no active children remain
 * - If MI body completed early (completion condition) → complete when all terminated
 *
 * **Termination** (`onTerminate`):
 * - Terminate all child instances
 */
export class MultiInstanceBodyProcessor<T>
  implements BpmnElementContainerProcessor<MultiInstanceBody<T>>
{
  private readonly multiInstanceState: MultiInstanceState;
  private readonly variableBehavior: VariableBehavior;
  private readonly variableState: VariableState;
  private readonly actions: MultiInstanceActions;

  constructor(
    multiInstanceState: MultiInstanceState,
    variableBehavior: VariableBehavior,
    variableState: VariableState,
    actions: MultiInstanceActions
  ) {
    this.multiInstanceState = multiInstanceState;
    this.variableBehavior = variableBehavior;
    this.variableState = variableState;
    this.actions = actions;
  }

  // ---------------------------------------------------------------------------
  // BpmnElementProcessor lifecycle
  // ---------------------------------------------------------------------------

  onActivate(
    element: MultiInstanceBody<T>,
    context: BpmnElementContext
  ): Either<Failure, void> {
    // Read input collection from variables
    const inputCollectionResult = this.getInputCollection(element, context);
    if (inputCollectionResult._tag === "left") {
      return inputCollectionResult;
    }
    const inputCollection = inputCollectionResult.value;

    // Initialize MI state tracking
    this.multiInstanceState.initializeBody(context.elementInstanceKey);

    // Initialize output collection if configured
    const loopCharacteristics = element.loopCharacteristics;
    if (loopCharacteristics.outputCollection) {
      const outputArray = new Array(inputCollection.length).fill(null);
      this.variableBehavior.mergeLocal(context.elementInstanceKey, {
        [loopCharacteristics.outputCollection]: outputArray,
      });
    }

    // Empty collection → complete immediately
    if (inputCollection.length === 0) {
      this.actions.completeElement(context);
      return right(undefined);
    }

    // Create child instances
    if (loopCharacteristics.isSequential) {
      this.createInnerInstance(element, context, 1);
    } else {
      for (let i = 1; i <= inputCollection.length; i++) {
        this.createInnerInstance(element, context, i);
      }
    }

    return right(undefined);
  }

  finalizeActivation(
    _element: MultiInstanceBody<T>,
    _context: BpmnElementContext
  ): Either<Failure, void> {
    return right(undefined);
  }

  onComplete(
    element: MultiInstanceBody<T>,
    context: BpmnElementContext
  ): Either<Failure, void> {
    // Propagate output collection variable to parent scope
    const loopCharacteristics = element.loopCharacteristics;
    if (loopCharacteristics.outputCollection) {
      const outputValue = this.variableState.getVariableLocal(
        context.elementInstanceKey,
        loopCharacteristics.outputCollection
      );
      if (outputValue !== undefined) {
        this.variableBehavior.mergeDocument(context.flowScopeKey, {
          [loopCharacteristics.outputCollection]: outputValue,
        });
      }
    }

    return right(undefined);
  }

  finalizeCompletion(
    _element: MultiInstanceBody<T>,
    context: BpmnElementContext
  ): Either<Failure, void> {
    this.multiInstanceState.removeBody(context.elementInstanceKey);
    return right(undefined);
  }

  onTerminate(
    _element: MultiInstanceBody<T>,
    context: BpmnElementContext
  ): TransitionOutcome {
    const noActiveChildren = this.actions.terminateChildInstances(context);
    if (noActiveChildren) {
      this.multiInstanceState.removeBody(context.elementInstanceKey);
    }
    return TransitionOutcome.CONTINUE;
  }

  finalizeTermination(
    _element: MultiInstanceBody<T>,
    _context: BpmnElementContext
  ): void {
    // no-op — cleanup is done in onTerminate
  }

  // ---------------------------------------------------------------------------
  // BpmnElementContainerProcessor hooks
  // ---------------------------------------------------------------------------

  onChildActivating(
    element: MultiInstanceBody<T>,
    flowScopeContext: BpmnElementContext,
    childContext: BpmnElementContext
  ): Either<Failure, void> {
    const loopCounter = this.multiInstanceState.getLoopCounter(
      childContext.elementInstanceKey
    );
    if (loopCounter === 0) {
      return left(
        new Failure(
          "Loop counter not set for child instance",
          ErrorType.EXTRACT_VALUE_ERROR
        )
      );
    }

    // Read input collection to get the element for this iteration
    const inputCollectionResult = this.getInputCollection(
      element,
      flowScopeContext
    );
    if (inputCollectionResult._tag === "left") {
      return inputCollectionResult;
    }
    const inputCollection = inputCollectionResult.value;

    const index = loopCounter - 1;
    if (index >= inputCollection.length) {
      return left(
        new Failure(
          `Expected to read item at index ${index} of the multiInstanceBody input collection but it contains only ${inputCollection.length} elements. The input collection might be modified while iterating over it.`,
          ErrorType.EXTRACT_VALUE_ERROR
        )
      );
    }

    // Set loop variables on the child scope
    this.setLoopVariables(
      element,
      childContext,
      loopCounter,
      inputCollection[index]
    );

    // Track activation in counters
    this.multiInstanceState.incrementActivated(
      flowScopeContext.elementInstanceKey
    );

    return right(undefined);
  }

  onChildCompleting(
    _element: MultiInstanceBody<T>,
    _flowScopeContext: BpmnElementContext,
    _childContext: BpmnElementContext
  ): Either<Failure, void> {
    return right(undefined);
  }

  beforeExecutionPathCompleted(
    element: MultiInstanceBody<T>,
    flowScopeContext: BpmnElementContext,
    childContext: BpmnElementContext
  ): Either<Failure, void> {
    // Update output collection
    const updateResult = this.updateOutputCollection(
      element,
      flowScopeContext,
      childContext
    );
    if (updateResult._tag === "left") {
      return updateResult;
    }

    // Validate that completion condition can be evaluated
    const conditionResult = this.evaluateCompletionCondition(
      element,
      flowScopeContext
    );
    if (conditionResult._tag === "left") {
      return conditionResult;
    }

    return right(undefined);
  }

  afterExecutionPathCompleted(
    element: MultiInstanceBody<T>,
    flowScopeContext: BpmnElementContext,
    childContext: BpmnElementContext,
    _satisfiesCompletionCondition: boolean | undefined
  ): void {
    // Evaluate completion condition BEFORE recording completion,
    // since evaluateCompletionCondition applies adjustments (active-1, completed+1)
    // that assume the child is still counted as active.
    const conditionResult = this.evaluateCompletionCondition(
      element,
      flowScopeContext
    );
    const satisfiesCondition =
      conditionResult._tag === "right" ? conditionResult.value : false;

    // Now record child completion in counters
    this.multiInstanceState.incrementCompleted(
      flowScopeContext.elementInstanceKey
    );

    const loopCharacteristics = element.loopCharacteristics;
    let childInstanceCreated = false;

    if (satisfiesCondition) {
      // Terminate remaining children
      const hasNoActiveChildren =
        this.actions.terminateChildInstances(flowScopeContext);
      if (hasNoActiveChildren || loopCharacteristics.isSequential) {
        this.actions.completeElement(flowScopeContext);
      }
      return;
    }

    // For sequential: create next child instance if more items remain
    if (loopCharacteristics.isSequential) {
      const inputCollectionResult = this.getInputCollection(
        element,
        flowScopeContext
      );
      if (inputCollectionResult._tag === "right") {
        const inputCollection = inputCollectionResult.value;
        const counts = this.multiInstanceState.getCounts(
          flowScopeContext.elementInstanceKey
        );
        const nextLoopCounter = counts ? counts.totalActivated + 1 : 1;

        if (nextLoopCounter <= inputCollection.length) {
          this.createInnerInstance(element, flowScopeContext, nextLoopCounter);
          childInstanceCreated = true;
        }
      }
    }

    // Check if all children have completed or been terminated
    if (!childInstanceCreated) {
      const counts = this.multiInstanceState.getCounts(
        flowScopeContext.elementInstanceKey
      );
      if (counts) {
        const inputCollectionResult = this.getInputCollection(
          element,
          flowScopeContext
        );
        if (inputCollectionResult._tag === "right") {
          const completedOrTerminated = counts.completed + counts.terminated;
          if (completedOrTerminated >= inputCollectionResult.value.length) {
            this.actions.completeElement(flowScopeContext);
          }
        }
      }
    }

    // Clean up child loop counter
    this.multiInstanceState.removeLoopCounter(childContext.elementInstanceKey);
  }

  onChildTerminated(
    _element: MultiInstanceBody<T>,
    flowScopeContext: BpmnElementContext,
    childContext: BpmnElementContext
  ): void {
    this.multiInstanceState.incrementTerminated(
      flowScopeContext.elementInstanceKey
    );

    // Clean up child loop counter
    this.multiInstanceState.removeLoopCounter(childContext.elementInstanceKey);
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Reads the input collection array from the variable scope.
   */
  private getInputCollection(
    element: MultiInstanceBody<T>,
    context: BpmnElementContext
  ): Either<Failure, unknown[]> {
    const collectionName = element.loopCharacteristics.inputCollection;
    const value = this.variableState.getVariable(
      context.elementInstanceKey,
      collectionName
    );

    if (value === undefined) {
      return left(
        new Failure(
          `Expected to read the input collection '${collectionName}' but it is not available`,
          ErrorType.EXTRACT_VALUE_ERROR,
          context.elementInstanceKey
        )
      );
    }

    if (!Array.isArray(value)) {
      return left(
        new Failure(
          `Expected the input collection '${collectionName}' to be an array but found '${typeof value}'`,
          ErrorType.EXTRACT_VALUE_ERROR,
          context.elementInstanceKey
        )
      );
    }

    return right(value);
  }

  /**
   * Creates a child instance of the inner activity with the given loop counter.
   */
  private createInnerInstance(
    element: MultiInstanceBody<T>,
    parentContext: BpmnElementContext,
    loopCounter: number
  ): void {
    const childContext = this.actions.createChildInstance(
      parentContext,
      element.innerActivityId,
      loopCounter
    );
    this.multiInstanceState.setLoopCounter(
      childContext.elementInstanceKey,
      loopCounter
    );
  }

  /**
   * Sets the BPMN-standard loop variables on a child instance scope.
   *
   * Variables set:
   * - `loopCounter` — 1-based iteration index
   * - Input element variable (if configured) — the collection item for this iteration
   * - Output element variable (if configured, and different from input) — initialized to null
   */
  private setLoopVariables(
    element: MultiInstanceBody<T>,
    childContext: BpmnElementContext,
    loopCounter: number,
    inputElement: unknown
  ): void {
    const loopCharacteristics = element.loopCharacteristics;
    const vars: Record<string, unknown> = { loopCounter };

    // Set input element variable
    if (loopCharacteristics.inputElement) {
      vars[loopCharacteristics.inputElement] = inputElement;
    }

    // Initialize output element variable with null (if different from input element and loopCounter)
    if (
      loopCharacteristics.outputElement &&
      loopCharacteristics.outputElement !== loopCharacteristics.inputElement &&
      loopCharacteristics.outputElement !== "loopCounter"
    ) {
      vars[loopCharacteristics.outputElement] = null;
    }

    this.variableBehavior.mergeLocal(childContext.elementInstanceKey, vars);
  }

  /**
   * Updates the output collection with the child instance's output element value.
   */
  private updateOutputCollection(
    element: MultiInstanceBody<T>,
    flowScopeContext: BpmnElementContext,
    childContext: BpmnElementContext
  ): Either<Failure, void> {
    const loopCharacteristics = element.loopCharacteristics;
    if (!loopCharacteristics.outputCollection || !loopCharacteristics.outputElement) {
      return right(undefined);
    }

    // Get the output element value from the child scope
    const outputValue = this.variableState.getVariableLocal(
      childContext.elementInstanceKey,
      loopCharacteristics.outputElement
    );

    // Get the current output collection
    const outputCollection = this.variableState.getVariableLocal(
      flowScopeContext.elementInstanceKey,
      loopCharacteristics.outputCollection
    );

    if (!Array.isArray(outputCollection)) {
      return left(
        new Failure(
          `Expected the output collection '${loopCharacteristics.outputCollection}' to be an array`,
          ErrorType.EXTRACT_VALUE_ERROR
        )
      );
    }

    // Update at the loop counter index
    const loopCounter = this.multiInstanceState.getLoopCounter(
      childContext.elementInstanceKey
    );
    const index = loopCounter - 1;
    if (index >= 0 && index < outputCollection.length) {
      const updatedCollection = [...outputCollection];
      updatedCollection[index] = outputValue ?? null;
      this.variableBehavior.mergeLocal(flowScopeContext.elementInstanceKey, {
        [loopCharacteristics.outputCollection]: updatedCollection,
      });
    }

    return right(undefined);
  }

  /**
   * Evaluates the completion condition with the current instance counters.
   *
   * Returns `Right(true)` if the condition is satisfied, `Right(false)` if not
   * satisfied or if no condition is configured.
   */
  private evaluateCompletionCondition(
    element: MultiInstanceBody<T>,
    flowScopeContext: BpmnElementContext
  ): Either<Failure, boolean> {
    const completionCondition = element.loopCharacteristics.completionCondition;
    if (!completionCondition) {
      return right(false);
    }

    const counts = this.multiInstanceState.getCounts(
      flowScopeContext.elementInstanceKey
    );
    if (!counts) {
      return left(
        new Failure(
          "Multi-instance state not found for completion condition evaluation",
          ErrorType.CONDITION_ERROR
        )
      );
    }

    try {
      // Build context with adjusted counters (matching Zeebe's behavior):
      // - numberOfActiveInstances is -1 (child is completing but not yet decremented)
      // - numberOfCompletedInstances is +1 (child is completing but not yet incremented)
      const context: CompletionConditionContext = {
        numberOfInstances: counts.totalActivated,
        numberOfActiveInstances: counts.active - 1,
        numberOfCompletedInstances: counts.completed + 1,
        numberOfTerminatedInstances: counts.terminated,
      };

      return right(completionCondition(context));
    } catch (e) {
      return left(
        new Failure(
          `Failed to evaluate completion condition: ${e instanceof Error ? e.message : String(e)}`,
          ErrorType.CONDITION_ERROR
        )
      );
    }
  }
}
