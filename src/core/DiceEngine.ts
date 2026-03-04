/**
 * LAYER 1 — DiceEngine: Deterministic Mathematical Core
 *
 * LAYER 7 — Key design decisions:
 *
 * 1. RESULT-FIRST ARCHITECTURE:
 *    Results are computed via seeded RNG BEFORE any physics runs.
 *    Physics is purely a visual representation — it is GUIDED to match
 *    the pre-computed result. This guarantees mathematical integrity:
 *    the result cannot change due to physics instability.
 *
 * 2. WHY RAPIER OVER cannon-es:
 *    - Rapier (WASM) has deterministic broadphase + narrowphase.
 *    - cannon-es has poor angular damping behavior for precise final-face control.
 *    - Rapier exposes setRotation() on sleeping bodies without side-effects,
 *      enabling the imperceptible snap at the end of SETTLING.
 *    - Rapier's WASM build is ~4x faster than cannon-es on mobile hardware.
 *
 * 3. SEED REPRODUCIBILITY:
 *    Every roll is tied to a string seed → numeric hash → mulberry32 RNG.
 *    Same seed + count always produces the same results and quaternion targets.
 */

import * as THREE from 'three';
import type { DiceRollResult } from './types';

// ─── Seeded RNG: Mulberry32 ────────────────────────────────────────────────
// Fast, small, good statistical distribution. 32-bit state.
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
//   +X face → die face 3  (right side)
//   -X face → die face 4  (left side)
//   +Y face → die face 1  (top — default up)
//   -Y face → die face 6  (bottom — opposite 1, sum = 7)
//   +Z face → die face 2  (front)
//   -Z face → die face 5  (back — opposite 2)
//
// Standard D6: opposite faces always sum to 7 (1↔6, 2↔5, 3↔4).
//
// Each quaternion rotates the die such that face N's normal points to +Y world.
// This quaternion is the TARGET for SETTLING-phase corrective torques.

const _euler = new THREE.Euler();

export function faceUpQuaternion(face: number): THREE.Quaternion {
  switch (face) {
    case 1: return new THREE.Quaternion(); // +Y already up — identity
    case 2: return new THREE.Quaternion().setFromEuler(_euler.set(-Math.PI / 2, 0, 0)); // +Z → +Y
    case 3: return new THREE.Quaternion().setFromEuler(_euler.set(0, 0, Math.PI / 2));  // +X → +Y
    case 4: return new THREE.Quaternion().setFromEuler(_euler.set(0, 0, -Math.PI / 2)); // -X → +Y
    case 5: return new THREE.Quaternion().setFromEuler(_euler.set(Math.PI / 2, 0, 0));  // -Z → +Y
    case 6: return new THREE.Quaternion().setFromEuler(_euler.set(Math.PI, 0, 0));       // -Y → +Y
    default: return new THREE.Quaternion();
  }
}

/**
 * PREVIEW orientation: face 6 points backward (-Z world direction).
 *
 * Face 6 = -Y local. Rotating around X by -90° maps -Y → -Z. ✓
 * All dice share this orientation in PREVIEW state for visual uniformity.
 */
export const PREVIEW_QUATERNION = new THREE.Quaternion()
  .setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));

// ─── Main Roll Function ───────────────────────────────────────────────────

export function rollDice(count: number, seed: string): DiceRollResult {
  const rng = mulberry32(hashString(seed));

  const values: number[] = [];
  const targetQuaternions = new Float32Array(count * 4);

  for (let i = 0; i < count; i++) {
    const value = Math.floor(rng() * 6) + 1; // 1–6, uniform
    values.push(value);

    // Add random Y-axis rotation so dice with the same face don't look identical.
    // The Y-rotation does not affect which face is UP — it only varies the yaw.
    const yaw = rng() * Math.PI * 2;
    const faceQ = faceUpQuaternion(value);
    const yRotQ = new THREE.Quaternion().setFromEuler(_euler.set(0, yaw, 0));
    // Apply yaw BEFORE face-up rotation (local yaw around die's own Y)
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

/**
 * Re-roll only the dice at `indicesToReroll`, keeping the rest intact.
 * Returns a full DiceRollResult with updated values + quaternions for those indices.
 *
 * LAYER 7 — Partial re-roll preserves the result-first guarantee:
 * New values are computed mathematically BEFORE the physics re-roll animation starts.
 */
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
    const yaw = rng() * Math.PI * 2;
    const faceQ = faceUpQuaternion(value);
    const yRotQ = new THREE.Quaternion().setFromEuler(_euler.set(0, yaw, 0));
    faceQ.multiply(yRotQ);
    const off = i * 4;
    targetQuaternions[off]     = faceQ.x;
    targetQuaternions[off + 1] = faceQ.y;
    targetQuaternions[off + 2] = faceQ.z;
    targetQuaternions[off + 3] = faceQ.w;
  }

  return {
    seed: newSeed,
    count: existingResult.count,
    values,
    targetQuaternions,
  };
}
