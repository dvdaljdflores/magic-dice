# Magic Dice — Análisis Técnico Completo

> Documento generado para uso como contexto base permanente del proyecto.
> Última actualización: 2026-03-05

---

## 1. Descripción del Proyecto

**Magic Dice** es un simulador de dados 3D para Warhammer 40K / AoS (Age of Sigmar). Muestra dados D6 con física realista usando Rapier3D. El resultado de cada tirada es determinístico (calculado por RNG antes de la animación); la física es puramente visual.

Características principales:
- Hasta 120 dados D6 simultáneos
- Física de caída/rebote con Rapier3D (WASM)
- Animaciones: ROLLING → SETTLING → ARRANGING → ARRANGED
- Agrupación de dados por valor de cara en filas
- Mecánicas de Warhammer: Lethal Hits, Sustained Hits, Reroll, Delete
- Historial de tiradas por turno/fase
- 8 colores de dado
- Deshacer hasta 10 acciones (undo stack)
- Responsive: escritorio + móvil
- Animación desactivable (modo instantáneo)

---

## 2. Stack Tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Framework | Next.js (Pages Router) | 16.1.6 |
| UI | React | 19.2.3 |
| Tipado | TypeScript | ^5 |
| 3D Renderer | Three.js + @react-three/fiber | 0.183 / 9.5 |
| Helpers 3D | @react-three/drei | 10.7 |
| Física | @dimforge/rapier3d-compat | 0.19.3 |
| Física React | @react-three/rapier | 2.2.0 |
| Estado global | Zustand | 5.0.11 |

**Config importante:**
- `next.config.ts`: `turbopack: {}` (default Next 16) + fallback webpack para WASM
- `pages/index.tsx`: dynamic import de `WarhammerBoard` con `ssr: false` (obligatorio para WASM + Three.js)
- Canvas posicionado con `style={{ position: 'absolute', top: 68 }}` para dejar espacio al bar de UIControls

---

## 3. Estructura de Archivos

```
magic-dice/
├── pages/
│   └── index.tsx              # Entry point, dynamic import WarhammerBoard (ssr:false)
├── src/
│   ├── components/
│   │   ├── WarhammerBoard.tsx # Orquestador: layout, state reads, Canvas + UI
│   │   ├── DiceScene.tsx      # Escena 3D: preview grid, física, arranged layout
│   │   ├── UIControls.tsx     # Top bar: count presets, colores, throw/repeat/reset
│   │   └── ResultsPanel.tsx   # Panel de resultados, acciones, historial
│   ├── core/
│   │   ├── types.ts           # Todos los tipos: GamePhase, DieColor, DiceRollResult, etc.
│   │   ├── DiceEngine.ts      # RNG Mulberry32, rollDice(), faceUpQuaternion()
│   │   ├── ArrangeLayout.ts   # computeArrangeTargets(), computeScale()
│   │   ├── ThrowCalculator.ts # computeThrowParams() — posiciones/impulsos/torques
│   │   └── RulesConfig.ts     # Placeholder: countSuccesses(), countCriticals()
│   ├── physics/
│   │   ├── constants.ts       # PHYSICS_CONFIG: gravedad, damping, umbrales, dimensiones
│   │   └── settleDetection.ts # isBodySettled(): detección de reposo por velocidad
│   ├── rendering/
│   │   ├── DiceGeometry.ts    # BoxGeometry con UVs remapeados al atlas horizontal
│   │   └── DiceMaterial.ts    # Atlas canvas (128px×6), MeshStandardMaterial, DIE_COLOR_MAP
│   └── store/
│       └── diceStore.ts       # Store Zustand centralizado — toda la lógica de negocio
```

---

## 4. Arquitectura por Capas (7 Layers)

