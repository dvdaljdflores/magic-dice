# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Warhammer 40K/Age of Sigmar 3D dice rolling simulator built with Next.js 16, Three.js, and React Three Fiber. Supports up to 120 dice with deterministic seeded RNG, InstancedMesh rendering, and Warhammer-specific mechanics (Sustained Hits, Lethal Hits/Mortal Wounds).

## Commands

```bash
npm run dev      # Development server at http://localhost:3000
npm run build    # Production build
npm start        # Production server
```

No test runner or linter is configured.

## Architecture

### Layered Design

**Core logic** (`src/core/`):
- `DiceEngine.ts` — Deterministic dice rolling via Mulberry32 seeded PRNG. Generates values + quaternions for each die face orientation. Key functions: `rollDice()`, `rollSpecificDice()`, `addDice()`.
- `types.ts` — Game state types (`PREVIEW` | `ARRANGED`), phases (`DISPARO` | `CARGA` | `COMBATE` | `MORAL`), roll history entries.
- `RulesConfig.ts` — Warhammer rule thresholds (success, critical, sustained multiplier, lethal flag). `countSuccesses`/`countCriticals` are placeholder stubs.

**3D Rendering** (`src/rendering/`):
- `DiceGeometry.ts` — BoxGeometry with 6-cell horizontal UV atlas.
- `DiceMaterial.ts` — Canvas-generated 768×128px texture atlas with pip patterns. Uses vertex colors for die color variants (white/red/blue/green).

**Components** (`src/components/`):
- `WarhammerBoard.tsx` — Root orchestrator. Owns all state: dice count, roll results, active/lethal masks, turn/phase tracking, roll history, sustained multiplier.
- `DiceScene.tsx` — Two InstancedMeshes (normal + lethal/purple dice, 120 max each). Handles PREVIEW grid layout and ARRANGED sorted-by-face layout. Lethal dice render in a separate zone at z=6.
- `UIControls.tsx` — Top control bar: turn/phase selectors, color swatches, throw/add/reset buttons.
- `ResultsPanel.tsx` — Left sidebar: per-face-value counts with delete/reroll/sustained/lethal actions, SUS ×1/2/3 selector, roll history log.

### Key Patterns

- **Result-first**: Dice values and quaternions are computed deterministically before any visual update. Same seed + count = identical results.
- **Mask-based management**: `activeMask[]` hides deleted dice; `lethalMask[]` isolates Mortal Wound dice from rerolls and renders them separately.
- **SSR disabled**: `WarhammerBoard` is dynamically imported with `ssr: false` in `pages/index.tsx` because Three.js requires WebGL.
- **WASM support**: `next.config.ts` configures both Turbopack and Webpack fallback for Rapier3D WASM loading (AsyncWebAssembly + layers experiments).

### TypeScript

Strict mode enabled. Path alias `@/*` maps to project root.

## Agent Skills

- `/validate` — Runs a full code validation pipeline: TypeScript compilation, Next.js build, architecture constraint checks (SSR boundary, deterministic engine integrity, mask consistency, InstancedMesh bounds), and common bug pattern scans. Produces a structured pass/fail report.
- `/spec <feature description>` — Spec-driven development workflow. Generates a full specification with types, state changes, test cases, and implementation plan BEFORE writing any code. Creates test scaffolds at `specs/`. Does not implement until the spec is approved.
