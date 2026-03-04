/**
 * LAYER 1 — Arrange Layout Calculator
 *
 * Pure function that computes target positions and quaternions for the
 * ARRANGED display (dice sorted by face value in rows).
 * Extracted from DiceScene.tsx inline layout logic.
 */

import type { ArrangeTarget } from './types';
import { faceUpQuaternion } from './DiceEngine';

// Layout constants (must match DiceScene.tsx / board geometry)
const ROW_SP   = 2.0;
const COL_SP   = 1.35;
const BOARD_D  = 16;
const LETHAL_ZONE_Z  = 6.0;
const NORMAL_Z_MIN   = -7.0;
const NORMAL_Z_MAX   =  1.5;

/**
 * Compute arranged positions and quaternions for each active die.
 *
 * @param values     - Face values per die index
 * @param activeMask - Which dice are active (visible)
 * @param lethalMask - Which dice are marked lethal (Mortal Wounds)
 * @param scale      - Current die scale factor
 * @param hasLethal  - Whether any lethal dice exist
 * @returns Map from die index → ArrangeTarget (only active dice)
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

  // ── Normal dice — rows by face value ──────────────────────────────
  const normalVals = [1, 2, 3, 4, 5, 6].filter(v => (normalGroups[v]?.length ?? 0) > 0);
  if (normalVals.length > 0) {
    const rowSp  = scale * ROW_SP;
    const colSp  = scale * COL_SP;
    const zMin   = hasLethal ? NORMAL_Z_MIN : -(BOARD_D / 2 - scale);
    const zMax   = hasLethal ? NORMAL_Z_MAX :  (BOARD_D / 2 - scale);
    const avail  = zMax - zMin;
    const span   = (normalVals.length - 1) * rowSp;
    const startZ = zMin + Math.max(0, (avail - span) / 2);
    const maxLen = Math.max(...normalVals.map(v => normalGroups[v].length));
    const startX = -((maxLen - 1) * colSp) / 2;

    for (let rowIdx = 0; rowIdx < normalVals.length; rowIdx++) {
      const v   = normalVals[rowIdx];
      const row = normalGroups[v];
      const z   = startZ + rowIdx * rowSp;
      const q   = faceUpQuaternion(v);

      for (let colIdx = 0; colIdx < row.length; colIdx++) {
        const dieIdx = row[colIdx];
        targets.set(dieIdx, {
          position: [startX + colIdx * colSp, scale / 2 + 0.01, z],
          quaternion: [q.x, q.y, q.z, q.w],
        });
      }
    }
  }

  // ── Lethal dice — single row at LETHAL_ZONE_Z ─────────────────────
  const lethalAll: { dieIdx: number; v: number }[] = [];
  for (const v of [1, 2, 3, 4, 5, 6]) {
    for (const dieIdx of lethalGroups[v] ?? []) {
      lethalAll.push({ dieIdx, v });
    }
  }
  if (lethalAll.length > 0) {
    const colSp  = scale * COL_SP;
    const startX = -((lethalAll.length - 1) * colSp) / 2;

    for (let colIdx = 0; colIdx < lethalAll.length; colIdx++) {
      const { dieIdx, v } = lethalAll[colIdx];
      const q = faceUpQuaternion(v);
      targets.set(dieIdx, {
        position: [startX + colIdx * colSp, scale / 2 + 0.01, LETHAL_ZONE_Z],
        quaternion: [q.x, q.y, q.z, q.w],
      });
    }
  }

  return targets;
}

/** Scale formula — same as DiceScene.tsx */
export function computeScale(n: number): number {
  return Math.max(0.55, Math.min(1.5, 9 / Math.sqrt(Math.max(1, n))));
}