```
Layer 7 — Comentarios técnicos (DiceScene.tsx, DiceEngine.ts)
Layer 6 — History + Color Types (types.ts, diceStore.ts)
Layer 5 — Roll Coordinator (lógica en diceStore)
Layer 4 — Rules (RulesConfig.ts — placeholder por implementar)
Layer 3 — Board UX: die scale dinámico, GROUPING row layout (ArrangeLayout.ts)
Layer 2 — State Machine: GamePhase (types.ts), settleDetection, physics/constants
Layer 1 — 3D Physics + Dice Engine (DiceScene.tsx, DiceEngine.ts, DiceGeometry, DiceMaterial)
```

---

## 5. Flujo Completo de una Tirada

```
Usuario presiona THROW
        │
        ▼
diceStore.throwDice()
  ├── generateSeed()         → seed único por tirada
  ├── rollDice(count, seed)  → valores 1-6 + quaternions objetivo (determinístico)
  ├── computeThrowParams()   → posiciones iniciales + impulsos + torques (física visual)
  └── setState({ phase: 'ROLLING', throwParams, rollResult })
        │
        ▼
DiceScene — PhysicsDice.useFrame() detecta ROLLING
  ├── Espera a que todos los RigidBody refs estén registrados
  ├── Aplica faceUpQuaternion inicial a cada dado (cara correcta visible desde el inicio)
  ├── Aplica impulsos/torques con throwParams
  └── setState({ phase: 'SETTLING' })
        │
        ▼
DiceScene — SETTLING
  ├── Cada frame: pre-settle snap (linSpd < 0.5 && angSpd < 1.5 → snap exacto)
  ├── Detecta reposo: settleFrameCount=12 frames consecutivos o timeout 5s
  └── Llama onAllDiceSettled()
        │
        ▼
diceStore.onAllDiceSettled()
  ├── computeArrangeTargets() → Map<dieIndex, {position, quaternion}>
  └── setState({ phase: 'ARRANGING', arrangeTargets, arrangeProgress: 0 })
        │
        ▼
DiceScene — ArrangedDice.useFrame() — tickArrangeAnimation(delta)
  ├── arrangeProgress += delta × arrangeSpeed (2.5/s) → lerp ~0.4s
  ├── Interpola posición (easeOutCubic) + quaternion (slerp) por dado
  └── arrangeProgress >= 1 → setState({ phase: 'ARRANGED' })
        │
        ▼
ARRANGED — Acciones disponibles: delete, reroll, lethal, sus, undo
```

---

## 6. GamePhase (Máquina de Estados)

```typescript
type GamePhase =
  | 'PREVIEW'    // Dados en grid estático, no tirados
  | 'ROLLING'    // Impulsos aplicados, dados en el aire
  | 'SETTLING'   // Dados rebotando, perdiendo velocidad
  | 'ARRANGING'  // Lerp animado hacia layout ordenado (0.4s)
  | 'ARRANGED';  // Estado final, acciones disponibles
```

**Transiciones:**
- `PREVIEW → ROLLING`: throwDice() con animEnabled=true
- `PREVIEW → ARRANGED`: throwDice() con animEnabled=false (skip física)
- `ROLLING → SETTLING`: PhysicsDice detecta todos los RigidBody listos
- `SETTLING → ARRANGING`: onAllDiceSettled() (o timeout 5s)
- `ARRANGING → ARRANGED`: tickArrangeAnimation() llega a progress=1
- Acciones (del/roll/let/sus/undo) → `ARRANGED` inmediatamente (no hay drop animation)

---

## 7. DiceEngine.ts — Motor Matemático

### RNG: Mulberry32
```typescript
function mulberry32(seed: number) { /* xorshift... */ }
function hashString(str: string): number { /* FNV-1a 32-bit */ }
```

### Funciones principales
| Función | Descripción |
|---------|-------------|
| `rollDice(count, seed)` | Genera N valores 1-6 + N quaternions objetivo |
| `rollSpecificDice(existing, indices, seed)` | Re-tira solo los índices dados |
| `addDice(existing, count, seed)` | Agrega N dados nuevos a un resultado existente |
| `faceUpQuaternion(face)` | Quaternion exacto para que la cara N quede arriba |
| `generateSeed()` | `wh40k-${Date.now()}-${random}` |
| `PREVIEW_QUATERNION` | Rx(π) → cara 6 visible desde arriba en PREVIEW |

