/**
 * LAYER 2 — Settle Detection
 *
 * Determines whether a rigid body has come to rest by checking
 * linear and angular velocity magnitudes against thresholds.
 */

import { PHYSICS_CONFIG } from './constants';

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

function magnitude(v: Vec3Like): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

/**
 * Returns true when both linear and angular velocities are below threshold.
 *
 * @param linvel  - Linear velocity vector
 * @param angvel  - Angular velocity vector
 * @param threshold - Optional override for both thresholds
 */
export function isBodySettled(
  linvel: Vec3Like,
  angvel: Vec3Like,
  threshold?: number,
): boolean {
  const linThresh = threshold ?? PHYSICS_CONFIG.settleLinvelThreshold;
  const angThresh = threshold ?? PHYSICS_CONFIG.settleAngvelThreshold;
  return magnitude(linvel) < linThresh && magnitude(angvel) < angThresh;
}
