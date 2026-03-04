// ============================================================
// LAYER 2 — Game Phase State Machine
// ============================================================
export type GamePhase =
  | 'PREVIEW'    // Dice visible in grid, no physics
  | 'ROLLING'    // Impulses applied, dice in the air
  | 'SETTLING'   // Dice bouncing, losing velocity
  | 'ARRANGING'  // Lerp from physics positions to sorted layout
  | 'ARRANGED';  // Dice sorted by face value, actions available

// ============================================================
// LAYER 4 — Warhammer Phase + Rules
// ============================================================
export type WarhPhase = 'DISPARO' | 'CARGA' | 'COMBATE' | 'MORAL';

export const WARH_PHASE_LABEL: Record<WarhPhase, string> = {
  DISPARO: 'Fase de disparo',
  CARGA:   'Fase de carga',
  COMBATE: 'Fase de combate',
  MORAL:   'Tiro de moral',
};

export interface RulesConfig {
  successThreshold: number;
  criticalValue: number;
  sustainedHitsX: number;
  lethalHits: boolean;
}

export const DEFAULT_RULES_CONFIG: RulesConfig = {
  successThreshold: 4,
  criticalValue: 6,
  sustainedHitsX: 0,
  lethalHits: false,
};

// ============================================================
// LAYER 6 — History + Color Types
// ============================================================
export type DieColor = 'white' | 'red' | 'blue' | 'green' | 'yellow' | 'orange' | 'purple' | 'black';
/** Extra dice generated per sustained-hit critical. */
export type SustainedX = 1 | 2 | 3;

export interface RollHistoryEntry {
  id: string;
  timestamp: number;
  turn: number;
  phase: WarhPhase | null;
  diceCount: number;
  /** Face value per die index */
  values: number[];
  color: DieColor;
  seed: string;
  isReroll: boolean;
  /** Optional label for non-roll events (del, roll≤N, lethal, sus, undo) */
  actionLabel?: string;
}

// ============================================================
// LAYER 1 — Dice Engine Result Types
// ============================================================
export interface DiceRollResult {
  seed: string;
  count: number;
  /** Face value 1-6 per die */
  values: number[];
  /**
   * Flat Float32Array: 4 floats per die (x,y,z,w quaternion).
   * Computed BEFORE any visual update. Same seed+count = same values.
   */
  targetQuaternions: Float32Array;
}

/** Request to re-roll a specific subset of the current dice pool */
export interface RerollRequest {
  indices: number[];
  updatedResult: DiceRollResult;
}

// ============================================================
// LAYER 2b — Physics Animation Types
// ============================================================

/** Launch parameters for a single die */
export interface ThrowParams {
  impulse: { x: number; y: number; z: number };
  torque:  { x: number; y: number; z: number };
  startPosition: { x: number; y: number; z: number };
}

/** Target position + rotation for the arrange animation */
export interface ArrangeTarget {
  position: [number, number, number];
  quaternion: [number, number, number, number];
}
