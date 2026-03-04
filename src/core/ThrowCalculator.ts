/**
 * LAYER 1 — Throw Calculator
 *
 * Computes launch parameters (impulse, torque, start position) for each die.
 * Uses seeded RNG for reproducible visual throws (does NOT affect roll results).
 */

import type { ThrowParams } from './types';
import { PHYSICS_CONFIG } from '../physics/constants';

// ─── Seeded RNG (same Mulberry32 as DiceEngine) ─────────────────────────

function mulberry32(seed: number) {
  let s = seed | 0;
  return (): number => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Map [0,1) → [min, max) */
function lerp(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

/**
 * Compute throw parameters for `count` dice.
 *
 * Start positions are arranged in a loose arc above the board.
 * Impulses throw dice downward and forward with randomised spread.
 * Torques produce convincing tumbling.
 *
 * @param count - Number of dice to throw
 * @param seed  - Seed for deterministic visual throw
 */
export function computeThrowParams(count: number, seed: string): ThrowParams[] {
  if (count === 0) return [];

  const rng = mulberry32(hashString(seed));
  const {
    throwHeightMin, throwHeightMax,
    impulseVerticalMin, impulseVerticalMax, impulseHorizontalRange,
    torqueRange, boardWidth,
  } = PHYSICS_CONFIG;

  const params: ThrowParams[] = new Array(count);

  // Spread dice along an arc above the board
  const spreadX = Math.min(boardWidth * 0.6, count * 0.8);

  for (let i = 0; i < count; i++) {
    // Start position: arc above the board, behind center
    const t = count === 1 ? 0.5 : i / (count - 1);
    const x = (t - 0.5) * spreadX + lerp(rng, -0.3, 0.3);
    const y = lerp(rng, throwHeightMin, throwHeightMax);
    const z = lerp(rng, -8, -5); // behind center

    // Impulse: forward + downward + lateral scatter
    const iy = lerp(rng, impulseVerticalMin, impulseVerticalMax);
    const ix = lerp(rng, -impulseHorizontalRange, impulseHorizontalRange);
    const iz = lerp(rng, 2, 8); // forward toward board center

    // Torque: random spin on all 3 axes
    const tx = lerp(rng, -torqueRange, torqueRange);
    const ty = lerp(rng, -torqueRange, torqueRange);
    const tz = lerp(rng, -torqueRange, torqueRange);

    params[i] = {
      startPosition: { x, y, z },
      impulse: { x: ix, y: iy, z: iz },
      torque: { x: tx, y: ty, z: tz },
    };
  }

  return params;
}
