/**
 * LAYER 1/2/6 — Zustand Store
 *
 * Centralises all dice state previously spread across 10 useState calls
 * in WarhammerBoard.tsx. Enables non-reactive reads in useFrame via
 * getState() and selective subscriptions in UI components.
 */

import { create } from 'zustand';
import type {
  GamePhase, DiceRollResult, DieColor, WarhPhase,
  RollHistoryEntry, SustainedX, ThrowParams, ArrangeTarget,
} from '../core/types';
import { rollDice, rollSpecificDice, generateSeed, addDice } from '../core/DiceEngine';
import { computeThrowParams } from '../core/ThrowCalculator';
import { computeArrangeTargets, computeScale } from '../core/ArrangeLayout';
import { PHYSICS_CONFIG } from '../physics/constants';

// ─── Store Interface ──────────────────────────────────────────────────

export interface DiceState {
  // --- Core state ---
  count: number;
  phase: GamePhase;
  rollResult: DiceRollResult | null;
  dieColor: DieColor;
  activeMask: boolean[] | null;
  lethalMask: boolean[] | null;
  history: RollHistoryEntry[];
  currentTurn: number;
  currentPhase: WarhPhase | null;
  sustainedX: SustainedX;

  // --- Physics animation state ---
  throwParams: ThrowParams[] | null;
  arrangeTargets: Map<number, ArrangeTarget> | null;
  arrangeProgress: number;

  // --- Actions ---
  addCount: (n: number) => void;
  throwDice: () => void;
  repeatThrow: () => void;
  deleteFace: (faceValue: number) => void;
  rerollFace: (faceValue: number) => void;
  toggleLethal: (faceValue: number) => void;
  sustainedHits: (faceValue: number) => void;
  reset: () => void;
  setDieColor: (c: DieColor) => void;
  setTurn: (t: number) => void;
  setWarhPhase: (p: WarhPhase | null) => void;
  setSustainedX: (x: SustainedX) => void;

  // --- Physics callbacks ---
  onAllDiceSettled: () => void;
  tickArrangeAnimation: (delta: number) => void;
}

// ─── Store Implementation ─────────────────────────────────────────────

