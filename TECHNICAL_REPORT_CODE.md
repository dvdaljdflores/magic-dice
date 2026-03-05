# Magic Dice — Código Fuente Completo

> Complemento de TECHNICAL_REPORT.md
> Contiene el código completo sin resumir de los archivos críticos.
> Última actualización: 2026-03-05

---

## 1. package.json

```json
{
  "name": "magic-dice",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "@dimforge/rapier3d-compat": "^0.19.3",
    "@react-three/drei": "^10.7.7",
    "@react-three/fiber": "^9.5.0",
    "@react-three/rapier": "^2.2.0",
    "@types/three": "^0.183.1",
    "next": "16.1.6",
    "react": "19.2.3",
    "react-dom": "19.2.3",
    "three": "^0.183.2",
    "zustand": "^5.0.11"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "typescript": "^5"
  }
}
```

---

## 2. src/store/diceStore.ts

```typescript
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
```

---

## 3. src/components/DiceScene.tsx

```typescript
/**
 * LAYER 1 — DiceScene: Root 3D scene with physics support
 *
 * Three rendering modes:
 *   1. PREVIEW — Static grid, no physics
 *   2. ROLLING + SETTLING — Rapier3D physics active
 *   3. ARRANGING + ARRANGED — Lerp to sorted positions, no physics
 */

'use client';

import { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Physics, RigidBody, CuboidCollider } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import type { DiceRollResult, GamePhase, DieColor } from '../core/types';
import { createDiceGeometry } from '../rendering/DiceGeometry';
import { createDiceMaterial, DIE_COLOR_MAP } from '../rendering/DiceMaterial';
import { PREVIEW_QUATERNION, faceUpQuaternion } from '../core/DiceEngine';
import { useDiceStore } from '../store/diceStore';
import { isBodySettled } from '../physics/settleDetection';
import { PHYSICS_CONFIG } from '../physics/constants';

const MAX_DICE = 120;
const BOARD_W  = PHYSICS_CONFIG.boardWidth;
const BOARD_D  = PHYSICS_CONFIG.boardDepth;

const LETHAL_ZONE_Z = 6.0;

const _p    = new THREE.Vector3();
const _q    = new THREE.Quaternion();
const _sc   = new THREE.Vector3(1, 1, 1);
const _mat  = new THREE.Matrix4();
const _zero = new THREE.Matrix4().makeScale(0, 0, 0);

function computeScale(n: number): number {
  return Math.max(0.4, Math.min(0.85, 5.5 / Math.sqrt(Math.max(1, n))));
}

// ─── Props ────────────────────────────────────────────────────────────

interface DiceSceneProps {
  count: number;
  gamePhase: GamePhase;
  rollResult: DiceRollResult | null;
  dieColor: DieColor;
  activeMask: boolean[] | null;
  lethalMask: boolean[] | null;
}

// ─── Main Component ───────────────────────────────────────────────────

export function DiceScene({
  count, gamePhase, rollResult, dieColor, activeMask, lethalMask,
}: DiceSceneProps) {
  const geo = useMemo(() => createDiceGeometry(), []);
  const mat = useMemo(() => createDiceMaterial(), []);
  const lethalMat = useMemo(() => {
    const m = createDiceMaterial();
    m.color.setRGB(0.92, 0.68, 0.02); // vivid gold
    return m;
  }, []);
  const sustainedMat = useMemo(() => {
    const m = createDiceMaterial();
    m.color.setRGB(0.0, 0.88, 0.95); // bright teal — distinct from all die colors
    return m;
  }, []);

  const hasAnyLethal = useMemo(
    () => !!lethalMask?.some(Boolean),
    [lethalMask],
  );

  const isPhysicsPhase = gamePhase === 'ROLLING' || gamePhase === 'SETTLING';

  return (
    <>
      <Lighting />
      <Board hasAnyLethal={hasAnyLethal} />

      {/* PREVIEW: static grid */}
      {gamePhase === 'PREVIEW' && (
        <PreviewGrid count={count} geo={geo} mat={mat} dieColor={dieColor} />
      )}

      {/* ROLLING + SETTLING: physics simulation */}
      {isPhysicsPhase && (
        <Physics gravity={[...PHYSICS_CONFIG.gravity]}>
          <PhysicsDice
            count={count}
            geo={geo}
            mat={mat}
            dieColor={dieColor}
          />
          <PhysicsFloor />
          <PhysicsWalls />
        </Physics>
      )}

      {/* ARRANGING + ARRANGED: lerp to sorted positions */}
      {(gamePhase === 'ARRANGING' || gamePhase === 'ARRANGED') && (
        <>
          <ArrangedDice
            rollResult={rollResult}
            lethalMask={lethalMask}
            dieColor={dieColor}
            geo={geo}
            mat={mat}
            lethalMat={lethalMat}
            sustainedMat={sustainedMat}
          />
          <RowLabels
            rollResult={rollResult}
            activeMask={activeMask}
            lethalMask={lethalMask}
          />
        </>
      )}
    </>
  );
}

// ─── Lighting ─────────────────────────────────────────────────────────

function Lighting() {
  return (
    <>
      <ambientLight intensity={0.55} color="#f8f0e0" />
      <directionalLight
        position={[5, 14, 6]}
        intensity={2.6}
        color="#fff8f0"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={0.5}
        shadow-camera-far={50}
        shadow-camera-left={-13}
        shadow-camera-right={13}
        shadow-camera-top={11}
        shadow-camera-bottom={-11}
      />
      <pointLight position={[-7, 6, -4]} intensity={0.5} color="#ffd090" distance={28} />
      <pointLight position={[ 7, 5,  4]} intensity={0.4} color="#ffffff" distance={24} />
    </>
  );
}

// ─── Board + Frame ────────────────────────────────────────────────────

function Board({ hasAnyLethal }: { hasAnyLethal: boolean }) {
  return (
    <>
      <mesh position={[0, -0.06, 0]} receiveShadow>
        <boxGeometry args={[BOARD_W, 0.12, BOARD_D]} />
        <meshStandardMaterial color="#c9a87c" roughness={0.82} metalness={0.04} />
      </mesh>

      {([
        [-(BOARD_W / 2 + 0.35), 0.06, 0,               0.7, 0.18, BOARD_D + 0.7],
        [ (BOARD_W / 2 + 0.35), 0.06, 0,               0.7, 0.18, BOARD_D + 0.7],
        [0, 0.06, -(BOARD_D / 2 + 0.35), BOARD_W + 0.7, 0.18, 0.7],
        [0, 0.06,  (BOARD_D / 2 + 0.35), BOARD_W + 0.7, 0.18, 0.7],
      ] as [number, number, number, number, number, number][]).map((d, i) => (
        <mesh key={i} position={[d[0], d[1], d[2]]}>
          <boxGeometry args={[d[3], d[4], d[5]]} />
          <meshStandardMaterial color="#7a5230" roughness={0.7} metalness={0.08} />
        </mesh>
      ))}

      {hasAnyLethal && (
        <mesh position={[0, 0.002, LETHAL_ZONE_Z]}>
          <boxGeometry args={[BOARD_W - 1.4, 0.012, 3.6]} />
          <meshStandardMaterial color="#3a0010" roughness={0.9} transparent opacity={0.75} />
        </mesh>
      )}
    </>
  );
}

// ─── PREVIEW Grid ─────────────────────────────────────────────────────

function PreviewGrid({ count, geo, mat, dieColor }: {
  count: number;
  geo: THREE.BoxGeometry;
  mat: THREE.MeshStandardMaterial;
  dieColor: DieColor;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    for (let i = 0; i < MAX_DICE; i++) mesh.setMatrixAt(i, _zero);

    if (count > 0) {
      const s = computeScale(count);
      _sc.set(s, s, s);
      const cols    = Math.ceil(Math.sqrt(count * 1.3));
      const spacing = s * 1.4;
      const ox      = -((cols - 1) * spacing) / 2;
      const rowsN   = Math.ceil(count / cols);
      const oz      = -((rowsN - 1) * spacing) / 2;

      for (let i = 0; i < count; i++) {
        const c = i % cols;
        const r = Math.floor(i / cols);
        _p.set(ox + c * spacing, s / 2 + 0.01, oz + r * spacing);
        _q.copy(PREVIEW_QUATERNION);
        _mat.compose(_p, _q, _sc);
        mesh.setMatrixAt(i, _mat);
      }
      mat.color.copy(DIE_COLOR_MAP[dieColor]);
    }

    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = MAX_DICE;
  }, [count, dieColor, geo, mat]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geo, mat, MAX_DICE]}
      castShadow
      receiveShadow
      frustumCulled={false}
    />
  );
}

// ─── Physics Dice (ROLLING + SETTLING) ────────────────────────────────

function PhysicsDice({ count, geo, mat, dieColor }: {
  count: number;
  geo: THREE.BoxGeometry;
  mat: THREE.MeshStandardMaterial;
  dieColor: DieColor;
}) {
  const rigidBodies   = useRef<(RapierRigidBody | null)[]>([]);
  const throwApplied  = useRef(false);
  const settleFrames  = useRef(0);
  const settleElapsed = useRef(0);
  /**
   * Per-die flag: once true, the rotation has been snapped to the correct face
   * (faceUpQuaternion) during SETTLING. Prevents repeated snap calls and
   * ensures the body's angular velocity can reach the settle threshold.
   */
  const rotSnapped    = useRef<boolean[]>([]);

  const throwParams   = useDiceStore(s => s.throwParams);
  const lockedTargets = useDiceStore(s => s.lockedTargets);

  useEffect(() => {
    throwApplied.current  = false;
    settleFrames.current  = 0;
    settleElapsed.current = 0;
    mat.color.copy(DIE_COLOR_MAP[dieColor]);
  }, [dieColor, mat]);

  useFrame((_, dt) => {
    const store  = useDiceStore.getState();
    const locked = store.lockedTargets;

    // ── Apply impulses once on ROLLING ─────────────────────────────────
    // Wait until all RigidBody refs are registered before applying forces.
    if (store.phase === 'ROLLING' && !throwApplied.current && store.throwParams) {
      const allReady = rigidBodies.current.slice(0, count).every(b => b !== null);
      if (!allReady) return;

      // Reset per-throw rotation-snap flags
      rotSnapped.current = new Array(count).fill(false);

      // FIX 1 — Set correct initial orientation for every die.
      // Dynamic dice start with faceUpQuaternion(value) so the correct face is
      // already visible the moment the die appears in the air.
      // Locked dice keep their stored target orientation.
      const rollResult = store.rollResult;
      if (rollResult) {
        for (let i = 0; i < count; i++) {
          const body = rigidBodies.current[i];
          if (!body) continue;
          if (locked?.has(i)) {
            const lt = locked.get(i)!;
            body.setRotation(
              { x: lt.quaternion[0], y: lt.quaternion[1], z: lt.quaternion[2], w: lt.quaternion[3] },
              true,
            );
          } else {
            // Face-up orientation (no yaw) — matches computeArrangeTargets exactly,
            // so there is no visible rotation change when ARRANGING starts.
            const fq = faceUpQuaternion(rollResult.values[i]);
            body.setRotation({ x: fq.x, y: fq.y, z: fq.z, w: fq.w }, true);
          }
        }
      }

      for (let i = 0; i < Math.min(count, store.throwParams.length); i++) {
        const body = rigidBodies.current[i];
        if (!body) continue;
        if (locked?.has(i)) continue;  // locked dice stay in place — no impulse
        const tp = store.throwParams[i];
        body.setTranslation(tp.startPosition, true);
        body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        body.setAngvel({ x: 0, y: 0, z: 0 }, true);
        body.applyImpulse(tp.impulse, true);
        body.applyTorqueImpulse(tp.torque, true);
        body.wakeUp();
      }
      throwApplied.current  = true;
      settleElapsed.current = 0;
      useDiceStore.setState({ phase: 'SETTLING' });
      return;
    }

    // ── Settle detection during SETTLING ───────────────────────────────
    if (store.phase === 'SETTLING') {
      settleElapsed.current += dt;

      if (settleElapsed.current >= PHYSICS_CONFIG.settleTimeoutSeconds) {
        store.onAllDiceSettled();
        return;
      }

      const s = computeScale(count);

      // FIX 2 — Pre-settle rotation snap.
      // When a die is slowing down near the table surface, snap its rotation to
      // the exact faceUpQuaternion and zero angular velocity. This guarantees the
      // correct face is showing BEFORE the settle threshold is reached, so there
      // is no visible orientation correction when the scene transitions to ARRANGING.
      // Zeroing angvel here is safe: the die is already nearly still, and the low
      // angular damping (0.88) means it would stop within the same timeframe anyway.
      const rollResult = store.rollResult;
      if (rollResult) {
        for (let i = 0; i < count; i++) {
          if (locked?.has(i) || rotSnapped.current[i]) continue;
          const body = rigidBodies.current[i];
          if (!body) continue;
          const lv     = body.linvel();
          const av     = body.angvel();
          const linSpd = Math.sqrt(lv.x ** 2 + lv.y ** 2 + lv.z ** 2);
          const angSpd = Math.sqrt(av.x ** 2 + av.y ** 2 + av.z ** 2);
          // Snap only when die is on the table surface and slowing down.
          // angSpd < 1.5 ensures we don't interrupt an active tumble visually.
          if (linSpd < 0.5 && angSpd < 1.5 && body.translation().y < s * 1.5) {
            const fq = faceUpQuaternion(rollResult.values[i]);
            body.setRotation({ x: fq.x, y: fq.y, z: fq.z, w: fq.w }, true);
            body.setAngvel({ x: 0, y: 0, z: 0 }, true);
            rotSnapped.current[i] = true;
          }
        }
      }

      let allSettled = true;
      for (let i = 0; i < count; i++) {
        if (locked?.has(i)) continue;  // locked dice are always considered settled
        const body = rigidBodies.current[i];
        if (!body) continue;
        if (!isBodySettled(body.linvel(), body.angvel())) {
          allSettled = false;
          break;
        }
      }

      if (allSettled) {
        settleFrames.current++;
        if (settleFrames.current >= PHYSICS_CONFIG.settleFrameCount) {
          store.onAllDiceSettled();
        }
      } else {
        settleFrames.current = 0;
      }
    }
  });

  const s = computeScale(count);

  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const isLocked     = lockedTargets?.has(i) ?? false;
        const lockedTarget = isLocked ? lockedTargets!.get(i)! : undefined;
        const sp           = throwParams?.[i]?.startPosition;

        const initPos: [number, number, number] = isLocked && lockedTarget
          ? [lockedTarget.position[0], lockedTarget.position[1], lockedTarget.position[2]]
          : sp
            ? [sp.x, sp.y, sp.z]
            : [((i % 10) - 4.5) * 1.6, 8 + Math.floor(i / 10) * 1.5, -6];

        return (
          <RigidBody
            key={i}
            ref={(el: RapierRigidBody | null) => { rigidBodies.current[i] = el; }}
            position={initPos}
            type={isLocked ? 'fixed' : 'dynamic'}
            restitution={PHYSICS_CONFIG.restitution}
            friction={PHYSICS_CONFIG.friction}
            linearDamping={PHYSICS_CONFIG.linearDamping}
            angularDamping={PHYSICS_CONFIG.angularDamping}
            colliders="cuboid"
            canSleep={isLocked}
            ccd={!isLocked}
          >
            <mesh geometry={geo} material={mat} scale={[s, s, s]} castShadow receiveShadow />
          </RigidBody>
        );
      })}
    </>
  );
}

// ─── Physics Floor + Walls ────────────────────────────────────────────

function PhysicsFloor() {
  return (
    <RigidBody type="fixed" position={[0, -0.06, 0]}>
      <CuboidCollider args={[BOARD_W / 2, 0.06, BOARD_D / 2]} />
    </RigidBody>
  );
}

function PhysicsWalls() {
  const h = PHYSICS_CONFIG.wallHeight;
  return (
    <>
      <RigidBody type="fixed" position={[-(BOARD_W / 2 + 0.35), h / 2, 0]}>
        <CuboidCollider args={[0.35, h / 2, BOARD_D / 2 + 0.7]} />
      </RigidBody>
      <RigidBody type="fixed" position={[ (BOARD_W / 2 + 0.35), h / 2, 0]}>
        <CuboidCollider args={[0.35, h / 2, BOARD_D / 2 + 0.7]} />
      </RigidBody>
      <RigidBody type="fixed" position={[0, h / 2, -(BOARD_D / 2 + 0.35)]}>
        <CuboidCollider args={[BOARD_W / 2 + 0.7, h / 2, 0.35]} />
      </RigidBody>
      <RigidBody type="fixed" position={[0, h / 2,  (BOARD_D / 2 + 0.35)]}>
        <CuboidCollider args={[BOARD_W / 2 + 0.7, h / 2, 0.35]} />
      </RigidBody>
    </>
  );
}

// ─── Arranged Dice (ARRANGING + ARRANGED) ─────────────────────────────

function ArrangedDice({ rollResult, lethalMask, dieColor, geo, mat, lethalMat, sustainedMat }: {
  rollResult: DiceRollResult | null;
  lethalMask: boolean[] | null;
  dieColor: DieColor;
  geo: THREE.BoxGeometry;
  mat: THREE.MeshStandardMaterial;
  lethalMat: THREE.MeshStandardMaterial;
  sustainedMat: THREE.MeshStandardMaterial;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const lethalMeshRef = useRef<THREE.InstancedMesh>(null);
  const sustainedMeshRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    mat.color.copy(DIE_COLOR_MAP[dieColor]);
  }, [dieColor, mat]);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    const lethalMesh = lethalMeshRef.current;
    const sustainedMesh = sustainedMeshRef.current;
    if (!mesh || !lethalMesh || !sustainedMesh || !rollResult) return;

    const store = useDiceStore.getState();

    if (store.phase === 'ARRANGING') {
      store.tickArrangeAnimation(delta);
    }

    const { arrangeTargets, arrangeProgress, sustainedMask } = useDiceStore.getState();
    if (!arrangeTargets) return;

    const n = rollResult.count;
    const s = computeScale(n);
    _sc.set(s, s, s);

    for (let i = 0; i < MAX_DICE; i++) {
      mesh.setMatrixAt(i, _zero);
      lethalMesh.setMatrixAt(i, _zero);
      sustainedMesh.setMatrixAt(i, _zero);
    }

    const t = easeOutCubic(arrangeProgress);

    for (const [dieIdx, target] of arrangeTargets) {
      const isLethal    = lethalMask?.[dieIdx] ?? false;
      const isSustained = sustainedMask?.[dieIdx] ?? false;
      const targetMesh  = isLethal ? lethalMesh : isSustained ? sustainedMesh : mesh;

      _p.set(target.position[0], target.position[1], target.position[2]);

      if (t < 1) {
        const startY = target.position[1] + 2 * (1 - t);
        _p.y = target.position[1] * t + startY * (1 - t);
      }

      _q.set(target.quaternion[0], target.quaternion[1], target.quaternion[2], target.quaternion[3]);
      _mat.compose(_p, _q, _sc);
      targetMesh.setMatrixAt(dieIdx, _mat);
    }

    mesh.instanceMatrix.needsUpdate = true;
    lethalMesh.instanceMatrix.needsUpdate = true;
    sustainedMesh.instanceMatrix.needsUpdate = true;
    mesh.count = MAX_DICE;
    lethalMesh.count = MAX_DICE;
    sustainedMesh.count = MAX_DICE;
  });

  return (
    <>
      <instancedMesh
        ref={meshRef}
        args={[geo, mat, MAX_DICE]}
        castShadow
        receiveShadow
        frustumCulled={false}
      />
      <instancedMesh
        ref={lethalMeshRef}
        args={[geo, lethalMat, MAX_DICE]}
        castShadow
        receiveShadow
        frustumCulled={false}
      />
      <instancedMesh
        ref={sustainedMeshRef}
        args={[geo, sustainedMat, MAX_DICE]}
        castShadow
        receiveShadow
        frustumCulled={false}
      />
    </>
  );
}

// ─── Row Labels (ARRANGING + ARRANGED) ────────────────────────────────

const LABEL_X = -(BOARD_W / 2) + 0.9;

function RowLabels({ rollResult, activeMask, lethalMask }: {
  rollResult: DiceRollResult | null;
  activeMask: boolean[] | null;
  lethalMask: boolean[] | null;
}) {
  const arrangeTargets = useDiceStore(s => s.arrangeTargets);
  if (!arrangeTargets || !rollResult) return null;

  const normalRowZ = new Map<number, number>();
  const normalRowCount = new Map<number, number>();
  let lethalCount = 0;

  for (const [dieIdx, target] of arrangeTargets) {
    if (activeMask && !activeMask[dieIdx]) continue;
    const v = rollResult.values[dieIdx];
    const isLethal = lethalMask?.[dieIdx] ?? false;
    if (isLethal) {
      lethalCount++;
    } else {
      if (!normalRowZ.has(v)) normalRowZ.set(v, target.position[2]);
      normalRowCount.set(v, (normalRowCount.get(v) ?? 0) + 1);
    }
  }

  return (
    <>
      {[1, 2, 3, 4, 5, 6].map(v => {
        const z   = normalRowZ.get(v);
        const cnt = normalRowCount.get(v);
        if (z === undefined || !cnt) return null;
        return (
          <Text
            key={v}
            position={[LABEL_X, 0.12, z]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.42}
            color="#0a0a08"
            anchorX="center"
            anchorY="middle"
          >
            {`${v} x${cnt}`}
          </Text>
        );
      })}
      {lethalCount > 0 && (
        <Text
          position={[0, 0.12, LETHAL_ZONE_Z]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.42}
          color="#0a0a08"
          anchorX="center"
          anchorY="middle"
        >
          {`☠ x${lethalCount}`}
        </Text>
      )}
    </>
  );
}

// ─── Easing ───────────────────────────────────────────────────────────

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
```

