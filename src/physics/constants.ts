/**
 * LAYER 2 — Physics Configuration Constants
 *
 * Tuning values for Rapier3D simulation.
 * Physics is visual-only — it does not determine dice results.
 */

export const PHYSICS_CONFIG = {
  /** World gravity — strong for quick, satisfying drops */
  gravity: [0, -50, 0] as const,

  /** Coefficient of restitution — moderate bounce */
  restitution: 0.3,

  /** Surface friction for table contact */
  friction: 0.7,

  /** Higher damping helps all dice settle, especially with many */
  linearDamping: 0.5,
  angularDamping: 0.55,

  /** Settle detection thresholds */
  settleLinvelThreshold: 0.08,
  settleAngvelThreshold: 0.1,

  /** Force-settle after this many seconds to prevent infinite bounce */
  settleTimeoutSeconds: 9,

  /** Frames of consecutive settling before triggering arrange */
  settleFrameCount: 15,

  /** Speed of the arrange lerp animation (progress per second) */
  arrangeSpeed: 2.5,

  /** Throw height range (y-coordinate of start position) */
  throwHeightMin: 6,
  throwHeightMax: 10,

  /** Impulse magnitude ranges */
  impulseVerticalMin: 8,
  impulseVerticalMax: 15,
  impulseHorizontalRange: 5,

  /** Torque magnitude range (per axis) */
  torqueRange: 15,

  /** Board geometry (must match DiceScene board dimensions) */
  boardWidth: 22,
  boardDepth: 16,

  /** Wall height for invisible boundaries */
  wallHeight: 8,
} as const;
