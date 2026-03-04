# Feature: Animación de física de dados con Rapier3D

## Summary

Simulador de dados D6 3D con física real usando `@react-three/rapier`. Los dados se lanzan al aire, giran, caen sobre la mesa, rebotan y se asientan. Después del asentamiento se animan hacia posiciones ordenadas por valor de cara. El motor determinístico (`DiceEngine.ts`) es la fuente de verdad para los resultados — la física es puramente visual.

---

## Stack

| Paquete | Versión | Uso |
|---------|---------|-----|
| `@react-three/rapier` | ^2.1.0 | Física Rapier3D como componentes React |
| `zustand` | ^5.0.0 | Estado global + lectura no-reactiva en `useFrame` |
| `@dimforge/rapier3d-compat` | 0.19.3 | Bindings Rapier (peer dep de @react-three/rapier) |

---

## Tipos (`src/core/types.ts`)

### `GamePhase`
```typescript
export type GamePhase =
  | 'PREVIEW'    // Dados en grilla, sin física
  | 'ROLLING'    // Impulsos aplicados, dados en el aire
  | 'SETTLING'   // Dados rebotando, perdiendo velocidad
  | 'ARRANGING'  // Lerp desde posiciones de física a layout ordenado
  | 'ARRANGED';  // Dados ordenados por cara, acciones disponibles
```

### `RollHistoryEntry`
```typescript
export interface RollHistoryEntry {
  id: string;
  timestamp: number;
  turn: number;
  phase: WarhPhase | null;
  diceCount: number;
  values: number[];
  color: DieColor;
  seed: string;
  isReroll: boolean;
  /** Etiqueta para eventos no-roll (del, roll≤N, lethal, sus, undo) */
  actionLabel?: string;
}
```

`actionLabel` usa los prefijos:
- `⊘ del ≤N` — dados eliminados
- `↺ roll ≤N` — re-tirada
- `☠ lethal ×N (cara)` / `☠ lethal off (cara)` — toggle lethal
- `✦ sus ×N en cara (+extra)` — sustained hits
- `↩ regresar` — deshacer

---

## Constantes de física (`src/physics/constants.ts`)

```typescript
export const PHYSICS_CONFIG = {
  gravity: [0, -50, 0],           // Gravedad fuerte para caída rápida
  restitution: 0.3,               // Rebote moderado
  friction: 0.7,
  linearDamping: 0.5,             // Alto para frenar rápido con muchos dados
  angularDamping: 0.55,           // Alto para evitar giro infinito
  settleLinvelThreshold: 0.08,
  settleAngvelThreshold: 0.1,
  settleTimeoutSeconds: 9,        // Fuerza settle si excede este tiempo
  settleFrameCount: 15,           // Frames consecutivos settled antes de avanzar
  arrangeSpeed: 2.5,              // Progreso arrange por segundo
  throwHeightMin: 6,
  throwHeightMax: 10,
  impulseVerticalMin: 8,
  impulseVerticalMax: 15,
  impulseHorizontalRange: 5,
  torqueRange: 15,
  boardWidth: 22,
  boardDepth: 16,
  wallHeight: 8,
}
```

---

## Escala de dados (`computeScale`)

```typescript
// src/core/ArrangeLayout.ts y src/components/DiceScene.tsx
function computeScale(n: number): number {
  return Math.max(0.4, Math.min(0.85, 5.5 / Math.sqrt(Math.max(1, n))));
}
```

| Dados | Escala aprox |
|-------|-------------|
| 1–9   | 0.85 (máx) |
| 25    | 0.85        |
| 49    | 0.85        |
| 81    | 0.61        |
| 100   | 0.55        |
| 120   | 0.50        |

---

## Zustand Store (`src/store/diceStore.ts`)

### Estado completo

```typescript
interface DiceState {
  count: number;
  phase: GamePhase;
  rollResult: DiceRollResult | null;
  dieColor: DieColor;
  activeMask: boolean[] | null;
  lethalMask: boolean[] | null;
  history: RollHistoryEntry[];
  currentTurn: number;
  currentPhase: WarhPhase | null;
  sustainedX: SustainedX;
  undoStack: UndoSnapshot[];      // hasta 10 snapshots
  throwParams: ThrowParams[] | null;
  arrangeTargets: Map<number, ArrangeTarget> | null;
  arrangeProgress: number;        // 0→1
}

interface UndoSnapshot {
  rollResult: DiceRollResult | null;
  activeMask: boolean[] | null;
  lethalMask: boolean[] | null;
  count: number;
}
```

### Transiciones de fase (actualizadas)

