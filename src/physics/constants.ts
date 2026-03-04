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
  friction: 0.6,

  /** Damping to help dice settle faster */
  linearDamping: 0.3,
  angularDamping: 0.2,

  /** Settle detection thresholds */
  settleLinvelThreshold: 0.08,
  settleAngvelThreshold: 0.1,

  /** Speed of the arrange lerp animation (progress per second) */
  arrangeSpeed: 3.0,

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