### Mapa Cara → Quaternión
```
Cara 1: identity          (+Y world = face 1 normal)
Cara 2: Rx(-90°)          (+Z → +Y)
Cara 3: Rz(+90°)          (+X → +Y)
Cara 4: Rz(-90°)          (-X → +Y)
Cara 5: Rx(+90°)          (-Z → +Y)
Cara 6: Rx(180°)          (-Y → +Y)
PREVIEW: Rx(180°)         Cara 6 arriba
```

---

## 8. Física (Rapier3D + @react-three/rapier)

### Constantes (physics/constants.ts)
```typescript
gravity:                [0, -50, 0]   // fuerte para caídas rápidas
restitution:            0.12          // rebote moderado
friction:               0.7
linearDamping:          0.85          // amortiguación alta
angularDamping:         0.88
settleLinvelThreshold:  0.08
settleAngvelThreshold:  0.1
settleTimeoutSeconds:   5             // force-settle
settleFrameCount:       12            // frames consecutivos en reposo
arrangeSpeed:           2.5           // progress/segundo en ARRANGING
throwHeightMin/Max:     2-5           // altura inicial (Y)
impulseVerticalMin/Max: 5-10
impulseHorizontalRange: 1.5
torqueRange:            12            // eje Y dominante, X/Z al 25%
boardWidth:             22
boardDepth:             16
wallHeight:             20
```

### Estructura de la escena (DiceScene)
- **Board**: `meshStandardMaterial color="#c9a87c"` (madera clara), 22×0.12×16 unidades
- **Frame**: 4 barras de madera oscura `#7a5230` bordeando el tablero
- **Lethal Zone**: strip `#3a0010` visible solo si hay dados letales, en z=6.0
- **PhysicsFloor** y **PhysicsWalls**: CuboidColliders invisibles que contienen los dados
- **PreviewGrid**: InstancedMesh, grid centrada, sin física
- **PhysicsDice**: N RigidBody dinámicos (o fixed para locked dice)
- **ArrangedDice**: 3 InstancedMeshes (normal / lethal gold / sustained teal)

### Lógica de settle + pre-snap (DiceScene.tsx)
En SETTLING, para cada dado no bloqueado:
1. Si `linSpd < 0.5 && angSpd < 1.5 && body.y < s×1.5`: snap exacto a `faceUpQuaternion(value)` + zeroing angular velocity
2. Detección de reposo: 12 frames consecutivos con linvel < 0.08 y angvel < 0.1

---

## 9. ArrangeLayout — Layout de Dados Ordenados

### computeArrangeTargets(values, activeMask, lethalMask, scale, hasLethal)
- Agrupa dados activos por valor de cara en `normalGroups` y `lethalGroups`
- **Dados normales**: una fila Z por valor (1-6), max 10 por slot horizontal, Y-stacking para más
- **Dados letales**: fila centrada en z=6.0 (zona letal del tablero)
- Espaciado: `colSp = scale × 1.35`, `rowSp = scale × 2.0`
- Primera columna x: `-(BOARD_W/2) + LABEL_SPACE + scale/2` (espacio para etiquetas)

### computeScale(n)
```typescript
Math.max(0.4, Math.min(0.85, 5.5 / Math.sqrt(Math.max(1, n))))
// n=1  → 0.85  (tamaño máximo)
// n=40 → ~0.87 → clamped 0.85
// n=120→ 0.50
```

---

## 10. Rendering — DiceGeometry + DiceMaterial

### DiceGeometry.ts
- `BoxGeometry(1,1,1)` con UVs remapeados
- Atlas horizontal de 6 celdas (1 cara por celda)
- `FACE_TO_COL = [2, 3, 0, 5, 1, 4]` (BoxGeometry face order: +X,-X,+Y,-Y,+Z,-Z)
- Cada cara ocupa 4 vertices × 2 UV coords

