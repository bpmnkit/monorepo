/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

// --- Types ---
export type { Either, Left, Right } from "./types/Either.js";
export { left, right, isLeft, isRight, map, flatMap } from "./types/Either.js";
export {
  BpmnElementType,
  getElementTypeName,
  isContainerType,
  isTaskType,
  isGatewayType,
  isEventType,
  isFlowNode,
} from "./types/BpmnElementType.js";

// --- Intents ---
export {
  ProcessInstanceIntent,
  isProcessInstanceCommand,
  isBpmnElementCommand,
  isBpmnElementEvent,
  isEvent,
} from "./intent/ProcessInstanceIntent.js";

// --- Lifecycle ---
export {
  canTransition,
  isFinalState,
  isInitialState,
  isElementInstanceState,
  isTokenState,
  canTerminate,
  isActive,
  isTerminating,
} from "./lifecycle/ProcessInstanceLifecycle.js";

// --- Processor ---
export { TransitionOutcome } from "./processor/TransitionOutcome.js";
export { Failure, ErrorType } from "./processor/Failure.js";
export type { BpmnElementContext } from "./processor/BpmnElementContext.js";
export type { BpmnElementProcessor } from "./processor/BpmnElementProcessor.js";
export { AbstractBpmnElementProcessor } from "./processor/BpmnElementProcessor.js";
export type { BpmnElementContainerProcessor } from "./processor/BpmnElementContainerProcessor.js";
export { AbstractBpmnElementContainerProcessor } from "./processor/BpmnElementContainerProcessor.js";
export { BpmnElementProcessors } from "./processor/BpmnElementProcessors.js";
export { BpmnStreamProcessor } from "./processor/BpmnStreamProcessor.js";
export type { ContainerContext } from "./processor/BpmnStreamProcessor.js";

// --- Variable State ---
export { VariableIntent } from "./state/VariableIntent.js";
export type { VariableEvent } from "./state/VariableEvent.js";
export { NO_PARENT } from "./state/VariableState.js";
export type { VariableState } from "./state/VariableState.js";
export { VariableStore } from "./state/VariableStore.js";

// --- Variable Behavior ---
export type { VariableDocument } from "./variable/VariableBehavior.js";
export { VariableBehavior } from "./variable/VariableBehavior.js";

// --- Event Model ---
export {
  BpmnEventDefinitionType,
  isWaitState,
  isPassthrough,
} from "./event/BpmnEventDefinitionType.js";
export type { BpmnEventElement } from "./event/BpmnEventElement.js";

// --- Timer ---
export { TimerType, parseDuration, parseCycle } from "./timer/TimerDefinition.js";
export type { TimerDefinition } from "./timer/TimerDefinition.js";
export type { TimerInstance, TimerCallback } from "./timer/TimerScheduler.js";
export { TimerScheduler } from "./timer/TimerScheduler.js";

// --- Event Processors ---
export type { EventBehaviors } from "./processor/EventBehaviors.js";
export { StartEventProcessor } from "./processor/StartEventProcessor.js";
export { EndEventProcessor } from "./processor/EndEventProcessor.js";
export { IntermediateCatchEventProcessor } from "./processor/IntermediateCatchEventProcessor.js";
export { IntermediateThrowEventProcessor } from "./processor/IntermediateThrowEventProcessor.js";
export { BoundaryEventProcessor } from "./processor/BoundaryEventProcessor.js";

// --- Error Propagation ---
export type {
  CatchEventTuple,
  ElementInstanceRecord,
  ElementInstanceLookup,
  ProcessModelLookup,
} from "./error/CatchEventAnalyzer.js";
export { CatchEventAnalyzer } from "./error/CatchEventAnalyzer.js";

// --- Task Model ---
export type { BpmnTaskElement } from "./task/BpmnTaskElement.js";

