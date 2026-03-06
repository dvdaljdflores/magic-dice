# Spec-Driven Development

Generate a complete specification BEFORE writing any implementation code. Follow this strict workflow for the feature described by the user: **$ARGUMENTS**

## Phase 1: Requirements Analysis

1. Parse the user's feature request and identify:
   - **What** the feature does (functional requirements)
   - **Where** it fits in the existing architecture (which layer/files are affected)
   - **Constraints** from the current system (deterministic RNG, mask-based management, SSR boundary, InstancedMesh limits)

2. Read the relevant existing source files to understand current interfaces and state shape.

3. Identify which of these areas are impacted:
   - `src/core/types.ts` — New types or extensions to existing types
   - `src/core/DiceEngine.ts` — New roll/computation functions
   - `src/core/RulesConfig.ts` — New Warhammer rule mechanics
   - `src/components/WarhammerBoard.tsx` — New state variables or callbacks
   - `src/components/DiceScene.tsx` — New 3D rendering behavior
   - `src/components/UIControls.tsx` — New UI buttons/controls
   - `src/components/ResultsPanel.tsx` — New result display elements
   - `src/rendering/` — New geometry or material changes

## Phase 2: Write the Specification

Create a spec file at `specs/<feature-name>.spec.md` with this structure:

```markdown
# Feature: <Name>

## Summary
One-paragraph description of the feature.

## Motivation
Why this feature is needed in the context of Warhammer 40K/AoS dice mechanics.

## Detailed Design

### Types
New or modified TypeScript interfaces/types with full signatures.

### State Changes
New state variables in WarhammerBoard, their types, and initial values.

### Core Logic
Pure function signatures with input/output contracts and edge cases.
For any function touching DiceEngine: specify seed behavior and determinism guarantees.

### UI Changes
Description of new controls, their placement, and user interaction flow.

### 3D Rendering Changes
Any changes to DiceScene, positioning, materials, or InstancedMesh behavior.

## Test Cases

### Unit Tests (Core Logic)
List specific test cases as input → expected output pairs:
- Test case name: `functionName(input)` → `expectedOutput`
- Include edge cases: empty arrays, max dice (120), boundary values

### Integration Tests (Component Behavior)
Describe state transitions to verify:
- Initial state → action → expected new state
- Include mask interactions if applicable

### Visual Verification
Describe what to visually confirm in the 3D scene after implementation.

## Implementation Plan
Ordered list of files to modify/create with specific changes per file.
Each step should be independently verifiable.

## Invariants
List invariants that MUST hold after implementation:
- Determinism: same seed + inputs = same outputs
- Mask lengths always equal rollResult.count
- Lethal dice excluded from rerolls
- InstancedMesh count ≤ 120
- No Math.random() in roll logic
- SSR boundary respected (no Three.js in server code)

## Out of Scope
Explicitly list what this feature does NOT include.
```

## Phase 3: Test Scaffold

After writing the spec, create test file(s) with the test cases defined as stubs:

1. If a test framework exists, use it. Otherwise, create the test file at `specs/<feature-name>.test.ts` as executable TypeScript that can be run with `npx tsx specs/<feature-name>.test.ts`.

2. Each test should:
   - Import the function/module under test (even though it doesn't exist yet — the import path documents the expected API)
   - Define input fixtures
   - Assert expected outputs
   - Mark as `// TODO: implement` where the actual function call goes

3. Structure the test file:
```typescript
// specs/<feature-name>.test.ts
// Spec-driven tests — run with: npx tsx specs/<feature-name>.test.ts

import { /* expected exports */ } from '../src/core/<module>';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`PASS: ${message}`);
}

// --- Unit Tests ---

// Test 1: <description>
{
  const input = /* ... */;
  const expected = /* ... */;
  // TODO: const result = functionName(input);
  // assert(result === expected, '<test name>');
}

// --- Edge Cases ---

// Test N: <description>
{
  // ...
}

console.log('\nAll tests defined. Implement the TODOs and re-run.');
```

## Phase 4: Present the Spec

Output the full spec to the user and ask for approval before any implementation begins. Highlight:
- Key design decisions and alternatives considered
- Any assumptions made
- Which existing code will be modified (with line ranges)

**Do NOT write implementation code until the user approves the spec.**

## Phase 5: Implementation (Post-Approval)

Once approved:
1. Implement in the order defined in the spec's Implementation Plan
2. After each file change, run `npx tsc --noEmit` to verify types
3. Run the test scaffold after implementing each function
4. After all code is written, run `npm run build` to verify the full build
5. Use the `/validate` skill to run the full validation pipeline
6. Present a summary of all changes made, mapping each back to the spec
