/**
 * LAYER 1 — Arrange Layout Calculator
 *
 * Pure function that computes target positions and quaternions for the
 * ARRANGED display. Dice are left-aligned per face-value row, stacking
 * in Y when more than MAX_PER_STACK share the same value.
 *
 * Mobile layout mode (set via setMobileLayoutMode):
 *   BOARD_W = 16, BOARD_D = 22 — uses vertical space better on portrait screens.
 */

import type { ArrangeTarget } from './types';
import { faceUpQuaternion } from './DiceEngine';

const ROW_SP        = 2.0;
const COL_SP        = 1.35;

const BOARD_W       = 22;
const BOARD_D       = 16;

const BOARD_W_M     = 16;
const BOARD_D_M     = 22;

const LETHAL_ZONE_Z = 6.0;

const NORMAL_Z_MIN  = -7.0;
const NORMAL_Z_MAX  =  1.5;

const NORMAL_Z_MIN_M = -8.0;
const NORMAL_Z_MAX_M =  2.0;

const MAX_PER_STACK_DESKTOP = 10;
const MAX_PER_STACK_MOBILE  = 6;

const LABEL_SPACE   = 2.0;

/** Module-level flag set by WarhammerBoard. Defaults to false (desktop). */
let _mobileMode = false;

/**
 * Call this from WarhammerBoard whenever isMobile changes.
 */
export function setMobileLayoutMode(mobile: boolean): void {
  _mobileMode = mobile;
}

export function isMobileLayout(): boolean {
  return _mobileMode;
}

/**
 * Compute arranged positions and quaternions for each active die.
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

  const boardW = _mobileMode ? BOARD_W_M : BOARD_W;
  const boardD = _mobileMode ? BOARD_D_M : BOARD_D;

  const maxPerStack = _mobileMode ? MAX_PER_STACK_MOBILE : MAX_PER_STACK_DESKTOP;

  const colSp  = scale * COL_SP;
  const rowSp  = scale * ROW_SP;
  const stackH = scale * 0.85;

  // Group active dice by face value
  const normalGroups: Record<number, number[]> = {};
  const lethalGroups: Record<number, number[]> = {};

  for (let i = 0; i < values.length; i++) {
    if (!activeMask[i]) continue;

    const v = values[i];
    const group = (lethalMask[i] ?? false) ? lethalGroups : normalGroups;

    if (!group[v]) group[v] = [];
    group[v].push(i);
  }

  // ─────────────────────────────
  // Normal dice rows
  // ─────────────────────────────

  const normalVals = [1,2,3,4,5,6].filter(
    v => (normalGroups[v]?.length ?? 0) > 0
  );

  // Compute leftX: left-aligned on desktop, centered on mobile
  let leftX: number;
  if (_mobileMode) {
    const maxInRow = normalVals.reduce(
      (mx, v) => Math.max(mx, Math.min(normalGroups[v]?.length ?? 0, maxPerStack)), 0
    );
    const gridW = (maxInRow - 1) * colSp;
    leftX = -(gridW / 2);
  } else {
    leftX = -(boardW / 2) + LABEL_SPACE + scale / 2;
  }

  if (normalVals.length > 0) {

    const totalRows = normalVals.length;

    const zMinDefault = _mobileMode ? NORMAL_Z_MIN_M : NORMAL_Z_MIN;
    const zMaxDefault = _mobileMode ? NORMAL_Z_MAX_M : NORMAL_Z_MAX;

    const zMin = hasLethal ? zMinDefault : -(boardD / 2 - scale);
    const zMax = hasLethal ? zMaxDefault :  (boardD / 2 - scale);

    const avail = zMax - zMin;
    const span  = (totalRows - 1) * rowSp;

    let z = zMin + Math.max(0, (avail - span) / 2);

    for (const v of normalVals) {

      const row = normalGroups[v];
      const q   = faceUpQuaternion(v);

      for (let k = 0; k < row.length; k++) {

        const col      = k % maxPerStack;
        const stackIdx = Math.floor(k / maxPerStack);

        targets.set(row[k], {
          position: [
            leftX + col * colSp,
            scale / 2 + 0.01 + stackIdx * stackH,
            z
          ],
          quaternion: [q.x, q.y, q.z, q.w]
        });

      }

      z += rowSp;
    }
  }

  // ─────────────────────────────
  // Lethal dice
  // ─────────────────────────────

  const lethalAll: { dieIdx: number; v: number }[] = [];

  for (const v of [1,2,3,4,5,6]) {
    for (const dieIdx of lethalGroups[v] ?? []) {
      lethalAll.push({ dieIdx, v });
    }
  }

  if (lethalAll.length > 0) {

    const lethalCols   = Math.min(lethalAll.length, maxPerStack);
    const lethalStartX = -(lethalCols - 1) * colSp / 2;

    for (let k = 0; k < lethalAll.length; k++) {

      const col      = k % maxPerStack;
      const stackIdx = Math.floor(k / maxPerStack);

      const { dieIdx, v } = lethalAll[k];
      const q = faceUpQuaternion(v);

      targets.set(dieIdx, {
        position: [
          lethalStartX + col * colSp,
          scale / 2 + 0.01 + stackIdx * stackH,
          LETHAL_ZONE_Z
        ],
        quaternion: [q.x, q.y, q.z, q.w]
      });

    }
  }

  return targets;
}

/**
 * Scale formula
 */
export function computeScale(n: number): number {
  return Math.max(
    0.4,
    Math.min(
      0.85,
      5.5 / Math.sqrt(Math.max(1, n))
    )
  );
}
