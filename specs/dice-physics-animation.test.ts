// specs/dice-physics-animation.test.ts
// Spec-driven tests — run with: npx tsx specs/dice-physics-animation.test.ts

import { computeThrowParams } from '../src/core/ThrowCalculator';
import { computeArrangeTargets } from '../src/core/ArrangeLayout';
import { isBodySettled } from '../src/physics/settleDetection';
import { faceUpQuaternion } from '../src/core/DiceEngine';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  } else {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  }
}

function section(name: string) {
  console.log(`\n── ${name} ──`);
}

// ═══════════════════════════════════════════════════════════════════════
// ThrowCalculator
// ═══════════════════════════════════════════════════════════════════════

section('ThrowCalculator: computeThrowParams');

// TC-1: Single die returns array of length 1
{
  const result = computeThrowParams(1, 'seed-A');
  assert(result.length === 1, 'TC-1: single die → length 1');
}

// TC-2: 120 dice returns array of length 120
{
  const result = computeThrowParams(120, 'seed-B');
  assert(result.length === 120, 'TC-2: 120 dice → length 120');
}

// TC-3: All impulse.y are positive (dice always go up)
{
  const result = computeThrowParams(5, 'seed-C');
  const allPositiveY = result.every(p => p.impulse.y > 0);
  assert(allPositiveY, 'TC-3: all impulse.y positive');
}

// TC-4: Same seed produces identical results (deterministic)
{
  const r1 = computeThrowParams(5, 'seed-C');
  const r2 = computeThrowParams(5, 'seed-C');
  const identical = JSON.stringify(r1) === JSON.stringify(r2);
  assert(identical, 'TC-4: same seed → identical throw params');
}

// TC-5: Zero dice returns empty array
{
  const result = computeThrowParams(0, 'seed-D');
  assert(result.length === 0, 'TC-5: 0 dice → empty array');
}

// TC-6: Start positions y between [6, 10]
{
  const result = computeThrowParams(10, 'seed-E');
  const allInRange = result.every(p =>
    p.startPosition.y >= 6 && p.startPosition.y <= 10
  );
  assert(allInRange, 'TC-6: startPosition.y in [6, 10]');
}

// TC-7: Torque magnitudes between [-15, 15]
{
  const result = computeThrowParams(10, 'seed-E');
  const inRange = result.every(p =>
    Math.abs(p.torque.x) <= 15 &&
    Math.abs(p.torque.y) <= 15 &&
    Math.abs(p.torque.z) <= 15
  );
  assert(inRange, 'TC-7: torque magnitudes in [-15, 15]');
}

// ═══════════════════════════════════════════════════════════════════════
// ArrangeLayout
// ═══════════════════════════════════════════════════════════════════════

section('ArrangeLayout: computeArrangeTargets');

// TC-8: 3 dice with different values → 3 targets in separate rows
{
  const targets = computeArrangeTargets(
    [1, 2, 3], [true, true, true], [false, false, false], 1.0, false,
  );
  assert(targets.size === 3, 'TC-8a: 3 different values → 3 targets');
  const zValues = [...targets.values()].map(t => t.position[2]);
  const allDifferentZ = new Set(zValues).size === 3;
  assert(allDifferentZ, 'TC-8b: each in different row (different z)');
}

// TC-9: Inactive die omitted from targets
{
  const targets = computeArrangeTargets(
    [1, 1, 1], [true, false, true], [false, false, false], 1.0, false,
  );
  assert(targets.size === 2, 'TC-9a: inactive die excluded → 2 targets');
  assert(!targets.has(1), 'TC-9b: index 1 (inactive) not in targets');
}

// TC-10: All lethal → targets in lethal zone (z ≈ 6)
{
  const targets = computeArrangeTargets(
    [6, 6], [true, true], [true, true], 1.0, true,
  );
  assert(targets.size === 2, 'TC-10a: 2 lethal targets');
  const allInLethalZone = [...targets.values()].every(
    t => Math.abs(t.position[2] - 6.0) < 2.0,
  );
  assert(allInLethalZone, 'TC-10b: targets in lethal zone (z ≈ 6)');
}

