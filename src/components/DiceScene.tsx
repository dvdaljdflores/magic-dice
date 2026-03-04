/**
 * LAYER 1 — DiceScene: InstancedMesh Renderer (no physics)
 *
 * LAYER 3 — Two display modes:
 *   PREVIEW  — harmonic grid, all dice show face-6 orientation
 *   ARRANGED — sorted rows by face value, all dice in a row face same direction
 *
 * LAYER 3 — Dynamic die scale: clamp(9/√n, 0.55, 1.5)
 */

'use client';

import { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { DiceRollResult, GameState, DieColor } from '../core/types';
import { createDiceGeometry } from '../rendering/DiceGeometry';
import { createDiceMaterial, DIE_COLOR_MAP } from '../rendering/DiceMaterial';
// All instances share one material; color is updated via mat.color (no instanceColor needed)
import { PREVIEW_QUATERNION, faceUpQuaternion } from '../core/DiceEngine';

const MAX_DICE = 120;
const BOARD_W  = 22;
const BOARD_D  = 16;
const ROW_SP   = 2.0;   // row spacing × dieScale
const COL_SP   = 1.35;  // col spacing × dieScale

const _p    = new THREE.Vector3();
const _q    = new THREE.Quaternion();
const _sc   = new THREE.Vector3(1, 1, 1);
const _mat  = new THREE.Matrix4();
const _zero = new THREE.Matrix4().makeScale(0, 0, 0);

function computeScale(n: number): number {
  return Math.max(0.55, Math.min(1.5, 9 / Math.sqrt(Math.max(1, n))));
}

interface DiceSceneProps {
  count: number;
  gameState: GameState;
  rollResult: DiceRollResult | null;
  dieColor: DieColor;
  activeMask: boolean[] | null;
}

export function DiceScene({
  count, gameState, rollResult, dieColor, activeMask,
}: DiceSceneProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const geo = useMemo(() => createDiceGeometry(), []);
  // No singleton cache — fresh material per mount so changes take effect immediately
  const mat = useMemo(() => createDiceMaterial(), []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const n = count;

    // Hide all slots first
    for (let i = 0; i < MAX_DICE; i++) mesh.setMatrixAt(i, _zero);

    if (n > 0) {
      const s = computeScale(n);
      _sc.set(s, s, s);

      if (gameState === 'PREVIEW' || !rollResult) {
        const cols    = Math.ceil(Math.sqrt(n * 1.3));
        const spacing = s * 1.4;
        const ox      = -((cols - 1) * spacing) / 2;
        const rowsN   = Math.ceil(n / cols);
        const oz      = -((rowsN - 1) * spacing) / 2;
        for (let i = 0; i < n; i++) {
          const c = i % cols;
          const r = Math.floor(i / cols);
          _p.set(ox + c * spacing, s / 2 + 0.01, oz + r * spacing);
          _q.copy(PREVIEW_QUATERNION);
          _mat.compose(_p, _q, _sc);
          mesh.setMatrixAt(i, _mat);
        }
      } else {
        const groups: Record<number, number[]> = {};
        for (let i = 0; i < rollResult.values.length; i++) {
          if (activeMask && !activeMask[i]) continue;
          const v = rollResult.values[i];
          if (!groups[v]) groups[v] = [];
          groups[v].push(i);
        }
        const presentVals = [1, 2, 3, 4, 5, 6].filter(v => (groups[v]?.length ?? 0) > 0);
        const rowSp     = s * ROW_SP;
        const colSp     = s * COL_SP;
        const totalD    = (presentVals.length - 1) * rowSp;
        const startZ    = -totalD / 2;
        // All rows share same startX — left-aligned from widest row
        const maxRowLen = Math.max(...presentVals.map(v => groups[v].length));
        const startX    = -((maxRowLen - 1) * colSp) / 2;
        presentVals.forEach((v, rowIdx) => {
          const row = groups[v];
          const z   = startZ + rowIdx * rowSp;
          // Use faceUpQuaternion(v) — no random yaw, all dice in row face same direction
          _q.copy(faceUpQuaternion(v));
          row.forEach((dieIdx, colIdx) => {
            _p.set(startX + colIdx * colSp, s / 2 + 0.01, z);
            _mat.compose(_p, _q, _sc);
            mesh.setMatrixAt(dieIdx, _mat);
          });
        });
      }

    }

    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = MAX_DICE;

    // Update shared material color — no instanceColor buffer needed, no timing issues
    mat.color.copy(DIE_COLOR_MAP[dieColor]);
  }, [count, gameState, rollResult, activeMask, dieColor]);

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

      {/* Light wood board */}
      <mesh position={[0, -0.06, 0]} receiveShadow>
        <boxGeometry args={[BOARD_W, 0.12, BOARD_D]} />
        <meshStandardMaterial color="#c9a87c" roughness={0.82} metalness={0.04} />
      </mesh>

      {/* Darker wood frame */}
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

      {/* InstancedMesh — up to 120 dice, one draw call */}
      <instancedMesh
        ref={meshRef}
        args={[geo, mat, MAX_DICE]}
        castShadow
        receiveShadow
        frustumCulled={false}
      />
    </>
  );
}