export const useDiceStore = create<DiceState>((set, get) => ({
  // --- Initial state ---
  count: 0,
  phase: 'PREVIEW',
  rollResult: null,
  dieColor: 'white',
  activeMask: null,
  lethalMask: null,
  history: [],
  currentTurn: 1,
  currentPhase: null,
  sustainedX: 1,
  throwParams: null,
  arrangeTargets: null,
  arrangeProgress: 0,

  // ── Add dice (additive, resets to PREVIEW) ──────────────────────────

  addCount: (n) => {
    set(s => ({
      count: Math.min(120, s.count + n),
      phase: 'PREVIEW',
      throwParams: null,
      arrangeTargets: null,
      arrangeProgress: 0,
    }));
  },

  // ── Throw dice ──────────────────────────────────────────────────────

  throwDice: () => {
    const { count, dieColor, currentTurn, currentPhase } = get();
    if (count === 0) return;

    // 1. Deterministic result
    const seed = generateSeed();
    const result = rollDice(count, seed);

    // 2. Visual throw parameters (separate seed)
    const throwSeed = generateSeed();
    const throwParams = computeThrowParams(count, throwSeed);

    // 3. Update state
    set({
      rollResult: result,
      activeMask: new Array(count).fill(true),
      lethalMask: new Array(count).fill(false),
      throwParams,
      arrangeTargets: null,
      arrangeProgress: 0,
      phase: 'ROLLING',
    });

    // 4. History
    set(s => ({
      history: [...s.history, {
        id: `roll-${Date.now()}`,
        timestamp: Date.now(),
        turn: currentTurn,
        phase: currentPhase,
        diceCount: count,
        values: [...result.values],
        color: dieColor,
        seed,
        isReroll: false,
      }],
    }));
  },

  // ── Repeat throw ────────────────────────────────────────────────────

  repeatThrow: () => {
    const { rollResult, count, dieColor, currentTurn, currentPhase } = get();
    if (!rollResult || count === 0) return;

    const seed = generateSeed();
    const result = rollDice(count, seed);
    const throwSeed = generateSeed();
    const throwParams = computeThrowParams(count, throwSeed);

    set({
      rollResult: result,
      activeMask: new Array(count).fill(true),
      lethalMask: new Array(count).fill(false),
      throwParams,
      arrangeTargets: null,
      arrangeProgress: 0,
      phase: 'ROLLING',
    });

    set(s => ({
      history: [...s.history, {
        id: `repeat-${Date.now()}`,
        timestamp: Date.now(),
        turn: currentTurn,
        phase: currentPhase,
        diceCount: count,
        values: [...result.values],
        color: dieColor,
        seed,
        isReroll: true,
      }],
    }));
  },

  // ── Delete face-value group ─────────────────────────────────────────

  deleteFace: (faceValue) => {
    const { rollResult } = get();
    if (!rollResult) return;

    set(s => ({
      activeMask: s.activeMask?.map((active, i) =>
        active && rollResult.values[i] === faceValue ? false : active,
      ) ?? null,
      lethalMask: s.lethalMask?.map((lethal, i) =>
        rollResult.values[i] === faceValue ? false : lethal,
      ) ?? null,
    }));
  },

  // ── Re-roll face-value group (skips lethal) ─────────────────────────

  rerollFace: (faceValue) => {
    const { rollResult, activeMask, lethalMask, dieColor, currentTurn, currentPhase } = get();
    if (!rollResult) return;

    const indices: number[] = [];
    for (let i = 0; i < rollResult.values.length; i++) {
      if (activeMask && !activeMask[i]) continue;
      if (lethalMask && lethalMask[i]) continue;
      if (rollResult.values[i] === faceValue) indices.push(i);
    }
    if (indices.length === 0) return;

    const seed = generateSeed();
    const updated = rollSpecificDice(rollResult, indices, seed);

    // Compute throw params only for the rerolled dice
    const throwSeed = generateSeed();
    const allThrowParams = computeThrowParams(rollResult.count, throwSeed);
    // Only rerolled dice get real throw params; others get null-like (they stay in place)
    const throwParams = allThrowParams;

    set({
      rollResult: updated,
      throwParams,
      arrangeTargets: null,
      arrangeProgress: 0,
      phase: 'ROLLING',
    });

    set(s => ({
      history: [...s.history, {
        id: `reroll-${Date.now()}`,
        timestamp: Date.now(),
        turn: currentTurn,
        phase: currentPhase,
        diceCount: indices.length,
        values: indices.map(i => updated.values[i]),
        color: dieColor,
        seed,
        isReroll: true,
      }],
    }));
  },

  // ── Toggle lethal for a face-value group ────────────────────────────

  toggleLethal: (faceValue) => {
    const { rollResult, activeMask, lethalMask } = get();
    if (!rollResult || !activeMask) return;

    const activeOfValue = rollResult.values
      .map((v, i) => (v === faceValue && activeMask[i]) ? i : -1)
      .filter(i => i >= 0);
    if (activeOfValue.length === 0) return;

    const allLethal = activeOfValue.every(i => lethalMask?.[i] ?? false);
    const newLethal = !allLethal;

    const updatedLethalMask = (lethalMask ?? new Array(rollResult.values.length).fill(false))
      .map((lethal: boolean, i: number) => {
        if (!activeMask[i] || rollResult.values[i] !== faceValue) return lethal;
        return newLethal;
      });

    // Re-compute arrange targets for the new lethal layout
    const scale = computeScale(rollResult.count);
    const hasLethal = updatedLethalMask.some(Boolean);
    const targets = computeArrangeTargets(
      rollResult.values, activeMask, updatedLethalMask, scale, hasLethal,
    );

    set({
      lethalMask: updatedLethalMask,
      arrangeTargets: targets,
      arrangeProgress: 0,
      phase: 'ARRANGING',
    });
  },

  // ── Sustained Hits: add N × sustainedX new dice ─────────────────────

  sustainedHits: (faceValue) => {
    const { rollResult, activeMask, lethalMask, sustainedX, dieColor, currentTurn, currentPhase } = get();
    if (!rollResult || !activeMask) return;

    let n = 0;
    for (let i = 0; i < rollResult.values.length; i++) {
      if (!activeMask[i]) continue;
      if (lethalMask?.[i]) continue;
      if (rollResult.values[i] === faceValue) n++;
    }
    if (n === 0) return;

    const extra = Math.min(n * sustainedX, 120 - rollResult.count);
    if (extra <= 0) return;

    const seed = generateSeed();
    const updated = addDice(rollResult, extra, seed);
    const throwSeed = generateSeed();
    const throwParams = computeThrowParams(updated.count, throwSeed);

    set(s => ({
      rollResult: updated,
      count: updated.count,
      activeMask: [...(s.activeMask ?? []), ...new Array(extra).fill(true)],
      lethalMask: [...(s.lethalMask ?? []), ...new Array(extra).fill(false)],
      throwParams,
      arrangeTargets: null,
      arrangeProgress: 0,
      phase: 'ROLLING',
    }));

    set(s => ({
      history: [...s.history, {
        id: `sus-${Date.now()}`,
        timestamp: Date.now(),
        turn: currentTurn,
        phase: currentPhase,
        diceCount: extra,
        values: updated.values.slice(-extra),
        color: dieColor,
        seed,
        isReroll: false,
      }],
    }));
  },

  // ── Reset ───────────────────────────────────────────────────────────

  reset: () => {
    set({
      count: 0,
      phase: 'PREVIEW',
      rollResult: null,
      activeMask: null,
      lethalMask: null,
      throwParams: null,
      arrangeTargets: null,
      arrangeProgress: 0,
    });
  },

  // ── Simple setters ──────────────────────────────────────────────────

  setDieColor: (c) => set({ dieColor: c }),
  setTurn: (t) => set({ currentTurn: t }),
  setWarhPhase: (p) => set({ currentPhase: p }),
  setSustainedX: (x) => set({ sustainedX: x }),

  // ── Physics callbacks ───────────────────────────────────────────────

  onAllDiceSettled: () => {
    const { rollResult, activeMask, lethalMask } = get();
    if (!rollResult || !activeMask || !lethalMask) return;

    const scale = computeScale(rollResult.count);
    const hasLethal = lethalMask.some(Boolean);
    const targets = computeArrangeTargets(
      rollResult.values, activeMask, lethalMask, scale, hasLethal,
    );

    set({
      phase: 'ARRANGING',
      arrangeTargets: targets,
      arrangeProgress: 0,
    });
  },

  tickArrangeAnimation: (delta) => {
    const { arrangeProgress } = get();
    const next = Math.min(1, arrangeProgress + delta * PHYSICS_CONFIG.arrangeSpeed);
    set({ arrangeProgress: next });
    if (next >= 1) {
      set({ phase: 'ARRANGED' });
    }
  },
}));
