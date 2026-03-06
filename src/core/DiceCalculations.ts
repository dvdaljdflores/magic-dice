/**
 * LAYER 1 — Dice Result Calculations
 *
 * Pure functions that compute face counts, rerollable counts, lethal counts,
 * and cumulative delete/reroll counts from a DiceRollResult + masks.
 * Extracted from ResultsPanel for testability and reuse.
 */

import type { DiceRollResult } from './types';

/** Count active dice showing face value `v`. */
export function getFaceCount(
  rollResult: DiceRollResult | null,
  activeMask: boolean[] | null,
  v: number,
): number {
  if (!rollResult) return 0;
  let n = 0;
  for (let i = 0; i < rollResult.values.length; i++) {
    if (activeMask && !activeMask[i]) continue;
    if (rollResult.values[i] === v) n++;
  }
  return n;
}

/** Count active, non-lethal dice showing face value `v`. */
export function getRerollableCount(
  rollResult: DiceRollResult | null,
  activeMask: boolean[] | null,
  lethalMask: boolean[] | null,
  v: number,
): number {
  if (!rollResult) return 0;
  let n = 0;
  for (let i = 0; i < rollResult.values.length; i++) {
    if (activeMask && !activeMask[i]) continue;
    if (lethalMask?.[i]) continue;
    if (rollResult.values[i] === v) n++;
  }
  return n;
}

/** Count active lethal dice showing face value `v`. */
export function getLethalCount(
  rollResult: DiceRollResult | null,
  activeMask: boolean[] | null,
  lethalMask: boolean[] | null,
  v: number,
): number {
  if (!rollResult || !lethalMask) return 0;
  let n = 0;
  for (let i = 0; i < rollResult.values.length; i++) {
    if (activeMask && !activeMask[i]) continue;
    if (lethalMask[i] && rollResult.values[i] === v) n++;
  }
  return n;
}

/** True if all active dice of face `v` are lethal. */
export function isGroupLethal(
  rollResult: DiceRollResult | null,
  activeMask: boolean[] | null,
  lethalMask: boolean[] | null,
  v: number,
): boolean {
  const cnt = getFaceCount(rollResult, activeMask, v);
  return cnt > 0 && getLethalCount(rollResult, activeMask, lethalMask, v) === cnt;
}

/** Count all active dice with face value <= `v`. */
export function getDeleteableCount(
  rollResult: DiceRollResult | null,
  activeMask: boolean[] | null,
  v: number,
): number {
  if (!rollResult) return 0;
  let n = 0;
  for (let f = 1; f <= v; f++) n += getFaceCount(rollResult, activeMask, f);
  return n;
}

/** Count all active, non-lethal dice with face value <= `v`. */
export function getRerollableBelowCount(
  rollResult: DiceRollResult | null,
  activeMask: boolean[] | null,
  lethalMask: boolean[] | null,
  v: number,
): number {
  if (!rollResult) return 0;
  let n = 0;
  for (let f = 1; f <= v; f++) n += getRerollableCount(rollResult, activeMask, lethalMask, f);
  return n;
}