---

## 4. src/components/WarhammerBoard.tsx

```typescript
/**
 * LAYER 1/2/3 — WarhammerBoard: Root Orchestrator
 *
 * Layout (desktop):
 *   - Top bar (UIControls): absolute, full width, ~72px
 *   - Left panel (ResultsPanel): absolute, 240px wide, below top bar
 *   - Canvas (DiceScene): absolute, fills remaining area
 *
 * Layout (mobile < 768px):
 *   - Top bar (UIControls): compact single row, 60px
 *   - Canvas: fills viewport below top bar (no rotation)
 *   - ResultsPanel: floating action strip over canvas + collapsible sheet
 *
 * All state is managed via Zustand (useDiceStore).
 */

'use client';

import { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useDiceStore } from '../store/diceStore';
import { DiceScene } from './DiceScene';
import { UIControls } from './UIControls';
import { ResultsPanel } from './ResultsPanel';

const TOP_BAR_H    = 72;
const LEFT_W       = 240;
const MOBILE_BAR_H = 60;

export default function WarhammerBoard() {
  const count        = useDiceStore(s => s.count);
  const phase        = useDiceStore(s => s.phase);
  const rollResult   = useDiceStore(s => s.rollResult);
  const dieColor     = useDiceStore(s => s.dieColor);
  const activeMask   = useDiceStore(s => s.activeMask);
  const lethalMask   = useDiceStore(s => s.lethalMask);
  const history      = useDiceStore(s => s.history);
  const currentTurn  = useDiceStore(s => s.currentTurn);
  const currentPhase = useDiceStore(s => s.currentPhase);
  const sustainedX   = useDiceStore(s => s.sustainedX);
  const undoStack    = useDiceStore(s => s.undoStack);

  const addCount      = useDiceStore(s => s.addCount);
  const throwDice     = useDiceStore(s => s.throwDice);
  const repeatThrow   = useDiceStore(s => s.repeatThrow);
  const deleteFace    = useDiceStore(s => s.deleteFace);
  const rerollFace    = useDiceStore(s => s.rerollFace);
  const toggleLethal  = useDiceStore(s => s.toggleLethal);
  const sustainedHits = useDiceStore(s => s.sustainedHits);
  const reset         = useDiceStore(s => s.reset);
  const setDieColor   = useDiceStore(s => s.setDieColor);
  const setTurn       = useDiceStore(s => s.setTurn);
  const setWarhPhase  = useDiceStore(s => s.setWarhPhase);
  const setSustainedX   = useDiceStore(s => s.setSustainedX);
  const undo            = useDiceStore(s => s.undo);
  const animEnabled     = useDiceStore(s => s.animEnabled);
  const setAnimEnabled  = useDiceStore(s => s.setAnimEnabled);

  const [isMobile,   setIsMobile]   = useState(false);
  const [cameraLocked, setCameraLocked] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const canUndo = undoStack.length > 0
    && phase !== 'ROLLING'
    && phase !== 'SETTLING'
    && phase !== 'ARRANGING';

  const canvasStyle = isMobile
    ? { position: 'absolute' as const, top: MOBILE_BAR_H, left: 0, right: 0, bottom: 0 }
    : { position: 'absolute' as const, top: TOP_BAR_H, left: LEFT_W, right: 0, bottom: 0 };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#08080f' }}>

      <Canvas
        shadows
        camera={{ position: [0, 18, 15], fov: 40, near: 0.5, far: 85 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        dpr={[1, 2]}
        style={canvasStyle}
      >
        <fog attach="fog" args={['#08080f', 22, 60]} />

        <DiceScene
          count={count}
          gamePhase={phase}
          rollResult={rollResult}
          dieColor={dieColor}
          activeMask={activeMask}
          lethalMask={lethalMask}
        />

        <OrbitControls
          enabled={!cameraLocked}
          enablePan={false}
          minPolarAngle={0.25}
          maxPolarAngle={Math.PI / 2.1}
          minDistance={8}
          maxDistance={38}
          target={[0, 0, 0]}
        />
      </Canvas>

      <UIControls
        count={count}
        onAddCount={addCount}
        dieColor={dieColor}
        onColorChange={setDieColor}
        currentTurn={currentTurn}
        onTurnChange={setTurn}
        currentPhase={currentPhase}
        onPhaseChange={setWarhPhase}
        gamePhase={phase}
        onThrow={throwDice}
        onRepeat={repeatThrow}
        onReset={reset}
        animEnabled={animEnabled}
        onAnimEnabledChange={setAnimEnabled}
        isMobile={isMobile}
        cameraLocked={cameraLocked}
        onCameraLockChange={(v) => setCameraLocked(v)}
        history={history}
      />

      <ResultsPanel
        rollResult={rollResult}
        activeMask={activeMask}
        lethalMask={lethalMask}
        dieColor={dieColor}
        history={history}
        gamePhase={phase}
        sustainedX={sustainedX}
        onSustainedXChange={setSustainedX}
        onDelete={deleteFace}
        onReroll={rerollFace}
        onSustainedHits={sustainedHits}
        onToggleLethal={toggleLethal}
        onUndo={undo}
        canUndo={canUndo}
        isMobile={isMobile}
        mobileBarH={MOBILE_BAR_H}
      />
    </div>
  );
}
```