### DiceMaterial.ts
- Atlas canvas: 768×128px (6 celdas de 128×128)
- Fondo `#ebebeb` (near-white, multiplica por vertexColor sin afectar el tono)
- Pips `#1a1a1a` (siempre oscuros independientemente del color del dado)
- `MeshStandardMaterial { roughness: 0.45, metalness: 0.05 }`
- No usa `vertexColors: true` — el color se aplica directamente a `mat.color` por `instanceColor` o con `DIE_COLOR_MAP`

### DIE_COLOR_MAP
```typescript
white:  (0.95, 0.95, 0.95)
red:    (0.92, 0.22, 0.22)
blue:   (0.22, 0.35, 0.95)
green:  (0.15, 0.85, 0.25)
yellow: (0.95, 0.88, 0.10)
orange: (0.95, 0.48, 0.08)
purple: (0.60, 0.15, 0.90)
black:  (0.12, 0.12, 0.14)
```

### 3 InstancedMeshes en ARRANGED
1. **Normal** `mat`: color = `DIE_COLOR_MAP[dieColor]`
2. **Lethal** `lethalMat`: color fijo dorado (0.92, 0.68, 0.02)
3. **Sustained** `sustainedMat`: color fijo teal (0.0, 0.88, 0.95)

---

## 11. Store Zustand (diceStore.ts)

### Estado completo
```typescript
count: number              // dados en mesa (0-120)
phase: GamePhase
rollResult: DiceRollResult | null
dieColor: DieColor
activeMask: boolean[] | null    // dado activo/eliminado por índice
lethalMask: boolean[] | null    // dado marcado como lethal
sustainedMask: boolean[] | null // dado agregado por sustained hits
history: RollHistoryEntry[]
currentTurn: number (1-5)
currentPhase: WarhPhase | null
sustainedX: SustainedX (1|2|3)
undoStack: UndoSnapshot[]       // máx 10 snapshots
throwParams: ThrowParams[] | null
arrangeTargets: Map<number, ArrangeTarget> | null
arrangeProgress: number (0-1)
lockedTargets: Map<number, ArrangeTarget> | null  // dados que no se mueven
animEnabled: boolean            // false = skip física, ARRANGED instantáneo
```

### Acciones principales
| Acción | Efecto |
|--------|--------|
| `addCount(n)` | Suma N dados; en ARRANGED lanza solo los nuevos (lockedTargets) |
| `throwDice()` | Tira todos (o solo non-lethal si hay lethal locked); genera seed |
| `repeatThrow()` | Vuelve a tirar misma cantidad, seed nueva, limpia lethal |
| `deleteFace(v)` | Desactiva todos los dados con cara ≤ v (push undo, ARRANGED directo) |
| `rerollFace(v)` | Re-tira non-lethal activos con cara ≤ v (push undo, ARRANGED directo) |
| `toggleLethal(v)` | Toggle lethal en grupo con cara = v (push undo, ARRANGED directo) |
| `sustainedHits(v)` | Agrega sustainedX × count(cara=v) dados nuevos (push undo, ARRANGED) |
| `undo()` | Restaura snapshot anterior del undoStack |
| `reset()` | Limpia todo → PREVIEW, count=0 |
| `onAllDiceSettled()` | Llamado por DiceScene → computeArrangeTargets + ARRANGING |
| `tickArrangeAnimation(dt)` | Llamado por DiceScene.useFrame → incrementa arrangeProgress |

**Nota crítica:** Acciones de juego (del/roll/let/sus/undo) van directamente a ARRANGED con `arrangeProgress=1` (sin animación de caída). El drop animation (`arrangeProgress 0→1`) es exclusivo de la transición física SETTLING→ARRANGING.

---

## 12. Componentes UI

