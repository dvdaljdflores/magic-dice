/**
 * LAYER 1 — DiceScene: InstancedMesh Renderer (no physics)
 *
 * Two InstancedMeshes:
 *   1. meshRef     — normal dice (white/red/blue/green per dieColor)
 *   2. lethalMeshRef — lethal/mortal-wound dice (fixed purple)
 *
 * Lethal zone: front strip of the board at z = LETHAL_ZONE_Z.
 * When lethal dice are present, normal dice compress into z = -7 to +1.5.
 */

'use client';

import { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { DiceRollResult, GameState, DieColor } from '../core/types';
import { createDiceGeometry } from '../rendering/DiceGeometry';
import { createDiceMaterial, DIE_COLOR_MAP } from '../rendering/DiceMaterial';
import { PREVIEW_QUATERNION, faceUpQuaternion } from '../core/DiceEngine';

const MAX_DICE = 120;
const BOARD_W  = 22;
const BOARD_D  = 16;
const ROW_SP   = 2.0;
const COL_SP   = 1.35;

// Lethal zone constants
const LETHAL_ZONE_Z  = 6.0;  // z-center of mortal wounds strip
const NORMAL_Z_MIN   = -7.0; // normal dice back edge
const NORMAL_Z_MAX   =  1.5; // normal dice front edge when lethal exists

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
  lethalMask: boolean[] | null;
}

export function DiceScene({
  count, gameState, rollResult, dieColor, activeMask, lethalMask,
}: DiceSceneProps) {
  const meshRef      = useRef<THREE.InstancedMesh>(null);
  const lethalMeshRef = useRef<THREE.InstancedMesh>(null);

  const geo      = useMemo(() => createDiceGeometry(), []);
  const mat      = useMemo(() => createDiceMaterial(), []);
  const lethalMat = useMemo(() => {
    const m = createDiceMaterial();
    m.color.set(0.55, 0.08, 0.82); // purple for mortal wounds
    return m;
  }, []);

  const hasAnyLethal = useMemo(
    () => !!lethalMask?.some(Boolean),
    [lethalMask],
  );

  useEffect(() => {
    const mesh      = meshRef.current;
    const lethalMesh = lethalMeshRef.current;
    if (!mesh || !lethalMesh) return;

    // Hide all slots in both meshes
    for (let i = 0; i < MAX_DICE; i++) {
      mesh.setMatrixAt(i, _zero);
      lethalMesh.setMatrixAt(i, _zero);
    }

    const n = count;
    if (n > 0) {
      const s = computeScale(n);
      _sc.set(s, s, s);

      if (gameState === 'PREVIEW' || !rollResult) {
        // ── PREVIEW: all dice in a centered grid ───────────────────────
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
        // ── ARRANGED: split normal vs lethal ───────────────────────────
        const normalGroups: Record<number, number[]> = {};
        const lethalGroups: Record<number, number[]> = {};

        for (let i = 0; i < rollResult.values.length; i++) {
          if (activeMask && !activeMask[i]) continue;
          const v        = rollResult.values[i];
          const isLethal = lethalMask?.[i] ?? false;
          const target   = isLethal ? lethalGroups : normalGroups;
          if (!target[v]) target[v] = [];
          target[v].push(i);
        }

        // Normal dice — compressed z-range when lethal zone is in use
        const normalVals = [1, 2, 3, 4, 5, 6].filter(v => (normalGroups[v]?.length ?? 0) > 0);
        if (normalVals.length > 0) {
          const rowSp   = s * ROW_SP;
          const colSp   = s * COL_SP;
          const zMin    = hasAnyLethal ? NORMAL_Z_MIN : -(BOARD_D / 2 - s);
          const zMax    = hasAnyLethal ? NORMAL_Z_MAX :  (BOARD_D / 2 - s);
          const avail   = zMax - zMin;
          const span    = (normalVals.length - 1) * rowSp;
          const startZ  = zMin + Math.max(0, (avail - span) / 2);
          const maxLen  = Math.max(...normalVals.map(v => normalGroups[v].length));
          const startX  = -((maxLen - 1) * colSp) / 2;

          normalVals.forEach((v, rowIdx) => {
            const row = normalGroups[v];
            const z   = startZ + rowIdx * rowSp;
            _q.copy(faceUpQuaternion(v));
            row.forEach((dieIdx, colIdx) => {
              _p.set(startX + colIdx * colSp, s / 2 + 0.01, z);
              _mat.compose(_p, _q, _sc);
              mesh.setMatrixAt(dieIdx, _mat);
            });
          });
        }

        // Lethal dice — single row at LETHAL_ZONE_Z
        const lethalAll: { dieIdx: number; v: number }[] = [];
        for (const v of [1, 2, 3, 4, 5, 6]) {
          for (const dieIdx of lethalGroups[v] ?? []) {
            lethalAll.push({ dieIdx, v });
          }
        }
        if (lethalAll.length > 0) {
          const colSp  = s * COL_SP;
          const startX = -((lethalAll.length - 1) * colSp) / 2;
          lethalAll.forEach(({ dieIdx, v }, colIdx) => {
            _q.copy(faceUpQuaternion(v));
            _p.set(startX + colIdx * colSp, s / 2 + 0.01, LETHAL_ZONE_Z);
            _mat.compose(_p, _q, _sc);
            lethalMesh.setMatrixAt(dieIdx, _mat);
          });
        }
      }

      mat.color.copy(DIE_COLOR_MAP[dieColor]);
    }

    mesh.instanceMatrix.needsUpdate = true;
    lethalMesh.instanceMatrix.needsUpdate = true;
    mesh.count = MAX_DICE;
    lethalMesh.count = MAX_DICE;
  }, [count, gameState, rollResult, activeMask, lethalMask, dieColor, hasAnyLethal]);

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

      {/* Mortal Wounds zone — dark red strip at front of board */}
      {hasAnyLethal && (
        <mesh position={[0, 0.002, LETHAL_ZONE_Z]}>
          <boxGeometry args={[BOARD_W - 1.4, 0.012, 3.6]} />
          <meshStandardMaterial color="#3a0010" roughness={0.9} transparent opacity={0.75} />
        </mesh>
      )}

      {/* Normal dice */}
      <instancedMesh
        ref={meshRef}
        args={[geo, mat, MAX_DICE]}
        castShadow
        receiveShadow
        frustumCulled={false}
      />

      {/* Lethal / Mortal Wound dice — purple material */}
      <instancedMesh
        ref={lethalMeshRef}
        args={[geo, lethalMat, MAX_DICE]}
        castShadow
        receiveShadow
        frustumCulled={false}
      />
    </>
  );
}
