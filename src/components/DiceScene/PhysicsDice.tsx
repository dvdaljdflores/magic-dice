/**
 * PhysicsDice — Physics-driven dice during ROLLING + SETTLING phases
 *
 * Reads store non-reactively in useFrame for performance.
 */

'use client';

import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import type { DieColor } from '../../core/types';
import { faceUpQuaternion } from '../../core/DiceEngine';
import { DIE_COLOR_MAP } from '../../rendering/DiceMaterial';
import { useDiceStore } from '../../store/diceStore';
import { isBodySettled } from '../../physics/settleDetection';
import { PHYSICS_CONFIG } from '../../physics/constants';
import { computeScale } from './sceneUtils';

interface PhysicsDiceProps {
  count: number;
  geo: THREE.BoxGeometry;
  mat: THREE.MeshStandardMaterial;
  dieColor: DieColor;
}

export function PhysicsDice({ count, geo, mat, dieColor }: PhysicsDiceProps) {
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
    if (store.phase === 'ROLLING' && !throwApplied.current && store.throwParams) {
      const allReady = rigidBodies.current.slice(0, count).every(b => b !== null);
      if (!allReady) return;

      rotSnapped.current = new Array(count).fill(false);

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
            const fq = faceUpQuaternion(rollResult.values[i]);
            body.setRotation({ x: fq.x, y: fq.y, z: fq.z, w: fq.w }, true);
          }
        }
      }

      for (let i = 0; i < Math.min(count, store.throwParams.length); i++) {
        const body = rigidBodies.current[i];
        if (!body) continue;
        if (locked?.has(i)) continue;
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
        if (locked?.has(i)) continue;
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