```
Acción                  │ Fase actual   │ Fase siguiente │ Notas
──────────────────────────────────────────────────────────────────────────────
addCount(n)             │ cualquiera    │ PREVIEW        │ Reset
throwDice()             │ cualquiera    │ ROLLING        │ Limpia undoStack
repeatThrow()           │ cualquiera    │ ROLLING        │ Limpia undoStack
(automático 1 frame)    │ ROLLING       │ SETTLING       │ Tras aplicar impulsos
(automático, settled)   │ SETTLING      │ ARRANGING      │ Todos settled O timeout
(automático, t=1)       │ ARRANGING     │ ARRANGED       │
deleteFace(v)           │ ARRANGED      │ ARRANGING      │ Elimina dados ≤v, re-layout
rerollFace(v)           │ ARRANGED      │ ARRANGING      │ Re-tira dados ≤v, re-layout (sin física)
toggleLethal(v)         │ ARRANGED      │ ARRANGING      │ Toggle mask, re-layout
sustainedHits(v)        │ ARRANGED      │ ARRANGING      │ Agrega dados extra, re-layout (sin física)
undo()                  │ ARRANGING/    │ ARRANGING      │ Restaura snapshot anterior
                        │ ARRANGED      │   o PREVIEW    │
reset()                 │ cualquiera    │ PREVIEW        │ Todo a cero
```

### Comportamiento de `deleteFace(v)` y `rerollFace(v)` — clave

- **`deleteFace(v)`**: elimina TODOS los dados con valor **≤ v** (no solo = v)
  - Ejemplo: `del 4` borra dados de 1, 2, 3 y 4
  - Guarda undo snapshot antes de mutar
  - Añade entrada al historial con `actionLabel: '⊘ del ≤v'`
  - Recomputa `arrangeTargets` y transiciona a ARRANGING

- **`rerollFace(v)`**: re-tira TODOS los dados no-letales activos con valor **≤ v**
  - Ejemplo: `roll 4` re-tira dados de 1, 2, 3 y 4
  - **Sin animación de física** — actualiza valores y re-arranja directamente
  - Guarda undo snapshot antes de mutar
  - Añade entrada al historial con `actionLabel: '↺ roll ≤v'`

- **`sustainedHits(v)`**: agrega dados extra sin animación de física
  - Los dados nuevos aparecen directamente en el layout ordenado
  - Añade entrada al historial con `actionLabel: '✦ sus ×N en v (+extra)'`

### Undo stack

- Máximo 10 snapshots (últimas 10 acciones mutantes)
- `undoStack` se limpia al hacer `throwDice()` o `repeatThrow()`
- `canUndo = undoStack.length > 0 && phase !== 'ROLLING' && phase !== 'SETTLING'`
- `undo()` registra `'↩ regresar'` en el historial

---

## ArrangeLayout (`src/core/ArrangeLayout.ts`)

### Row wrapping

Las filas con más dados que el ancho de la mesa permita hacen wrap automático:

```typescript
const maxPerRow = Math.max(1, Math.floor((BOARD_W - scale) / colSp));
```

- Si una cara tiene más dados que `maxPerRow`, se crean sub-filas
- Cada sub-fila usa la misma posición z + `rowSp` offset
- Las filas letales también hacen wrap en `LETHAL_ZONE_Z`

### Layout normal

- `zMin = -7.0` (con letales) / `-(BOARD_D/2 - scale)` (sin letales)
- `zMax = 1.5` (con letales) / `+(BOARD_D/2 - scale)` (sin letales)
- Las filas se centran en el espacio disponible

### Layout lethal

- Zona en `z = 6.0`
- Una sola fila (con wrapping si es necesario)
- Quaterniones correctos (cara respectiva hacia arriba)

---

## DiceScene (`src/components/DiceScene.tsx`)

### Estructura de componentes

```
DiceScene
├── Lighting
├── Board (incluye zona lethal si hasAnyLethal)
├── PreviewGrid        — solo en PREVIEW
├── Physics            — solo en ROLLING + SETTLING
│   ├── PhysicsDice    — un RigidBody por dado, con colisión cuboid
│   ├── PhysicsFloor   — suelo fijo
│   └── PhysicsWalls   — 4 paredes fijas
└── ArrangedDice       — solo en ARRANGING + ARRANGED
    ├── instancedMesh (normal)
    └── instancedMesh (lethal, morado)
```

### PhysicsDice — mejoras de spawn

Los dados se crean en las posiciones de `throwParams.startPosition` (no apilados):