// TC-11: Mixed normal + lethal → different zones
{
  const targets = computeArrangeTargets(
    [1, 2], [true, true], [false, true], 1.0, true,
  );
  const t0 = targets.get(0)!;
  const t1 = targets.get(1)!;
  assert(t0.position[2] < 3, 'TC-11a: normal die in normal zone');
  assert(t1.position[2] > 4, 'TC-11b: lethal die in lethal zone');
}

// TC-12: Empty input → empty Map
{
  const targets = computeArrangeTargets([], [], [], 1.0, false);
  assert(targets.size === 0, 'TC-12: empty input → empty Map');
}

// TC-13: 120 dice → 120 targets, no overlaps
{
  const values = Array.from({length: 120}, (_, i) => (i % 6) + 1);
  const active = new Array(120).fill(true);
  const lethal = new Array(120).fill(false);
  const targets = computeArrangeTargets(values, active, lethal, 0.6, false);
  assert(targets.size === 120, 'TC-13a: 120 dice → 120 targets');
  const positions = [...targets.values()].map(t => t.position);
  let overlaps = 0;
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const dx = positions[i][0] - positions[j][0];
      const dz = positions[i][2] - positions[j][2];
      if (Math.sqrt(dx*dx + dz*dz) < 0.3) overlaps++;
    }
  }
  assert(overlaps === 0, 'TC-13b: no overlapping positions');
}

// TC-14: Quaternions point correct face up (+Y)
{
  const values = [1, 3, 6];
  const targets = computeArrangeTargets(
    values, [true, true, true], [false, false, false], 1.0, false,
  );
  const close = (a: number, b: number) => Math.abs(a - b) < 0.001;
  let allMatch = true;
  for (const [i, target] of targets) {
    const expected = faceUpQuaternion(values[i]);
    const [qx, qy, qz, qw] = target.quaternion;
    if (!(close(qx, expected.x) && close(qy, expected.y) &&
          close(qz, expected.z) && close(qw, expected.w))) {
      allMatch = false;
    }
  }
  assert(allMatch, 'TC-14: all quaternions point correct face up');
}

// ═══════════════════════════════════════════════════════════════════════
// settleDetection
// ═══════════════════════════════════════════════════════════════════════

section('settleDetection: isBodySettled');

// TC-15: Zero velocity → settled
{
  assert(
    isBodySettled({x:0,y:0,z:0}, {x:0,y:0,z:0}) === true,
    'TC-15: zero velocity → settled',
  );
}

// TC-16: High linear velocity → not settled
{
  assert(
    isBodySettled({x:5,y:0,z:0}, {x:0,y:0,z:0}) === false,
    'TC-16: high linvel → not settled',
  );
}

// TC-17: High angular velocity → not settled
{
  assert(
    isBodySettled({x:0,y:0,z:0}, {x:0,y:5,z:0}) === false,
    'TC-17: high angvel → not settled',
  );
}

// TC-18: Just below threshold → settled
{
  assert(
    isBodySettled({x:0.07,y:0,z:0}, {x:0,y:0,z:0}) === true,
    'TC-18: linvel 0.07 (below 0.08 threshold) → settled',
  );
}

// TC-19: Just above threshold → not settled
{
  assert(
    isBodySettled({x:0.09,y:0,z:0}, {x:0,y:0,z:0}) === false,
    'TC-19: linvel 0.09 (above 0.08 threshold) → not settled',
  );
}

// TC-20: Custom threshold
{
  assert(
    isBodySettled({x:0.5,y:0,z:0}, {x:0,y:0,z:0}, 1.0) === true,
    'TC-20: custom threshold 1.0 → more permissive',
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════════════

console.log('\n══════════════════════════════════════════');
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('SOME TESTS FAILED');
  process.exit(1);
} else {
  console.log('ALL TESTS PASSED');
}
console.log('══════════════════════════════════════════\n');