### WarhammerBoard.tsx
Orquestador principal. Maneja:
- Detección mobile (`window.innerWidth < 768`)
- Canvas positioning: desktop `{top:72, left:240}`, mobile `{top:60, left:0, right:0, bottom:0}`
- **No hay rotación CSS** (ningún `transform: rotate`)
- OrbitControls: `enablePan:false`, `minPolarAngle:0.25`, `maxPolarAngle:PI/2.1`, `minDistance:8`, `maxDistance:38`
- Camera: `position:[0,18,15], fov:40`
- Pasa todas las props a UIControls y ResultsPanel desde el store

### UIControls.tsx
Top bar (72px desktop / 60px mobile). Contiene:
- Presets de conteo: +1, +5, +10, +20 dados
- Selector de color: 8 swatches
- Botones Throw / Repeat / Reset
- Dropdowns Turn (1-5) y Phase (DISPARO/CARGA/COMBATE/MORAL)
- Toggle animación (⚡ icon)
- Bloqueo de cámara (desktop)
- En mobile: dropdowns como overlay `position:fixed, top:60, full-width, z:200`

### ResultsPanel.tsx

**Desktop** (panel izquierdo fijo, 240px):
- Lista de caras 1-6 con conteo (solo activos)
- Por cada grupo: botones DEL / ROLL / SUS× / LET
- Sección SUS×: stepper 1-3
- Undo button + historial expandible
- Solo visible en ARRANGED

**Mobile** (overlay sobre canvas, 3 capas):
1. **Action strip** (flotante derecha, top = mobileBarH+8): botones DEL/R/S/L por grupo
2. **Toggle chip** (bottom center, bottom:20): muestra total, abre/cierra sheet
3. **Collapsible sheet** (bottom:0, maxHeight:55vh): conteos + SUS× stepper + Undo

Auto-abre el sheet cuando `gamePhase === 'ARRANGED'` (via useEffect).

---

## 13. Mecánicas de Warhammer Implementadas

### Lethal Hits
- Botón LET por grupo de cara
- Dados letales se separan visualmente (color dorado) en zona especial (z=6.0)
- Al re-tirar (Throw), los dados letales quedan bloqueados (`lockedTargets`) y solo caen los no-letales
- `toggleLethal(v)` en store: alterna todos los dados con cara = v entre lethal/normal

### Sustained Hits (Golpes Sostenidos)
- Botón SUS con multiplicador ×1, ×2, o ×3 (configurable con stepper)
- `sustainedHits(v)`: cuenta cuántos dados activos no-letales muestran cara = v, agrega `count × sustainedX` dados nuevos
- Dados agregados por Sustained aparecen en teal
- Límite: máx 120 dados totales

### Delete Face
- `deleteFace(v)`: elimina todos los dados activos con cara ≤ v
- Inmediato (sin animación de caída)

### Reroll Face
- `rerollFace(v)`: re-tira todos los dados activos no-letales con cara ≤ v
- Usa `rollSpecificDice()` con nueva seed
- Inmediato (sin animación de caída)

### Undo
- Stack de hasta 10 snapshots (`undoStack`)
- Cada acción de juego (del/roll/let/sus) hace push antes de mutar
- `undo()`: restaura el último snapshot, va directo a ARRANGED o PREVIEW

---

## 14. Historia de Tiradas

Cada evento registra:
```typescript
interface RollHistoryEntry {
  id: string;
  timestamp: number;
  turn: number;
  phase: WarhPhase | null;
  diceCount: number;
  values: number[];
  color: DieColor;
  seed: string;
  isReroll: boolean;
  actionLabel?: string;  // ej: "⊘ del ≤3", "↺ roll ≤2", "☠ lethal ×4", "✦ sus ×1 en 6"
}
```

Se registra un entry por cada: throwDice, repeatThrow, deleteFace, rerollFace, toggleLethal, sustainedHits, undo.

---

## 15. ThrowCalculator — Parámetros de Lanzamiento