```typescript
// Posición inicial = throwParams[i].startPosition o grid de fallback
const initPos = throwParams?.[i]?.startPosition
  ? [sp.x, sp.y, sp.z]
  : [((i % 10) - 4.5) * 1.6, 8 + Math.floor(i / 10) * 1.5, -6];
```

### PhysicsDice — settle con timeout

```typescript
useFrame((_, dt) => {
  if (phase === 'ROLLING' && !throwApplied.current) {
    // Espera a que todos los RigidBody estén registrados
    const allReady = rigidBodies.slice(0, count).every(b => b !== null);
    if (!allReady) return;
    // Aplica impulsos y transiciona a SETTLING
  }

  if (phase === 'SETTLING') {
    settleElapsed += dt;
    // Force-settle si excede PHYSICS_CONFIG.settleTimeoutSeconds (9s)
    if (settleElapsed >= settleTimeoutSeconds) {
      store.onAllDiceSettled();
      return;
    }
    // Comprueba si todos settled por N frames consecutivos
  }
});
```

### ArrangedDice — animación

- `easeOutCubic(t)` para la curva de entrada
- Interpolación posición Y con offset de entrada: `startY = target.y + 2*(1-t)`
- Dos InstancedMesh: normal (color del dado) + lethal (morado `#cc44ff`)

---

## ResultsPanel (`src/components/ResultsPanel.tsx`)

### Nuevos comportamientos

- **Botón Regresar**: `↩ Regresar` — llama `onUndo()`, deshabilitado si `!canUndo`
- **Conteos durante animación**: muestra `···` en lugar de `× N` cuando `busy`
- **Tooltips de botones**: muestran cuántos dados afectará el del/roll (≤ N)
- **Historial**: muestra `actionLabel` si existe, en lugar del título de turno

### Props nuevos
```typescript
onUndo: () => void;
canUndo: boolean;
```

### Estados visuales

| gamePhase | busy | inArranged | Comportamiento |
|-----------|------|------------|----------------|
| PREVIEW   | no   | no         | Sin resultados |
| ROLLING   | sí   | no         | `···`, botones deshabilitados |
| SETTLING  | sí   | no         | `···`, botones deshabilitados |
| ARRANGING | sí   | no         | `···`, botones deshabilitados |
| ARRANGED  | no   | sí         | Resultados completos, botones activos |

---

## Test Cases

### Comportamiento del botón `del`

```
TC-D1: del 3 con dados [1,2,3,4,5,6] → elimina 1,2,3; quedan 4,5,6
TC-D2: del 6 → elimina todos los dados activos
TC-D3: del 1 → solo elimina dados con cara 1
TC-D4: del sobre dados ya eliminados → no cambia nada
TC-D5: del genera entrada en historial con actionLabel '⊘ del ≤v'
TC-D6: del guarda snapshot en undoStack antes de mutar
TC-D7: del transiciona a ARRANGING con nuevos targets
```

### Comportamiento del botón `roll`

```
TC-R1: roll 3 con dados [1,2,3,4,5,6] → re-tira 1,2,3; dados 4,5,6 permanecen
TC-R2: roll ≤v excluye dados letales
TC-R3: roll genera entrada en historial con actionLabel '↺ roll ≤v'
TC-R4: roll NO dispara animación de física (transiciona a ARRANGING directamente)
TC-R5: roll guarda snapshot en undoStack
TC-R6: roll 6 sobre solo letales → no hace nada (rerollable = 0)
```

### Undo

```
TC-U1: undo después de del → restaura activeMask original
TC-U2: undo después de roll → restaura rollResult original
TC-U3: undo después de sus → restaura count y rollResult originales
TC-U4: undo genera entrada '↩ regresar' en historial
TC-U5: undo múltiple — hasta 10 niveles
TC-U6: canUndo = false durante ROLLING/SETTLING
TC-U7: undoStack se limpia al hacer throwDice() o repeatThrow()
```

### Física

```
TC-P1: Dados spawnan en posiciones distribuidas (no apilados en [0,y,-6])
TC-P2: Con 120 dados — todos caen a la mesa (sin timeout de 9s)
TC-P3: Timeout fuerza settle después de 9s aunque haya dados en movimiento
TC-P4: Todos los dados quedan dentro de los límites del tablero
TC-P5: settleFrameCount=15 frames consecutivos de settled antes de ARRANGING
```

### Scale + Layout

```
TC-L1: computeScale(1) = 0.85
TC-L2: computeScale(100) ≈ 0.55
TC-L3: Fila con >maxPerRow dados → wrap en sub-filas
TC-L4: Dados letales se ubican en z=6 (LETHAL_ZONE_Z)
TC-L5: Todos los dados caben dentro del tablero (BOARD_W=22)
```

