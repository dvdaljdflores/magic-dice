/**
 * Shared THREE.js singletons and utility functions for the DiceScene sub-components.
 *
 * These mutable objects are reused every frame to avoid GC pressure.
 * Never duplicate — always import from here.
 */

import * as THREE from 'three';
import { isMobileLayout } from '../../core/ArrangeLayout';
import { PHYSICS_CONFIG } from '../../physics/constants';
import { MAX_DICE } from '../../constants/theme';

// ── Mutable temp objects (reused per frame) ──────────────────────────
export const _p    = new THREE.Vector3();
export const _q    = new THREE.Quaternion();
export const _sc   = new THREE.Vector3(1, 1, 1);
export const _mat  = new THREE.Matrix4();
export const _zero = new THREE.Matrix4().makeScale(0, 0, 0);

// ── Board dimensions (depend on mobile flag) ─────────────────────────
export function getBoardWidth(): number {
  return isMobileLayout() ? 16 : PHYSICS_CONFIG.boardWidth;
}

export function getBoardDepth(): number {
  return isMobileLayout() ? 22 : PHYSICS_CONFIG.boardDepth;
}

export let BOARD_W = getBoardWidth();
export let BOARD_D = getBoardDepth();

export function refreshBoardDimensions(): void {
  BOARD_W = getBoardWidth();
  BOARD_D = getBoardDepth();
}

// ── Constants ────────────────────────────────────────────────────────
export const LETHAL_ZONE_Z = 6.0;
export { MAX_DICE };

// ── Helpers ──────────────────────────────────────────────────────────
export function computeScale(n: number): number {
  return Math.max(0.4, Math.min(0.85, 5.5 / Math.sqrt(Math.max(1, n))));
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
