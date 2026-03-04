/**
 * LAYER 1 — Arrange Layout Calculator
 *
 * Pure function that computes target positions and quaternions for the
 * ARRANGED display (dice sorted by face value in rows).
 */

import type { ArrangeTarget } from './types';
import { faceUpQuaternion } from './DiceEngine';

const ROW_SP        = 2.0;
const COL_SP        = 1.35;
const BOARD_W       = 22;
const BOARD_D       = 16;
const LETHAL_ZONE_Z = 6.0;
const NORMAL_Z_MIN  = -7.0;
const NORMAL_Z_MAX  =  1.5;

/**
 * Compute arranged positions and quaternions for each active die.
 * Rows with more dice than fit on the board wrap into sub-rows.
 */
export function computeArrangeTargets(
  values: number[],
  activeMask: boolean[],
  lethalMask: boolean[],
  scale: number,
  hasLethal: boolean,
): Map<number, ArrangeTarget> {
  const targets = new Map<number, ArrangeTarget>();
  if (values.length === 0) return targets;

  const colSp = scale * COL_SP;
  const rowSp = scale * ROW_SP;

  // Max dice per row before wrapping (leave 1 scale margin each side)
  const maxPerRow = Math.max(1, Math.floor((BOARD_W - scale) / colSp));

  // Group active dice by face value, split normal vs lethal
  const normalGroups: Record<number, number[]> = {};
  const lethalGroups: Record<number, number[]> = {};

  for (let i = 0; i < values.length; i++) {
    if (!activeMask[i]) continue;
    const v = values[i];
    const isLethal = lethalMask[i] ?? false;
    const target = isLethal ? lethalGroups : normalGroups;
    if (!target[v]) target[v] = [];
    target[v].push(i);
  }

  // ── Normal dice — rows by face value, with sub-row wrapping ──────────
  const normalVals = [1, 2, 3, 4, 5, 6].filter(v => (normalGroups[v]?.length ?? 0) > 0);
  if (normalVals.length > 0) {
    // Count total z-slots needed (each face value may use multiple sub-rows)
    const slotsPerVal = normalVals.map(v => Math.ceil(normalGroups[v].length / maxPerRow));
    const totalSlots  = slotsPerVal.reduce((a, b) => a + b, 0);

    const zMin  = hasLethal ? NORMAL_Z_MIN : -(BOARD_D / 2 - scale);
    const zMax  = hasLethal ? NORMAL_Z_MAX :  (BOARD_D / 2 - scale);
    const avail = zMax - zMin;
    const span  = (totalSlots - 1) * rowSp;
    let   z     = zMin + Math.max(0, (avail - span) / 2);

    for (let rowIdx = 0; rowIdx < normalVals.length; rowIdx++) {
      const v    = normalVals[rowIdx];
      const row  = normalGroups[v];
      const q    = faceUpQuaternion(v);
      const slots = slotsPerVal[rowIdx];

      for (let sub = 0; sub < slots; sub++) {
        const start = sub * maxPerRow;
        const slice = row.slice(start, start + maxPerRow);
        const lineStartX = -((slice.length - 1) * colSp) / 2;

        for (let colIdx = 0; colIdx < slice.length; colIdx++) {
          const dieIdx = slice[colIdx];
          targets.set(dieIdx, {
            position: [lineStartX + colIdx * colSp, scale / 2 + 0.01, z],
            quaternion: [q.x, q.y, q.z, q.w],
          });
        }

        z += rowSp;
      }
    }
  }

  // ── Lethal dice — rows at LETHAL_ZONE_Z, also with wrapping ──────────
  const lethalAll: { dieIdx: number; v: number }[] = [];
  for (const v of [1, 2, 3, 4, 5, 6]) {
    for (const dieIdx of lethalGroups[v] ?? []) {
      lethalAll.push({ dieIdx, v });
    }
  }
  if (lethalAll.length > 0) {
    const slots   = Math.ceil(lethalAll.length / maxPerRow);
    let   lz      = LETHAL_ZONE_Z - ((slots - 1) * rowSp) / 2;

    for (let sub = 0; sub < slots; sub++) {
      const start = sub * maxPerRow;
      const slice = lethalAll.slice(start, start + maxPerRow);
      const lineStartX = -((slice.length - 1) * colSp) / 2;

      for (let colIdx = 0; colIdx < slice.length; colIdx++) {
        const { dieIdx, v } = slice[colIdx];
        const q = faceUpQuaternion(v);
        targets.set(dieIdx, {
          position: [lineStartX + colIdx * colSp, scale / 2 + 0.01, lz],
          quaternion: [q.x, q.y, q.z, q.w],
        });
      }
      lz += rowSp;
    }
  }

  return targets;
}

/**
 * Scale formula: smaller dice for large counts so they fit on the board.
 * clamp(0.4, 0.85, 5.5/sqrt(n))
 */
export function computeScale(n: number): number {
  return Math.max(0.4, Math.min(0.85, 5.5 / Math.sqrt(Math.max(1, n))));
}
