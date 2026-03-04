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
import * as THREE from 'three';
import type { DiceRollResult, GamePhase, DieColor } from '../core/types';
import { createDiceGeometry } from '../rendering/DiceGeometry';
import { createDiceMaterial, DIE_COLOR_MAP } from '../rendering/DiceMaterial';
import { PREVIEW_QUATERNION } from '../core/DiceEngine';
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
  return Math.max(0.55, Math.min(1.5, 9 / Math.sqrt(Math.max(1, n))));
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
    m.color.set(0.55, 0.08, 0.82);
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
        <ArrangedDice
          rollResult={rollResult}
          lethalMask={lethalMask}
          dieColor={dieColor}
          geo={geo}
          mat={mat}
          lethalMat={lethalMat}
          gamePhase={gamePhase}
        />
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
  const rigidBodies = useRef<(RapierRigidBody | null)[]>([]);
  const throwApplied = useRef(false);
  const settleFrames = useRef(0);

  useEffect(() => {
    throwApplied.current = false;
    settleFrames.current = 0;
    mat.color.copy(DIE_COLOR_MAP[dieColor]);
  }, [dieColor, mat]);

  useFrame(() => {
    const store = useDiceStore.getState();

    // Apply impulses once on ROLLING
    if (store.phase === 'ROLLING' && !throwApplied.current && store.throwParams) {
      for (let i = 0; i < Math.min(count, store.throwParams.length); i++) {
        const body = rigidBodies.current[i];
        if (!body) continue;
        const tp = store.throwParams[i];
        body.setTranslation(tp.startPosition, true);
        body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        body.setAngvel({ x: 0, y: 0, z: 0 }, true);
        body.applyImpulse(tp.impulse, true);
        body.applyTorqueImpulse(tp.torque, true);
        body.wakeUp();
      }
      throwApplied.current = true;
      useDiceStore.setState({ phase: 'SETTLING' });
      return;
    }

    // Check for settle during SETTLING
    if (store.phase === 'SETTLING') {
      let allSettled = true;
      for (let i = 0; i < count; i++) {
        const body = rigidBodies.current[i];
        if (!body) continue;
        if (!isBodySettled(body.linvel(), body.angvel())) {
          allSettled = false;
          break;
        }
      }

      if (allSettled) {
        settleFrames.current++;
        if (settleFrames.current > 10) {
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
      {Array.from({ length: count }, (_, i) => (
        <RigidBody
          key={i}
          ref={(el: RapierRigidBody | null) => { rigidBodies.current[i] = el; }}
          position={[0, 10 + i * 0.1, -6]}
          restitution={PHYSICS_CONFIG.restitution}
          friction={PHYSICS_CONFIG.friction}
          linearDamping={PHYSICS_CONFIG.linearDamping}
          angularDamping={PHYSICS_CONFIG.angularDamping}
          colliders="cuboid"
          canSleep={false}
        >
          <mesh geometry={geo} material={mat} scale={[s, s, s]} castShadow receiveShadow />
        </RigidBody>
      ))}
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

function ArrangedDice({ rollResult, lethalMask, dieColor, geo, mat, lethalMat, gamePhase }: {
  rollResult: DiceRollResult | null;
  lethalMask: boolean[] | null;
  dieColor: DieColor;
  geo: THREE.BoxGeometry;
  mat: THREE.MeshStandardMaterial;
  lethalMat: THREE.MeshStandardMaterial;
  gamePhase: GamePhase;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const lethalMeshRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    mat.color.copy(DIE_COLOR_MAP[dieColor]);
  }, [dieColor, mat]);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    const lethalMesh = lethalMeshRef.current;
    if (!mesh || !lethalMesh || !rollResult) return;

    const store = useDiceStore.getState();

    if (store.phase === 'ARRANGING') {
      store.tickArrangeAnimation(delta);
    }

    const { arrangeTargets, arrangeProgress } = useDiceStore.getState();
    if (!arrangeTargets) return;

    const n = rollResult.count;
    const s = computeScale(n);
    _sc.set(s, s, s);

    for (let i = 0; i < MAX_DICE; i++) {
      mesh.setMatrixAt(i, _zero);
      lethalMesh.setMatrixAt(i, _zero);
    }

    const t = easeOutCubic(arrangeProgress);

    for (const [dieIdx, target] of arrangeTargets) {
      const isLethal = lethalMask?.[dieIdx] ?? false;
      const targetMesh = isLethal ? lethalMesh : mesh;

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
    mesh.count = MAX_DICE;
    lethalMesh.count = MAX_DICE;
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
    </>
  );
}

// ─── Easing ───────────────────────────────────────────────────────────

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
