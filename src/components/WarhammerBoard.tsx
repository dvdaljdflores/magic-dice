/**
 * LAYER 1/2/3 — WarhammerBoard: Root Orchestrator
 *
 * Layout:
 *   - Top bar (UIControls): absolute, full width, ~72px
 *   - Left panel (ResultsPanel): absolute, 240px wide, below top bar
 *   - Canvas (DiceScene): absolute, fills remaining area
 *
 * State:
 *   - count: additive dice pool (clicking +ND6 adds, Limpiar resets)
 *   - gameState: PREVIEW | ARRANGED
 *   - rollResult: computed by DiceEngine before any visual update
 *   - activeMask: which dice are still active (not deleted)
 *   - currentTurn / currentPhase: for history labels
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type {
  GameState, DiceRollResult, DieColor, WarhPhase, RollHistoryEntry,
} from '../core/types';
import { rollDice, rollSpecificDice, generateSeed } from '../core/DiceEngine';
import { DiceScene } from './DiceScene';
import { UIControls } from './UIControls';
import { ResultsPanel } from './ResultsPanel';

const TOP_BAR_H  = 72;  // px — height of the 2-row top bar
const LEFT_W     = 240; // px — width of the results panel

export default function WarhammerBoard() {
  const [count,        setCount]        = useState(0);
  const [gameState,    setGameState]    = useState<GameState>('PREVIEW');
  const [rollResult,   setRollResult]   = useState<DiceRollResult | null>(null);
  const [dieColor,     setDieColor]     = useState<DieColor>('white');
  const [activeMask,   setActiveMask]   = useState<boolean[] | null>(null);
  const [history,      setHistory]      = useState<RollHistoryEntry[]>([]);
  const [currentTurn,  setCurrentTurn]  = useState(1);
  const [currentPhase, setCurrentPhase] = useState<WarhPhase | null>(null);

  // Track last used turn so auto-inherit works
  const lastTurnRef = useRef(1);

  // ── Add dice (additive) ─────────────────────────────────────────────────
  const handleAddCount = useCallback((n: number) => {
    setCount(prev => Math.min(120, prev + n));
    // If we had results, keep them — just update preview count
    // The user needs to click Tirar to roll the new total
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
    setGameState('ARRANGED');

    setHistory(h => [...h, {
      id:        `roll-${Date.now()}`,
      timestamp: Date.now(),
      turn,
      phase,
      diceCount: count,
      values:    [...result.values],
      color:     dieColor,
      seed,
      isReroll:  false,
    }]);
  }, [count, dieColor, currentTurn, currentPhase]);

  // ── Repeat (re-roll all, marked as tirada repetida) ────────────────────
  const handleRepeat = useCallback(() => {
    if (!rollResult || count === 0) return;
    const turn  = currentTurn;
    const phase = currentPhase;

    const seed   = generateSeed();
    const result = rollDice(count, seed);
    setRollResult(result);
    setActiveMask(new Array(count).fill(true));
    setGameState('ARRANGED');

    setHistory(h => [...h, {
      id:        `repeat-${Date.now()}`,
      timestamp: Date.now(),
      turn,
      phase,
      diceCount: count,
      values:    [...result.values],
      color:     dieColor,
      seed,
      isReroll:  true,
    }]);
  }, [rollResult, count, dieColor, currentTurn, currentPhase]);

  // ── Delete all dice showing faceValue ───────────────────────────────────
  const handleDelete = useCallback((faceValue: number) => {
    if (!rollResult) return;
    setActiveMask(prev => {
      if (!prev) return prev;
      return prev.map((active, i) =>
        active && rollResult.values[i] === faceValue ? false : active,
      );
    });
  }, [rollResult]);

  // ── Re-roll dice showing faceValue ──────────────────────────────────────
  const handleReroll = useCallback((faceValue: number) => {
    if (!rollResult) return;
    const indices: number[] = [];
    for (let i = 0; i < rollResult.values.length; i++) {
      if (activeMask && !activeMask[i]) continue;
      if (rollResult.values[i] === faceValue) indices.push(i);
    }
    if (indices.length === 0) return;

    const turn  = currentTurn;
    const phase = currentPhase;
    const seed  = generateSeed();
    const updated = rollSpecificDice(rollResult, indices, seed);
    setRollResult(updated);

    setHistory(h => [...h, {
      id:        `reroll-${Date.now()}`,
      timestamp: Date.now(),
      turn,
      phase,
      diceCount: indices.length,
      values:    indices.map(i => updated.values[i]),
      color:     dieColor,
      seed,
      isReroll:  true,
    }]);
  }, [rollResult, activeMask, dieColor, currentTurn, currentPhase]);

  // ── Reset / Limpiar mesa ────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setCount(0);
    setRollResult(null);
    setActiveMask(null);
    setGameState('PREVIEW');
    // Keep history — just clear the board
  }, []);

  // ── Turn change ─────────────────────────────────────────────────────────
  const handleTurnChange = useCallback((t: number) => {
    setCurrentTurn(t);
    lastTurnRef.current = t;
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#08080f' }}>

      {/* 3D Canvas — offset by top bar + left panel */}
      <Canvas
        shadows
        camera={{ position: [0, 18, 15], fov: 40, near: 0.5, far: 85 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        dpr={[1, 2]}
        style={{
          position: 'absolute',
          top: TOP_BAR_H,
          left: LEFT_W,
          right: 0,
          bottom: 0,
        }}
      >
        <fog attach="fog" args={['#08080f', 22, 60]} />

        <DiceScene
          count={count}
          gameState={gameState}
          rollResult={rollResult}
          dieColor={dieColor}
          activeMask={activeMask}
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

      {/* Top control bar */}
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

      {/* Left results + history panel */}
      <ResultsPanel
        rollResult={rollResult}
        activeMask={activeMask}
        dieColor={dieColor}
        history={history}
        onDelete={handleDelete}
        onReroll={handleReroll}
      />
    </div>
  );
}