`computeThrowParams(count, seed)` calcula:
- **Posición inicial**: arco sobre el tablero, detrás del centro (z=-8 a -5)
- **Impulso**: hacia adelante (z: 2-8) + vertical (y: 5-10) + dispersión lateral (x: ±1.5)
- **Torque**: eje Y dominante (±12) + X/Z al 25% del rango para wobble visual

**Nota importante**: Los dados se inicializan con `faceUpQuaternion(value)` ANTES de aplicar torques. El torque en Y (yaw) no cambia qué cara está arriba, solo la rotación horizontal. Esto garantiza que la cara correcta sea visible durante toda la animación.

---

## 16. Notas TypeScript Críticas

1. **Float32Array en TS5**: Es genérico (`Float32Array<ArrayBufferLike>`). Para evitar errores, usar:
   ```typescript
   // En tipos propios, usar el non-generic:
   targetQuaternions: Float32Array  // (usa ArrayBufferLike por defecto en TS4 compat)
   ```

2. **Reads no-reactivos en useFrame**: Usar `useDiceStore.getState()` (no `useStore(s => s.x)`) dentro de `useFrame` para evitar re-renders por frame.

3. **Style objects**: Funciones de estilo definidas fuera del objeto `styles` para evitar conflictos de tipo con valores calculados.

4. **Server-side rendering**: Todo el código Three.js/Rapier debe estar bajo `ssr: false`. `pages/index.tsx` usa `dynamic()` para esto.

---

## 17. Configuración Next.js (next.config.ts)

```typescript
const nextConfig: NextConfig = {
  turbopack: {},  // Next 16 default
  webpack(config) {
    config.experiments = { ...config.experiments, asyncWebAssembly: true, layers: true };
    return config;
  },
};
```

El fallback webpack con `asyncWebAssembly: true` es necesario para que Rapier3D WASM funcione en producción.

---

## 18. Flujos Especiales

### addCount en ARRANGED (agregar dados sin re-tirar todos)
1. Crea `lockedTargets` = copia de `arrangeTargets` actuales
2. Llama `addDice()` para ampliar el resultado (mismas caras existentes + nuevas)
3. `throwParams` solo para los dados nuevos (índices `count` a `count+extra-1`)
4. Dados viejos quedan como RigidBody `type="fixed"` (no se mueven)
5. Solo los nuevos caen con física

### throwDice con Lethal Locks
1. Si `lethalMask.some(Boolean)` y hay `arrangeTargets`:
   - `lockedTargets` = solo posiciones de dados letales
   - `rollSpecificDice()` para los índices no-letales
2. Dados letales quedan fixed; solo los no-letales caen

### animEnabled = false
Todas las acciones que normalmente van a ROLLING van directamente a ARRANGED:
- Se calculan `arrangeTargets` inmediatamente
- Se setea `arrangeProgress = 1`
- Sin RigidBody, sin Physics wrapper

---

## 19. Lo Que NO Debe Romperse

1. **Seed determinismo**: Mismo seed + count = mismos valores siempre
2. **Pre-settle snap**: La rotación exacta antes de ARRANGING (elimina pop visual)
3. **lockedTargets**: Dados letales/existentes no se mueven al agregar nuevos
4. **arrangeProgress = 1 directo**: Acciones de juego NUNCA deben activar drop animation
5. **ssr: false**: Sin esto, Three.js/Rapier fallan en build
6. **No CSS rotation**: El canvas nunca usa `transform: rotate()`, en ningún dispositivo
7. **Máx 120 dados**: Límite en todos los paths que agregan dados

---

## 20. Trabajo Pendiente (RulesConfig.ts)

```typescript
// TODO: Implementar por ruleset de Warhammer
export function countSuccesses(results, config): number { /* placeholder */ }
export function countCriticals(results, config): number { /* placeholder */ }
// Falta: computeHits, computeWounds, computeSaves
```

Los valores están disponibles en `rollResult.values` + `activeMask` + `lethalMask` para su implementación futura.
