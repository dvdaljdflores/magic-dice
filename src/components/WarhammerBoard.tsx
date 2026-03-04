/**
 * LAYER 1/2/3 — WarhammerBoard: Root Orchestrator
 *
 * Layout:
 *   - Top bar (UIControls): absolute, full width, ~72px
 *   - Left panel (ResultsPanel): absolute, 240px wide, below top bar
 *   - Canvas (DiceScene): absolute, fills remaining area
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type {
  GameState, DiceRollResult, DieColor, WarhPhase, RollHistoryEntry, SustainedX,
} from '../core/types';
import { rollDice, rollSpecificDice, generateSeed, addDice } from '../core/DiceEngine';
import { DiceScene } from './DiceScene';
import { UIControls } from './UIControls';
import { ResultsPanel } from './ResultsPanel';

const TOP_BAR_H = 72;
const LEFT_W    = 240;

export default function WarhammerBoard() {
  const [count,        setCount]        = useState(0);
  const [gameState,    setGameState]    = useState<GameState>('PREVIEW');
  const [rollResult,   setRollResult]   = useState<DiceRollResult | null>(null);
  const [dieColor,     setDieColor]     = useState<DieColor>('white');
  const [activeMask,   setActiveMask]   = useState<boolean[] | null>(null);
  const [lethalMask,   setLethalMask]   = useState<boolean[] | null>(null);
  const [history,      setHistory]      = useState<RollHistoryEntry[]>([]);
  const [currentTurn,  setCurrentTurn]  = useState(1);
  const [currentPhase, setCurrentPhase] = useState<WarhPhase | null>(null);
  const [sustainedX,   setSustainedX]   = useState<SustainedX>(1);

  const lastTurnRef = useRef(1);

  // ── Add dice (additive) ─────────────────────────────────────────────────
  const handleAddCount = useCallback((n: number) => {
    setCount(prev => Math.min(120, prev + n));
    setGameState('PREVIEW');
  }, []);

  // ── Throw ───────────────────────────────────────────────────────────────
  const handleThrow = useCallback(() => {
    if (count === 0) return;
    const turn  = currentTurn;
    const phase = currentPhase;
    lastTurnRef.current = turn;

    const seed   = generateSeed();
    const result = rollDice(count, seed);
    setRollResult(result);
    setActiveMask(new Array(count).fill(true));
    setLethalMask(new Array(count).fill(false));
    setGameState('ARRANGED');

    setHistory(h => [...h, {
      id: `roll-${Date.now()}`, timestamp: Date.now(),
      turn, phase, diceCount: count,
      values: [...result.values], color: dieColor, seed, isReroll: false,
    }]);
  }, [count, dieColor, currentTurn, currentPhase]);

  // ── Repeat ──────────────────────────────────────────────────────────────
  const handleRepeat = useCallback(() => {
    if (!rollResult || count === 0) return;
    const turn  = currentTurn;
    const phase = currentPhase;

    const seed   = generateSeed();
    const result = rollDice(count, seed);
    setRollResult(result);
    setActiveMask(new Array(count).fill(true));
    setLethalMask(new Array(count).fill(false));
    setGameState('ARRANGED');

    setHistory(h => [...h, {
      id: `repeat-${Date.now()}`, timestamp: Date.now(),
      turn, phase, diceCount: count,
      values: [...result.values], color: dieColor, seed, isReroll: true,
    }]);
  }, [rollResult, count, dieColor, currentTurn, currentPhase]);

  // ── Delete face-value group ──────────────────────────────────────────────
  const handleDelete = useCallback((faceValue: number) => {
    if (!rollResult) return;
    setActiveMask(prev => {
      if (!prev) return prev;
      return prev.map((active, i) =>
        active && rollResult.values[i] === faceValue ? false : active,
      );
    });
    setLethalMask(prev => {
      if (!prev) return prev;
      return prev.map((lethal, i) =>
        rollResult.values[i] === faceValue ? false : lethal,
      );
    });
  }, [rollResult]);

  // ── Re-roll face-value group (skips lethal dice) ─────────────────────────
  const handleReroll = useCallback((faceValue: number) => {
    if (!rollResult) return;
    const indices: number[] = [];
    for (let i = 0; i < rollResult.values.length; i++) {
      if (activeMask && !activeMask[i]) continue;
      if (lethalMask && lethalMask[i]) continue; // lethal dice cannot be rerolled
      if (rollResult.values[i] === faceValue) indices.push(i);
    }
    if (indices.length === 0) return;

    const turn  = currentTurn;
    const phase = currentPhase;
    const seed  = generateSeed();
    const updated = rollSpecificDice(rollResult, indices, seed);
    setRollResult(updated);

    setHistory(h => [...h, {
      id: `reroll-${Date.now()}`, timestamp: Date.now(),
      turn, phase, diceCount: indices.length,
      values: indices.map(i => updated.values[i]),
      color: dieColor, seed, isReroll: true,
    }]);
  }, [rollResult, activeMask, lethalMask, dieColor, currentTurn, currentPhase]);

  // ── Toggle lethal for a face-value group ─────────────────────────────────
  const handleToggleLethal = useCallback((faceValue: number) => {
    if (!rollResult || !activeMask) return;
    // Check if ALL active dice of this value are already lethal
    const activeOfValue = rollResult.values
      .map((v, i) => (v === faceValue && activeMask[i]) ? i : -1)
      .filter(i => i >= 0);
    if (activeOfValue.length === 0) return;
    const allLethal = activeOfValue.every(i => lethalMask?.[i] ?? false);
    const newLethal = !allLethal; // toggle

    setLethalMask(prev => {
      const base = prev ?? new Array(rollResult.values.length).fill(false);
      return base.map((lethal, i) => {
        if (!activeMask[i] || rollResult.values[i] !== faceValue) return lethal;
        return newLethal;
      });
    });
  }, [rollResult, activeMask, lethalMask]);

  // ── Apply Sustained Hits: add N × sustainedX new dice ───────────────────
  const handleSustainedHits = useCallback((faceValue: number) => {
    if (!rollResult || !activeMask) return;
    // Count active non-lethal dice of this face value
    let n = 0;
    for (let i = 0; i < rollResult.values.length; i++) {
      if (!activeMask[i]) continue;
      if (lethalMask?.[i]) continue;
      if (rollResult.values[i] === faceValue) n++;
    }
    if (n === 0) return;

    const extra = Math.min(n * sustainedX, 120 - rollResult.count);
    if (extra <= 0) return;

    const turn  = currentTurn;
    const phase = currentPhase;
    const seed  = generateSeed();
    const updated = addDice(rollResult, extra, seed);

    setRollResult(updated);
    setCount(updated.count);
    setActiveMask(prev => [...(prev ?? []), ...new Array(extra).fill(true)]);
    setLethalMask(prev => [...(prev ?? []), ...new Array(extra).fill(false)]);

    setHistory(h => [...h, {
      id: `sus-${Date.now()}`, timestamp: Date.now(),
      turn, phase, diceCount: extra,
      values: updated.values.slice(-extra),
      color: dieColor, seed, isReroll: false,
    }]);
  }, [rollResult, activeMask, lethalMask, sustainedX, dieColor, currentTurn, currentPhase]);

  // ── Reset ────────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setCount(0);
    setRollResult(null);
    setActiveMask(null);
    setLethalMask(null);
    setGameState('PREVIEW');
  }, []);

  const handleTurnChange = useCallback((t: number) => {
    setCurrentTurn(t);
    lastTurnRef.current = t;
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#08080f' }}>

      <Canvas
        shadows
        camera={{ position: [0, 18, 15], fov: 40, near: 0.5, far: 85 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        dpr={[1, 2]}
        style={{ position: 'absolute', top: TOP_BAR_H, left: LEFT_W, right: 0, bottom: 0 }}
      >
        <fog attach="fog" args={['#08080f', 22, 60]} />

        <DiceScene
          count={count}
          gameState={gameState}
          rollResult={rollResult}
          dieColor={dieColor}
          activeMask={activeMask}
          lethalMask={lethalMask}
        />

        <OrbitControls
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
        onAddCount={handleAddCount}
        dieColor={dieColor}
        onColorChange={setDieColor}
        currentTurn={currentTurn}
        onTurnChange={handleTurnChange}
        currentPhase={currentPhase}
        onPhaseChange={setCurrentPhase}
        gameState={gameState}
        onThrow={handleThrow}
        onRepeat={handleRepeat}
        onReset={handleReset}
      />

      <ResultsPanel
        rollResult={rollResult}
        activeMask={activeMask}
        lethalMask={lethalMask}
        dieColor={dieColor}
        history={history}
        gameState={gameState}
        sustainedX={sustainedX}
        onSustainedXChange={setSustainedX}
        onDelete={handleDelete}
        onReroll={handleReroll}
        onSustainedHits={handleSustainedHits}
        onToggleLethal={handleToggleLethal}
      />
    </div>
  );
}