---

## 5. src/core/DiceEngine.ts

```typescript
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
```

---

## 6. src/core/ArrangeLayout.ts

```typescript
/**
 * LAYER 1 — Arrange Layout Calculator
 *
 * Pure function that computes target positions and quaternions for the
 * ARRANGED display. Dice are left-aligned per face-value row, stacking
 * in Y when more than MAX_PER_STACK share the same value.
 */

import type { ArrangeTarget } from './types';
import { faceUpQuaternion } from './DiceEngine';

const ROW_SP        = 2.0;
const COL_SP        = 1.35;
const BOARD_W       = 22;
const BOARD_D       = 16;
const LETHAL_ZONE_Z = 6.0;
const NORMAL_Z_MIN  = -7.0;
const NORMAL_Z_MAX  =  1.5;
const MAX_PER_STACK = 10;  // dice per horizontal slot before stacking in Y
const LABEL_SPACE   = 2.0; // x units reserved on the left for row labels

/**
 * Compute arranged positions and quaternions for each active die.
 * Dice in each row are left-aligned; when a row exceeds MAX_PER_STACK
 * the extra dice stack on top (Y axis) instead of wrapping to a new row.
 */
export function computeArrangeTargets(
  values: number[],
  activeMask: boolean[],
  lethalMask: boolean[],
  scale: number,
  hasLethal: boolean,
): Map<number, ArrangeTarget> {
  const targets = new Map<number, ArrangeTarget>();
  if (values.length === 0) return targets;

  const colSp  = scale * COL_SP;
  const rowSp  = scale * ROW_SP;
  const stackH = scale * 0.85;                      // height per stack level
  const leftX  = -(BOARD_W / 2) + LABEL_SPACE + scale / 2; // first die x

  // Group active dice by face value, split normal vs lethal
  const normalGroups: Record<number, number[]> = {};
  const lethalGroups: Record<number, number[]> = {};

  for (let i = 0; i < values.length; i++) {
    if (!activeMask[i]) continue;
    const v = values[i];
    const group = (lethalMask[i] ?? false) ? lethalGroups : normalGroups;
    if (!group[v]) group[v] = [];
    group[v].push(i);
  }

  // ── Normal dice — one z-row per face value, Y-stacking within ────────
  const normalVals = [1, 2, 3, 4, 5, 6].filter(v => (normalGroups[v]?.length ?? 0) > 0);
  if (normalVals.length > 0) {
    const totalRows = normalVals.length;
    const zMin  = hasLethal ? NORMAL_Z_MIN : -(BOARD_D / 2 - scale);
    const zMax  = hasLethal ? NORMAL_Z_MAX :  (BOARD_D / 2 - scale);
    const avail = zMax - zMin;
    const span  = (totalRows - 1) * rowSp;
    let   z     = zMin + Math.max(0, (avail - span) / 2);

    for (const v of normalVals) {
      const row = normalGroups[v];
      const q   = faceUpQuaternion(v);

      for (let k = 0; k < row.length; k++) {
        const col      = k % MAX_PER_STACK;
        const stackIdx = Math.floor(k / MAX_PER_STACK);
        targets.set(row[k], {
          position: [leftX + col * colSp, scale / 2 + 0.01 + stackIdx * stackH, z],
          quaternion: [q.x, q.y, q.z, q.w],
        });
      }

      z += rowSp;
    }
  }

  // ── Lethal dice — at LETHAL_ZONE_Z, centered + Y-stacking ───────────
  const lethalAll: { dieIdx: number; v: number }[] = [];
  for (const v of [1, 2, 3, 4, 5, 6]) {
    for (const dieIdx of lethalGroups[v] ?? []) {
      lethalAll.push({ dieIdx, v });
    }
  }

  if (lethalAll.length > 0) {
    // Center the group: first-column center at -(cols-1)*colSp/2
    const lethalCols   = Math.min(lethalAll.length, MAX_PER_STACK);
    const lethalStartX = -(lethalCols - 1) * colSp / 2;

    for (let k = 0; k < lethalAll.length; k++) {
      const col      = k % MAX_PER_STACK;
      const stackIdx = Math.floor(k / MAX_PER_STACK);
      const { dieIdx, v } = lethalAll[k];
      const q = faceUpQuaternion(v);
      targets.set(dieIdx, {
        position: [lethalStartX + col * colSp, scale / 2 + 0.01 + stackIdx * stackH, LETHAL_ZONE_Z],
        quaternion: [q.x, q.y, q.z, q.w],
      });
    }
  }

  return targets;
}

/**
 * Scale formula: smaller dice for large counts so they fit on the board.
 * clamp(0.4, 0.85, 5.5/sqrt(n))
 */
export function computeScale(n: number): number {
  return Math.max(0.4, Math.min(0.85, 5.5 / Math.sqrt(Math.max(1, n))));
}
```
