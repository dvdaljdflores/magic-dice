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
  restitution: 0.12,

  /** Surface friction for table contact */
  friction: 0.7,

  /** High damping — dice settle after 2-3 bounces */
  linearDamping: 0.85,
  angularDamping: 0.88,

  /** Settle detection thresholds */
  settleLinvelThreshold: 0.08,
  settleAngvelThreshold: 0.1,

  /** Force-settle after this many seconds to prevent infinite bounce */
  settleTimeoutSeconds: 5,

  /** Frames of consecutive settling before triggering arrange */
  settleFrameCount: 12,

  /** Speed of the arrange lerp animation (progress per second) */
  arrangeSpeed: 2.5,

  /** Throw height range (y-coordinate of start position) */
  throwHeightMin: 2,
  throwHeightMax: 5,

  /** Impulse magnitude ranges */
  impulseVerticalMin: 5,
  impulseVerticalMax: 10,
  impulseHorizontalRange: 1.5,

  /** Torque magnitude range (per axis) */
  torqueRange: 12,

  /** Board geometry (must match DiceScene board dimensions) */
  boardWidth: 22,
  boardDepth: 16,

  /** Wall height for invisible boundaries */
  wallHeight: 20,
} as const;
