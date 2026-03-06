/**
 * Lighting — Scene lights for the dice board
 */

'use client';

export function Lighting() {
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
