/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

/**
 * A discriminated union representing either a failure (Left) or a success (Right).
 * Mirrors `io.camunda.zeebe.util.Either` from the Java engine.
 */
export type Either<L, R> = Left<L> | Right<R>;

export interface Left<L> {
  readonly _tag: "left";
  readonly value: L;
}

export interface Right<R> {
  readonly _tag: "right";
  readonly value: R;
}

export function left<L>(value: L): Left<L> {
  return { _tag: "left", value };
}

export function right<R>(value: R): Right<R> {
  return { _tag: "right", value };
}

export function isLeft<L, R>(either: Either<L, R>): either is Left<L> {
  return either._tag === "left";
}

export function isRight<L, R>(either: Either<L, R>): either is Right<R> {
  return either._tag === "right";
}

/**
 * Maps the right value of an Either, leaving Left unchanged.
 */
export function map<L, R, R2>(
  either: Either<L, R>,
  fn: (value: R) => R2
): Either<L, R2> {
  if (isRight(either)) {
    return right(fn(either.value));
  }
  return either;
}

/**
 * Flat-maps the right value of an Either.
 */
export function flatMap<L, R, R2>(
  either: Either<L, R>,
  fn: (value: R) => Either<L, R2>
): Either<L, R2> {
  if (isRight(either)) {
    return fn(either.value);
  }
  return either;
}
