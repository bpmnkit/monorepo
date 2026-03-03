/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

/**
 * Context provided to a completion condition evaluator, containing the current
 * state of multi-instance child instance counters.
 *
 * These values match the BPMN spec built-in variables for multi-instance:
 * - `numberOfInstances` — total number of instances created
 * - `numberOfActiveInstances` — currently executing (adjusted: -1 during completion)
 * - `numberOfCompletedInstances` — finished successfully (adjusted: +1 during completion)
 * - `numberOfTerminatedInstances` — terminated/cancelled
 */
export interface CompletionConditionContext {
  readonly numberOfInstances: number;
  readonly numberOfActiveInstances: number;
  readonly numberOfCompletedInstances: number;
  readonly numberOfTerminatedInstances: number;
}

/**
 * A completion condition evaluator for multi-instance bodies.
 *
 * In Zeebe, this is a FEEL expression. In the browser engine, we use a callback
 * that receives the instance counters and returns whether the multi-instance body
 * should complete early (terminating remaining child instances).
 *
 * @example
 * // Complete when at least 2 instances have completed
 * const condition: CompletionCondition = (ctx) => ctx.numberOfCompletedInstances >= 2;
 */
export type CompletionCondition = (
  context: CompletionConditionContext
) => boolean;

/**
 * Configuration for multi-instance loop execution.
 *
 * Mirrors `io.camunda.zeebe.engine.processing.deployment.model.element.ExecutableLoopCharacteristics`.
 *
 * Defines how a multi-instance body iterates over its input:
 * - **Sequential**: one child instance at a time, in order
 * - **Parallel**: all child instances activated simultaneously
 *
 * @example
 * const characteristics: LoopCharacteristics = {
 *   isSequential: false,
 *   inputCollection: 'items',
 *   inputElement: 'item',
 *   outputCollection: 'results',
 *   outputElement: 'result',
 *   completionCondition: (ctx) => ctx.numberOfCompletedInstances >= 3,
 * };
 */
export interface LoopCharacteristics {
  /** Whether child instances execute sequentially (true) or in parallel (false). */
  readonly isSequential: boolean;

  /**
   * Variable name of the input collection to iterate over.
   * The collection value must be an array in the variable scope.
   */
  readonly inputCollection: string;

  /**
   * Optional variable name for the current iteration's input element.
   * If set, each child instance receives the collection item at its loop index
   * as a local variable with this name.
   */
  readonly inputElement?: string;

  /**
   * Optional variable name for the output collection.
   * If set, an array is initialized with `null` values (one per input element)
   * and updated with each child's output upon completion.
   */
  readonly outputCollection?: string;

  /**
   * Optional variable name for each child instance's output element.
   * The value of this variable is collected into the output collection
   * at the corresponding loop index when the child completes.
   */
  readonly outputElement?: string;

  /**
   * Optional completion condition evaluated after each child instance completes.
   * If the condition returns `true`, remaining child instances are terminated
   * and the multi-instance body completes early.
   */
  readonly completionCondition?: CompletionCondition;
}
