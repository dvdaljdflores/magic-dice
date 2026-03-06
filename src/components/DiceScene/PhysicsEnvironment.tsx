/**
 * PhysicsEnvironment — Floor and wall colliders for the Rapier physics scene
 */

'use client';

import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { BOARD_W, BOARD_D } from './sceneUtils';
import { PHYSICS_CONFIG } from '../../physics/constants';

export function PhysicsFloor() {
  return (
    <RigidBody type="fixed" position={[0, -0.06, 0]}>
      <CuboidCollider args={[BOARD_W / 2, 0.06, BOARD_D / 2]} />
    </RigidBody>
  );
}

export function PhysicsWalls() {
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