// --- Task Processors ---
export type { TaskBehaviors } from "./processor/TaskBehaviors.js";
export { TaskProcessor } from "./processor/TaskProcessor.js";
export { ServiceTaskProcessor } from "./processor/ServiceTaskProcessor.js";
export { BusinessRuleTaskProcessor } from "./processor/BusinessRuleTaskProcessor.js";
export { SendTaskProcessor } from "./processor/SendTaskProcessor.js";
export { ReceiveTaskProcessor } from "./processor/ReceiveTaskProcessor.js";

// --- Container Model ---
export type {
  BpmnSubProcessElement,
  BpmnAdHocSubProcessElement,
} from "./container/BpmnSubProcessElement.js";

// --- Container Processors ---
export type { SubProcessBehaviors } from "./processor/SubProcessBehaviors.js";
export { SubProcessProcessor } from "./processor/SubProcessProcessor.js";
export { AdHocSubProcessProcessor } from "./processor/AdHocSubProcessProcessor.js";
export { AdHocSubProcessInnerInstanceProcessor } from "./processor/AdHocSubProcessInnerInstanceProcessor.js";

// --- Gateway Model ---
export type {
  BpmnGatewayElement,
  SequenceFlow,
} from "./gateway/BpmnGatewayElement.js";

// --- Gateway Processors ---
export type { GatewayBehaviors } from "./processor/GatewayBehaviors.js";
export { ExclusiveGatewayProcessor } from "./processor/ExclusiveGatewayProcessor.js";
export { ParallelGatewayProcessor } from "./processor/ParallelGatewayProcessor.js";
export { InclusiveGatewayProcessor } from "./processor/InclusiveGatewayProcessor.js";
export { EventBasedGatewayProcessor } from "./processor/EventBasedGatewayProcessor.js";

// --- Job System ---
export { JobIntent, isJobCommand, isJobEvent } from "./job/JobIntent.js";
export type { ActivatedJob } from "./job/ActivatedJob.js";
export type {
  JobResult,
  CompleteJobResult,
  FailJobResult,
  ThrowErrorJobResult,
} from "./job/JobResult.js";
export { completeJob, failJob, throwError } from "./job/JobResult.js";
export type { JobClient } from "./job/JobClient.js";
export { DefaultJobClient } from "./job/JobClient.js";
export type { JobHandler } from "./job/JobHandler.js";
export { JobWorkerRegistry } from "./job/JobWorkerRegistry.js";

// --- Multi-Instance ---
export type {
  CompletionConditionContext,
  CompletionCondition,
  LoopCharacteristics,
} from "./multiinstance/LoopCharacteristics.js";
export type { MultiInstanceBody } from "./multiinstance/MultiInstanceBody.js";
export type { MultiInstanceInstanceCounts } from "./multiinstance/MultiInstanceState.js";
export { MultiInstanceState } from "./multiinstance/MultiInstanceState.js";
export type { MultiInstanceActions } from "./multiinstance/MultiInstanceBodyProcessor.js";
export { MultiInstanceBodyProcessor } from "./multiinstance/MultiInstanceBodyProcessor.js";

// --- Message System ---
export type { Message } from "./message/Message.js";
export {
  MessageIntent,
  isMessageCommand,
  isMessageEvent,
} from "./message/MessageIntent.js";
export type { MessageState } from "./message/MessageState.js";
export { MessageStore } from "./message/MessageStore.js";
export type { MessageSubscription } from "./message/MessageSubscription.js";
export {
  MessageSubscriptionIntent,
  isSubscriptionCommand,
  isSubscriptionEvent,
} from "./message/MessageSubscriptionIntent.js";
export type { MessageSubscriptionState } from "./message/MessageSubscriptionState.js";
export { MessageSubscriptionStore } from "./message/MessageSubscriptionStore.js";
export type {
  PublishResult,
  CorrelationResult,
  CorrelationListener,
} from "./message/MessageCorrelationBehavior.js";
export { MessageCorrelationBehavior } from "./message/MessageCorrelationBehavior.js";
