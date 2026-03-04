/**
 * LAYER 1/2/6 — Zustand Store
 *
 * Centralises all dice state. Enables non-reactive reads in useFrame via
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

// ─── Undo Snapshot ───────────────────────────────────────────────────

interface UndoSnapshot {
  rollResult: DiceRollResult | null;
  activeMask: boolean[] | null;
  lethalMask: boolean[] | null;
  sustainedMask: boolean[] | null;
  count: number;
}

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

  // --- Undo ---
  undoStack: UndoSnapshot[];

  // --- Physics animation state ---
  throwParams: ThrowParams[] | null;
  arrangeTargets: Map<number, ArrangeTarget> | null;
  arrangeProgress: number;
  /** Dice that stay fixed during physics (lethal dice when re-throwing, or existing dice when adding). */
  lockedTargets: Map<number, ArrangeTarget> | null;
  /** Tracks which dice were added by Sustained Hits (shown in a distinct color). */
  sustainedMask: boolean[] | null;

  /** When false, throwDice/repeatThrow/addCount skip physics and go directly to ARRANGING. */
  animEnabled: boolean;
  setAnimEnabled: (v: boolean) => void;

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
  undo: () => void;

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
  undoStack: [],
  throwParams: null,
  arrangeTargets: null,
  arrangeProgress: 0,
  lockedTargets: null,
  sustainedMask: null,
  animEnabled: true,

  // ── Add dice ─────────────────────────────────────────────────────────
  // In ARRANGED: new dice fall with physics; existing dice stay locked.
  // Otherwise: increments count and returns to PREVIEW.

  addCount: (n) => {
    const { phase, rollResult, activeMask, lethalMask, sustainedMask, count, arrangeTargets, animEnabled } = get();

    if (phase === 'ARRANGED' && rollResult && activeMask && arrangeTargets) {
      const extra = Math.min(n, 120 - count);
      if (extra <= 0) return;

      const seed    = generateSeed();
      const updated = addDice(rollResult, extra, seed);
      const newCount      = updated.count;
      const newActiveMask = [...activeMask, ...new Array(extra).fill(true)];
      const newLethalMask = [...(lethalMask ?? []), ...new Array(extra).fill(false)];
      const newSustainedMask = [...(sustainedMask ?? new Array(count).fill(false)), ...new Array(extra).fill(false)];

      if (animEnabled) {
        // Lock all current dice in place — only the new ones fall with physics
        const locked = new Map(arrangeTargets);
        const throwSeed  = generateSeed();
        const throwParams = computeThrowParams(newCount, throwSeed);
        set({
          count: newCount,
          rollResult: updated,
          activeMask: newActiveMask,
          lethalMask: newLethalMask,
          sustainedMask: newSustainedMask,
          throwParams,
          lockedTargets: locked,
          arrangeTargets: null,
          arrangeProgress: 0,
          phase: 'ROLLING',
        });
      } else {
        // Skip physics — position dice instantly (no drop animation).
        const scale    = computeScale(newCount);
        const hasLethal = newLethalMask.some(Boolean);
        const targets  = computeArrangeTargets(updated.values, newActiveMask, newLethalMask, scale, hasLethal);
        set({
          count: newCount,
          rollResult: updated,
          activeMask: newActiveMask,
          lethalMask: newLethalMask,
          sustainedMask: newSustainedMask,
          throwParams: null,
          lockedTargets: null,
          arrangeTargets: targets,
          arrangeProgress: 1,
          phase: 'ARRANGED',
        });
      }
    } else {
      set(s => ({
        count: Math.min(120, s.count + n),
        phase: 'PREVIEW',
        throwParams: null,
        arrangeTargets: null,
        arrangeProgress: 0,
        lockedTargets: null,
      }));
    }
  },

  // ── Throw dice ──────────────────────────────────────────────────────
  // When lethal dice are present, they stay locked; only non-lethal dice fly.

  throwDice: () => {
    const { count, dieColor, currentTurn, currentPhase, phase, rollResult, lethalMask, arrangeTargets, animEnabled } = get();
    if (count === 0) return;

    const seed = generateSeed();
    let result: DiceRollResult;
    let newLethalMask: boolean[];
    let locked: Map<number, ArrangeTarget> | null = null;

    const hasLockedDice = phase === 'ARRANGED'
      && rollResult != null
      && lethalMask != null
      && lethalMask.some(Boolean)
      && arrangeTargets != null;

    if (hasLockedDice) {
      // Save lethal positions; re-roll only non-lethal dice
      locked = new Map<number, ArrangeTarget>();
      for (const [idx, target] of arrangeTargets!) {
        if (lethalMask![idx]) locked.set(idx, target);
      }
      const nonLethalIndices = Array.from({ length: count }, (_, i) => i)
        .filter(i => !(lethalMask![i] ?? false));
      result = rollSpecificDice(rollResult!, nonLethalIndices, seed);
      newLethalMask = [...lethalMask!];
    } else {
      result = rollDice(count, seed);
      newLethalMask = new Array(count).fill(false);
    }

    const newActiveMask  = new Array(count).fill(true);
    const newSustained   = new Array(count).fill(false);

    if (animEnabled) {
      const throwSeed  = generateSeed();
      const throwParams = computeThrowParams(count, throwSeed);
      set({
        rollResult: result,
        activeMask: newActiveMask,
        lethalMask: newLethalMask,
        sustainedMask: newSustained,
        throwParams,
        lockedTargets: locked,
        arrangeTargets: null,
        arrangeProgress: 0,
        phase: 'ROLLING',
        undoStack: [],
      });
    } else {
      // Skip physics — position dice instantly (no drop animation).
      const scale    = computeScale(count);
      const hasLethal = newLethalMask.some(Boolean);
      const targets  = computeArrangeTargets(result.values, newActiveMask, newLethalMask, scale, hasLethal);
      set({
        rollResult: result,
        activeMask: newActiveMask,
        lethalMask: newLethalMask,
        sustainedMask: newSustained,
        throwParams: null,
        lockedTargets: null,
        arrangeTargets: targets,
        arrangeProgress: 1,
        phase: 'ARRANGED',
        undoStack: [],
      });
    }

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
    const { rollResult, count, dieColor, currentTurn, currentPhase, animEnabled } = get();
    if (!rollResult || count === 0) return;

    const seed = generateSeed();
    const result = rollDice(count, seed);
    const newActiveMask = new Array(count).fill(true);
    const newLethalMask = new Array(count).fill(false);
    const newSustained  = new Array(count).fill(false);

    if (animEnabled) {
      const throwSeed   = generateSeed();
      const throwParams = computeThrowParams(count, throwSeed);
      set({
        rollResult: result,
        activeMask: newActiveMask,
        lethalMask: newLethalMask,
        sustainedMask: newSustained,
        throwParams,
        arrangeTargets: null,
        arrangeProgress: 0,
        phase: 'ROLLING',
        undoStack: [],
      });
    } else {
      // Skip physics — position dice instantly (no drop animation).
      const scale   = computeScale(count);
      const targets = computeArrangeTargets(result.values, newActiveMask, newLethalMask, scale, false);
      set({
        rollResult: result,
        activeMask: newActiveMask,
        lethalMask: newLethalMask,
        sustainedMask: newSustained,
        throwParams: null,
        arrangeTargets: targets,
        arrangeProgress: 1,
        phase: 'ARRANGED',
        undoStack: [],
      });
    }

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

  // ── Delete all dice with face value ≤ faceValue ─────────────────────

  deleteFace: (faceValue) => {
    const { rollResult, activeMask, lethalMask, count, dieColor, currentTurn, currentPhase } = get();
    if (!rollResult || !activeMask) return;

    // Push undo before mutating
    set(s => ({
      undoStack: [...s.undoStack.slice(-9), {
        rollResult: s.rollResult,
        activeMask: s.activeMask ? [...s.activeMask] : null,
        lethalMask: s.lethalMask ? [...s.lethalMask] : null,
        sustainedMask: s.sustainedMask ? [...s.sustainedMask] : null,
        count: s.count,
      }],
    }));

    // Collect deleted dice values for history
    const deletedValues: number[] = [];
    const newActiveMask = activeMask.map((active, i) => {
      if (active && rollResult.values[i] <= faceValue) {
        deletedValues.push(rollResult.values[i]);
        return false;
      }
      return active;
    });
    const newLethalMask = (lethalMask ?? new Array(rollResult.values.length).fill(false))
      .map((lethal: boolean, i: number) =>
        rollResult.values[i] <= faceValue ? false : lethal,
      );

    const scale = computeScale(count);
    const hasLethal = newLethalMask.some(Boolean);
    const targets = computeArrangeTargets(
      rollResult.values, newActiveMask, newLethalMask, scale, hasLethal,
    );

    // Go straight to ARRANGED — no drop animation for layout-only changes.
    // The Y-drop animation (arrangeProgress 0→1) is reserved for the
    // physics-to-ARRANGING transition only (onAllDiceSettled).
    set({
      activeMask: newActiveMask,
      lethalMask: newLethalMask,
      arrangeTargets: targets,
      arrangeProgress: 1,
      phase: 'ARRANGED',
    });

    if (deletedValues.length > 0) {
      set(s => ({
        history: [...s.history, {
          id: `del-${Date.now()}`,
          timestamp: Date.now(),
          turn: currentTurn,
          phase: currentPhase,
          diceCount: deletedValues.length,
          values: deletedValues,
          color: dieColor,
          seed: '',
          isReroll: false,
          actionLabel: `⊘ del ≤${faceValue}`,
        }],
      }));
    }
  },

  // ── Re-roll all non-lethal active dice with face value ≤ faceValue ──

  rerollFace: (faceValue) => {
    const { rollResult, activeMask, lethalMask, count, dieColor, currentTurn, currentPhase } = get();
    if (!rollResult || !activeMask) return;

    const indices: number[] = [];
    for (let i = 0; i < rollResult.values.length; i++) {
      if (!activeMask[i]) continue;
      if (lethalMask && lethalMask[i]) continue;
      if (rollResult.values[i] <= faceValue) indices.push(i);
    }
    if (indices.length === 0) return;

    // Push undo before mutating
    set(s => ({
      undoStack: [...s.undoStack.slice(-9), {
        rollResult: s.rollResult,
        activeMask: s.activeMask ? [...s.activeMask] : null,
        lethalMask: s.lethalMask ? [...s.lethalMask] : null,
        sustainedMask: s.sustainedMask ? [...s.sustainedMask] : null,
        count: s.count,
      }],
    }));

    const seed = generateSeed();
    const updated = rollSpecificDice(rollResult, indices, seed);

    const scale = computeScale(count);
    const hasLethal = (lethalMask ?? []).some(Boolean);
    const targets = computeArrangeTargets(
      updated.values, activeMask, lethalMask ?? new Array(updated.count).fill(false), scale, hasLethal,
    );

    // No drop animation for reroll — go straight to ARRANGED.
    set({
      rollResult: updated,
      arrangeTargets: targets,
      arrangeProgress: 1,
      phase: 'ARRANGED',
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
        actionLabel: `↺ roll ≤${faceValue}`,
      }],
    }));
  },

  // ── Toggle lethal for a face-value group ────────────────────────────

  toggleLethal: (faceValue) => {
    const { rollResult, activeMask, lethalMask, count, dieColor, currentTurn, currentPhase } = get();
    if (!rollResult || !activeMask) return;

    const activeOfValue = rollResult.values
      .map((v, i) => (v === faceValue && activeMask[i]) ? i : -1)
      .filter(i => i >= 0);
    if (activeOfValue.length === 0) return;

    const allLethal = activeOfValue.every(i => lethalMask?.[i] ?? false);
    const newLethal = !allLethal;

    // Push undo before mutating
    set(s => ({
      undoStack: [...s.undoStack.slice(-9), {
        rollResult: s.rollResult,
        activeMask: s.activeMask ? [...s.activeMask] : null,
        lethalMask: s.lethalMask ? [...s.lethalMask] : null,
        sustainedMask: s.sustainedMask ? [...s.sustainedMask] : null,
        count: s.count,
      }],
    }));

    const updatedLethalMask = (lethalMask ?? new Array(rollResult.values.length).fill(false))
      .map((lethal: boolean, i: number) => {
        if (!activeMask[i] || rollResult.values[i] !== faceValue) return lethal;
        return newLethal;
      });

    const scale = computeScale(count);
    const hasLethal = updatedLethalMask.some(Boolean);
    const targets = computeArrangeTargets(
      rollResult.values, activeMask, updatedLethalMask, scale, hasLethal,
    );

    // No drop animation for lethal toggle — go straight to ARRANGED.
    set({
      lethalMask: updatedLethalMask,
      arrangeTargets: targets,
      arrangeProgress: 1,
      phase: 'ARRANGED',
    });

    set(s => ({
      history: [...s.history, {
        id: `lethal-${Date.now()}`,
        timestamp: Date.now(),
        turn: currentTurn,
        phase: currentPhase,
        diceCount: activeOfValue.length,
        values: activeOfValue.map(i => rollResult.values[i]),
        color: dieColor,
        seed: '',
        isReroll: false,
        actionLabel: newLethal ? `☠ lethal ×${activeOfValue.length} (${faceValue})` : `☠ lethal off (${faceValue})`,
      }],
    }));
  },

  // ── Sustained Hits: add N × sustainedX new dice, no physics re-throw ─

  sustainedHits: (faceValue) => {
    const { rollResult, activeMask, lethalMask, sustainedMask, sustainedX, count, dieColor, currentTurn, currentPhase } = get();
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

    // Push undo before mutating
    set(s => ({
      undoStack: [...s.undoStack.slice(-9), {
        rollResult: s.rollResult,
        activeMask: s.activeMask ? [...s.activeMask] : null,
        lethalMask: s.lethalMask ? [...s.lethalMask] : null,
        sustainedMask: s.sustainedMask ? [...s.sustainedMask] : null,
        count: s.count,
      }],
    }));

    const seed = generateSeed();
    const updated = addDice(rollResult, extra, seed);
    const newCount = updated.count;
    const newActiveMask = [...(activeMask ?? []), ...new Array(extra).fill(true)];
    const newLethalMask = [...(lethalMask ?? []), ...new Array(extra).fill(false)];
    // Mark the newly added dice as sustained
    const newSustainedMask = [...(sustainedMask ?? new Array(count).fill(false)), ...new Array(extra).fill(true)];

    const scale = computeScale(newCount);
    const hasLethal = newLethalMask.some(Boolean);
    const targets = computeArrangeTargets(
      updated.values, newActiveMask, newLethalMask, scale, hasLethal,
    );

    // No drop animation for sustained hits — go straight to ARRANGED.
    set({
      rollResult: updated,
      count: newCount,
      activeMask: newActiveMask,
      lethalMask: newLethalMask,
      sustainedMask: newSustainedMask,
      arrangeTargets: targets,
      arrangeProgress: 1,
      phase: 'ARRANGED',
    });

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
        actionLabel: `✦ sus ×${sustainedX} en ${faceValue} (+${extra})`,
      }],
    }));
  },

  // ── Undo last action ────────────────────────────────────────────────

  undo: () => {
    const { undoStack, dieColor, currentTurn, currentPhase } = get();
    if (undoStack.length === 0) return;

    const last = undoStack[undoStack.length - 1];
    const newStack = undoStack.slice(0, -1);

    let targets: Map<number, ArrangeTarget> | null = null;
    if (last.rollResult && last.activeMask && last.lethalMask) {
      const scale = computeScale(last.count);
      const hasLethal = last.lethalMask.some(Boolean);
      targets = computeArrangeTargets(
        last.rollResult.values, last.activeMask, last.lethalMask, scale, hasLethal,
      );
    }

    // No drop animation for undo — go straight to ARRANGED (or PREVIEW).
    set({
      rollResult: last.rollResult,
      activeMask: last.activeMask,
      lethalMask: last.lethalMask,
      sustainedMask: last.sustainedMask,
      count: last.count,
      undoStack: newStack,
      arrangeTargets: targets,
      arrangeProgress: targets ? 1 : 0,
      phase: targets ? 'ARRANGED' : 'PREVIEW',
    });

    set(s => ({
      history: [...s.history, {
        id: `undo-${Date.now()}`,
        timestamp: Date.now(),
        turn: currentTurn,
        phase: currentPhase,
        diceCount: 0,
        values: [],
        color: dieColor,
        seed: '',
        isReroll: false,
        actionLabel: '↩ regresar',
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
      sustainedMask: null,
      throwParams: null,
      arrangeTargets: null,
      arrangeProgress: 0,
      lockedTargets: null,
      undoStack: [],
    });
  },

  // ── Simple setters ──────────────────────────────────────────────────

  setDieColor: (c) => set({ dieColor: c }),
  setTurn: (t) => set({ currentTurn: t }),
  setWarhPhase: (p) => set({ currentPhase: p }),
  setSustainedX: (x) => set({ sustainedX: x }),
  setAnimEnabled: (v) => set({ animEnabled: v }),

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
      lockedTargets: null,
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
