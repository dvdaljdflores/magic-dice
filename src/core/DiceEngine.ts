/**
 * LAYER 1 — DiceEngine: Deterministic Mathematical Core
 *
 * Result-first architecture: values + quaternions computed via seeded RNG
 * before any visual update. Same seed + count = same results every time.
 */

import * as THREE from 'three';
import type { DiceRollResult } from './types';

// ─── Seeded RNG: Mulberry32 ────────────────────────────────────────────────
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

// ─── Face → Quaternion Map ────────────────────────────────────────────────
//
// BoxGeometry face normals (Three.js default axis convention):
//   +Y face → die face 1  (top)      -Y face → die face 6  (bottom, opposite 1)
//   +Z face → die face 2  (front)    -Z face → die face 5  (back,   opposite 2)
//   +X face → die face 3  (right)    -X face → die face 4  (left,   opposite 3)
//
// Each quaternion rotates the die so face N's normal points to +Y world (face up).

const _euler = new THREE.Euler();

export function faceUpQuaternion(face: number): THREE.Quaternion {
  switch (face) {
    case 1: return new THREE.Quaternion();                                                // +Y already up
    case 2: return new THREE.Quaternion().setFromEuler(_euler.set(-Math.PI / 2, 0, 0)); // +Z → +Y
    case 3: return new THREE.Quaternion().setFromEuler(_euler.set(0, 0,  Math.PI / 2)); // +X → +Y
    case 4: return new THREE.Quaternion().setFromEuler(_euler.set(0, 0, -Math.PI / 2)); // -X → +Y
    case 5: return new THREE.Quaternion().setFromEuler(_euler.set( Math.PI / 2, 0, 0)); // -Z → +Y
    case 6: return new THREE.Quaternion().setFromEuler(_euler.set(Math.PI, 0, 0));       // -Y → +Y
    default: return new THREE.Quaternion();
  }
}

/**
 * PREVIEW orientation: face 6 faces UP (+Y world).
 *
 * Rx(π) maps -Y local → +Y world, so face 6 (bottom face) appears on top.
 * All dice show "6" when viewed from above in PREVIEW state.
 */
export const PREVIEW_QUATERNION = new THREE.Quaternion()
  .setFromEuler(new THREE.Euler(Math.PI, 0, 0));

// ─── Main Roll Function ───────────────────────────────────────────────────

export function rollDice(count: number, seed: string): DiceRollResult {
  const rng = mulberry32(hashString(seed));

  const values: number[] = [];
  const targetQuaternions = new Float32Array(count * 4);

  for (let i = 0; i < count; i++) {
    const value = Math.floor(rng() * 6) + 1;
    values.push(value);

    const yaw   = rng() * Math.PI * 2;
    const faceQ = faceUpQuaternion(value);
    const yRotQ = new THREE.Quaternion().setFromEuler(_euler.set(0, yaw, 0));
    faceQ.multiply(yRotQ);

    const off = i * 4;
    targetQuaternions[off]     = faceQ.x;
    targetQuaternions[off + 1] = faceQ.y;
    targetQuaternions[off + 2] = faceQ.z;
    targetQuaternions[off + 3] = faceQ.w;
  }

  return { seed, count, values, targetQuaternions };
}

export function generateSeed(): string {
  return `wh40k-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Re-roll only the dice at `indicesToReroll`, keeping the rest intact. */
export function rollSpecificDice(
  existingResult: DiceRollResult,
  indicesToReroll: number[],
  newSeed: string,
): DiceRollResult {
  const rng = mulberry32(hashString(newSeed));
  const values = [...existingResult.values];
  const targetQuaternions = new Float32Array(existingResult.targetQuaternions);

  for (const i of indicesToReroll) {
    const value = Math.floor(rng() * 6) + 1;
    values[i] = value;
    const yaw   = rng() * Math.PI * 2;
    const faceQ = faceUpQuaternion(value);
    const yRotQ = new THREE.Quaternion().setFromEuler(_euler.set(0, yaw, 0));
    faceQ.multiply(yRotQ);
    const off = i * 4;
    targetQuaternions[off]     = faceQ.x;
    targetQuaternions[off + 1] = faceQ.y;
    targetQuaternions[off + 2] = faceQ.z;
    targetQuaternions[off + 3] = faceQ.w;
  }

  return { seed: newSeed, count: existingResult.count, values, targetQuaternions };
}

/**
 * Append `count` new dice to an existing DiceRollResult.
 * Used for Sustained Hits: extra dice are added without re-rolling originals.
 */
export function addDice(
  existing: DiceRollResult,
  count: number,
  seed: string,
): DiceRollResult {
  const rng       = mulberry32(hashString(seed));
  const newValues = new Array<number>(count);
  const newQuats  = new Float32Array(count * 4);

  for (let i = 0; i < count; i++) {
    const value = Math.floor(rng() * 6) + 1;
    newValues[i] = value;
    const yaw   = rng() * Math.PI * 2;
    const faceQ = faceUpQuaternion(value);
    const yRotQ = new THREE.Quaternion().setFromEuler(_euler.set(0, yaw, 0));
    faceQ.multiply(yRotQ);
    const off = i * 4;
    newQuats[off]     = faceQ.x;
    newQuats[off + 1] = faceQ.y;
    newQuats[off + 2] = faceQ.z;
    newQuats[off + 3] = faceQ.w;
  }

  const mergedQuats = new Float32Array((existing.count + count) * 4);
  mergedQuats.set(existing.targetQuaternions, 0);
  mergedQuats.set(newQuats, existing.count * 4);

  return {
    seed,
    count: existing.count + count,
    values: [...existing.values, ...newValues],
    targetQuaternions: mergedQuats,
  };
}
