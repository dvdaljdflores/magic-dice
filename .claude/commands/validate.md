# Validate Code

Run a comprehensive code validation pipeline for this Warhammer 40K dice simulator. Execute each step sequentially and report all findings in a structured summary at the end.

## Step 1: TypeScript Compilation Check

Run `npx tsc --noEmit` to check for type errors across the entire project. Report each error with file, line, and description.

## Step 2: Next.js Build Validation

Run `npm run build` to verify the production build succeeds. This catches:
- Import resolution failures
- WASM bundling issues (Rapier3D)
- SSR boundary violations (Three.js/WebGL components must be dynamically imported with `ssr: false`)
- React Server Component vs Client Component mismatches

Report any build errors or warnings.

## Step 3: Architecture Constraint Validation

Read the source files and verify these project-specific invariants:

### 3a. SSR Boundary
- `WarhammerBoard` (or any component using Three.js/React Three Fiber) MUST be imported via `dynamic(() => import(...), { ssr: false })` in pages.
- No Three.js imports (`three`, `@react-three/fiber`, `@react-three/drei`) should appear in files that run on the server.

### 3b. Deterministic Engine Integrity
- `DiceEngine.ts` must NOT use `Math.random()` for dice values or quaternions — only the seeded `mulberry32` RNG.
- `generateSeed()` is the ONLY function allowed to use `Math.random()` (for seed generation, not roll results).
- Verify `rollDice`, `rollSpecificDice`, and `addDice` all use the seeded RNG exclusively.

### 3c. Mask Consistency
- `activeMask` and `lethalMask` arrays must always match `rollResult.count` in length when they are set.
- Reroll operations (`rollSpecificDice`) must skip indices where `lethalMask[i] === true`.
- Delete operations must only toggle `activeMask`, never mutate `rollResult.values`.

### 3d. InstancedMesh Bounds
- Maximum dice per InstancedMesh must not exceed 120.
- Two separate meshes must exist: one for normal dice, one for lethal (Mortal Wounds) dice.

### 3e. Type Safety
- `GameState` must only be `'PREVIEW' | 'ARRANGED'`.
- `WarhPhase` must only be `'DISPARO' | 'CARGA' | 'COMBATE' | 'MORAL'`.
- `SustainedX` must only be `1 | 2 | 3`.
- `DieColor` must only be `'white' | 'red' | 'blue' | 'green'`.

## Step 4: Common Bug Patterns

Scan the codebase for these known risk areas:

- **Float32Array index math**: Quaternion offsets must be `i * 4` with 4 components `[x, y, z, w]`. Look for off-by-one errors.
- **Stale closure bugs**: React state updates in callbacks that reference `rollResult`, `activeMask`, or `lethalMask` should use functional updaters or be in the dependency arrays of `useCallback`/`useEffect`.
- **Missing keys in React lists**: Any `.map()` rendering must have stable `key` props.
- **Unused imports**: Flag any dead imports.

## Output Format

Produce a structured report:

```
## Validation Report

### TypeScript: ✅ PASS | ❌ FAIL
[errors if any]

### Build: ✅ PASS | ❌ FAIL
[errors/warnings if any]

### Architecture Constraints:
- SSR Boundary: ✅ | ❌
- Deterministic Engine: ✅ | ❌
- Mask Consistency: ✅ | ❌
- InstancedMesh Bounds: ✅ | ❌
- Type Safety: ✅ | ❌

### Bug Patterns:
- Float32Array indexing: ✅ | ❌
- Stale closures: ✅ | ⚠️ [details]
- React keys: ✅ | ❌
- Unused imports: ✅ | ⚠️ [list]

### Summary
[overall assessment + recommended fixes]
```

If everything passes, confirm the codebase is healthy. If issues are found, prioritize them by severity (errors > warnings > suggestions) and propose specific fixes.