### Historial

```
TC-H1: throwDice() → entrada sin actionLabel, isReroll=false
TC-H2: repeatThrow() → entrada sin actionLabel, isReroll=true
TC-H3: deleteFace() → entrada con actionLabel '⊘ del ≤v'
TC-H4: rerollFace() → entrada con actionLabel '↺ roll ≤v'
TC-H5: toggleLethal() → entrada con actionLabel '☠ lethal ×N (v)'
TC-H6: sustainedHits() → entrada con actionLabel '✦ sus ×N en v (+extra)'
TC-H7: undo() → entrada con actionLabel '↩ regresar'
```

---

## Invariants

1. **Determinismo**: `DiceEngine.rollDice(count, seed)` es la fuente de verdad. La física NO determina resultados.
2. **Mask lengths**: `activeMask.length === lethalMask.length === rollResult.count` cuando no son null.
3. **Lethal exclusion**: Dados con `lethalMask[i] === true` no se incluyen en rerolls.
4. **InstancedMesh ≤ 120**: Máximo 120 dados enforced en `addCount` y `sustainedHits`.
5. **No Math.random() en rolls**: Solo `generateSeed()` usa `Math.random()`. Valores via Mulberry32.
6. **SSR boundary**: `WarhammerBoard` importado con `dynamic({ ssr: false })`.
7. **Física = visual**: Si se deshabilita la física, los resultados no cambian.
8. **Phase gating**: Botones de acción solo activos en `ARRANGED`. Throw activo en PREVIEW y ARRANGED.
9. **Interrumpibilidad**: `reset()` y `addCount()` pueden interrumpir cualquier fase.
10. **Undo safety**: Cada acción mutante guarda snapshot ANTES de mutar. Undo restaura state completo.

---

## Arquitectura de archivos

```
src/
  core/
    types.ts              — GamePhase, RollHistoryEntry (+ actionLabel), ThrowParams, ArrangeTarget
    DiceEngine.ts         — RNG Mulberry32, rollDice(), faceUpQuaternion()
    ThrowCalculator.ts    — computeThrowParams() — parámetros de lanzamiento visual
    ArrangeLayout.ts      — computeArrangeTargets() + computeScale() — layout ordenado
    RulesConfig.ts        — Reglas Warhammer (placeholder)

  physics/
    constants.ts          — PHYSICS_CONFIG (gravity, damping, thresholds, timeout)
    settleDetection.ts    — isBodySettled()

  rendering/
    DiceGeometry.ts       — BoxGeometry con UV atlas
    DiceMaterial.ts       — MeshStandardMaterial + DIE_COLOR_MAP

  store/
    diceStore.ts          — Zustand store (estado + acciones + undo)

  components/
    DiceScene.tsx         — Rendering 3D (PreviewGrid, PhysicsDice, ArrangedDice)
    WarhammerBoard.tsx    — Orquestador (Canvas + UIControls + ResultsPanel)
    UIControls.tsx        — Barra superior
    ResultsPanel.tsx      — Panel izquierdo (resultados + historial + Regresar)
```

---

## Decisiones de diseño

### del/roll afectan dados ≤ N (no solo = N)

En Warhammer, `del 4` representa "eliminar los fallos" donde los fallos son 1-4. El comportamiento ≤N es más útil que = N para el flujo de juego real.

### reroll y sustainedHits sin animación de física

Relanzar dados físicos cada vez que el usuario hace `roll` o `sus` rompe el flujo. En su lugar, los valores se actualizan y los dados se re-arrancan directamente vía ARRANGING. Esto es más rápido y más claro visualmente.

### Undo stack en el store (no en React)

El undo está en Zustand porque necesita guardarse antes de cada mutación síncrona. Con useState habría race conditions.

### Timeout de settle (9s)

Algunos dados con baja fricción + alta energía inicial pueden rebotar indefinidamente. El timeout garantiza que la experiencia siempre avanza.

### @react-three/rapier vs @dimforge/rapier3d-compat directo

`@react-three/rapier` provee integración React limpia: `<Physics>`, `<RigidBody>`, refs directas. Evitar gestionar el WASM loop manualmente (que causaba panics en la versión anterior con `world.timestep = dt`).

---

## Out of Scope

- Sonido de dados cayendo/rebotando
- Partículas de impacto
- Multijugador / networking
- Corrección de cara por torque durante SETTLING (se usa snap en ARRANGING)
- Physics LOD
- Replay de animación
- Configuración de física en UI
