/**
 * Hook — Shake-to-roll on mobile
 *
 * Listens to DeviceMotionEvent (with iOS permission request) and
 * triggers the provided callback when a shake gesture is detected.
 * Only active when `enabled` is true (i.e. on mobile).
 */

import { useEffect } from 'react';

const SHAKE_THRESHOLD = 25;
const SHAKE_POWER_MIN = 120;
const SHAKE_SETTLE_MS = 250;

export function useDeviceMotion(
  enabled: boolean,
  canThrow: boolean,
  onShake: () => void,
): void {
  useEffect(() => {
    if (!enabled) return;

    let lastTime = 0;
    let shakePower = 0;

    function handleMotion(event: DeviceMotionEvent) {
      const acc = event.accelerationIncludingGravity;
      if (!acc) return;

      const magnitude =
        Math.abs(acc.x ?? 0) +
        Math.abs(acc.y ?? 0) +
        Math.abs(acc.z ?? 0);

      const now = Date.now();

      if (magnitude > SHAKE_THRESHOLD) {
        shakePower += magnitude;
        lastTime = now;
      }

      if (shakePower > SHAKE_POWER_MIN && now - lastTime > SHAKE_SETTLE_MS) {
        if (canThrow) {
          onShake();
        }
        shakePower = 0;
      }
    }

    function startMotion() {
      window.addEventListener('devicemotion', handleMotion);
    }

    // iOS requires explicit permission
    if (
      typeof DeviceMotionEvent !== 'undefined' &&
      typeof (DeviceMotionEvent as any).requestPermission === 'function'
    ) {
      (DeviceMotionEvent as any)
        .requestPermission()
        .then((response: string) => {
          if (response === 'granted') {
            startMotion();
          }
        })
        .catch(console.error);
    } else {
      startMotion();
    }

    return () => {
      window.removeEventListener('devicemotion', handleMotion);
    };
  }, [enabled, canThrow, onShake]);
}
