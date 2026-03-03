/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

/**
 * The type of timer trigger.
 *
 * Mirrors the timer types in Zeebe's `TimerRecord`:
 * - DATE: fires at a specific timestamp
 * - DURATION: fires after a time period
 * - CYCLE: fires repeatedly at intervals
 */
export enum TimerType {
  /** Timer fires at a specific date/time (ISO 8601 date-time). */
  DATE = "DATE",

  /** Timer fires after a duration (ISO 8601 duration, e.g. "PT30S"). */
  DURATION = "DURATION",

  /** Timer fires repeatedly at intervals (ISO 8601 repeating interval, e.g. "R3/PT10S"). */
  CYCLE = "CYCLE",
}

/**
 * Timer definition attached to a timer event.
 *
 * For the browser engine, values are concrete (already evaluated from expressions).
 * In Zeebe, timer values may be FEEL expressions that are evaluated at runtime.
 */
export interface TimerDefinition {
  /** The type of timer. */
  readonly type: TimerType;

  /**
   * The timer value.
   * - DATE: ISO 8601 date-time string (e.g. "2024-01-15T10:30:00Z")
   * - DURATION: ISO 8601 duration string (e.g. "PT30S", "P1D", "PT1H30M")
   * - CYCLE: ISO 8601 repeating interval (e.g. "R3/PT10S", "R/PT5M")
   */
  readonly value: string;
}

/**
 * Parses an ISO 8601 duration string into milliseconds.
 *
 * Supports the following format: `P[nY][nM][nD][T[nH][nM][nS]]`
 *
 * Approximations (used for calendar durations):
 * - 1 year = 365 days
 * - 1 month = 30 days
 *
 * @param iso8601 - Duration string (e.g. "PT30S", "P1DT12H", "PT1H30M15S")
 * @returns Duration in milliseconds
 * @throws Error if the string is not a valid ISO 8601 duration
 */
export function parseDuration(iso8601: string): number {
  const match = iso8601.match(
    /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/
  );

  if (!match) {
    throw new Error(`Invalid ISO 8601 duration: '${iso8601}'`);
  }

  const years = parseInt(match[1] || "0", 10);
  const months = parseInt(match[2] || "0", 10);
  const days = parseInt(match[3] || "0", 10);
  const hours = parseInt(match[4] || "0", 10);
  const minutes = parseInt(match[5] || "0", 10);
  const seconds = parseFloat(match[6] || "0");

  const MS_PER_SECOND = 1000;
  const MS_PER_MINUTE = 60 * MS_PER_SECOND;
  const MS_PER_HOUR = 60 * MS_PER_MINUTE;
  const MS_PER_DAY = 24 * MS_PER_HOUR;
  const MS_PER_MONTH = 30 * MS_PER_DAY;
  const MS_PER_YEAR = 365 * MS_PER_DAY;

  return (
    years * MS_PER_YEAR +
    months * MS_PER_MONTH +
    days * MS_PER_DAY +
    hours * MS_PER_HOUR +
    minutes * MS_PER_MINUTE +
    seconds * MS_PER_SECOND
  );
}

/**
 * Parses an ISO 8601 repeating interval and returns the repetition count
 * and the interval duration in milliseconds.
 *
 * Format: `R[n]/duration` where:
 * - `R` or `R0` means infinite repetitions (returned as -1)
 * - `Rn` means n repetitions
 * - `duration` is an ISO 8601 duration
 *
 * @param cycle - Repeating interval (e.g. "R3/PT10S", "R/PT5M")
 * @returns Object with repetitions (-1 for infinite) and intervalMs
 * @throws Error if the string is not a valid repeating interval
 */
export function parseCycle(cycle: string): {
  repetitions: number;
  intervalMs: number;
} {
  const slashIndex = cycle.indexOf("/");
  if (!cycle.startsWith("R") || slashIndex === -1) {
    throw new Error(`Invalid ISO 8601 repeating interval: '${cycle}'`);
  }

  const repPart = cycle.substring(1, slashIndex);
  const repetitions = repPart === "" ? -1 : parseInt(repPart, 10);

  if (isNaN(repetitions)) {
    throw new Error(`Invalid repetition count in cycle: '${cycle}'`);
  }

  const durationPart = cycle.substring(slashIndex + 1);
  const intervalMs = parseDuration(durationPart);

  return { repetitions, intervalMs };
}
