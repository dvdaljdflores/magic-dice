# magic-dice — Documentación Técnica de Layout (debug móvil)

> Generado desde código fuente actual (`git log`: `b3fb562`).
> Todas las rutas son relativas a `/src/` salvo que se indique lo contrario.

---

## 1. Arquitectura del proyecto

### Árbol completo de carpetas (`src/`)

```
src/
├── components/
│   ├── DiceScene.tsx        ← render 3D (Three.js + Rapier)
│   ├── WarhammerBoard.tsx   ← orquestador, Canvas, OrbitControls
│   ├── UIControls.tsx       ← barra superior (UI pura)
│   └── ResultsPanel.tsx     ← panel izquierdo / sheet móvil (UI pura)
├── core/
│   ├── ArrangeLayout.ts     ← cálculo de posiciones ARRANGED
│   ├── DiceEngine.ts        ← RNG, rollDice(), quaterniones por cara
│   ├── RulesConfig.ts       ← placeholder conteo éxitos/críticos
│   ├── ThrowCalculator.ts   ← parámetros de lanzamiento (impulso, torque)
│   └── types.ts             ← todos los tipos del proyecto
├── physics/
│   ├── constants.ts         ← PHYSICS_CONFIG (boardWidth, boardDepth, etc.)
│   └── settleDetection.ts   ← isBodySettled()
├── rendering/
│   ├── DiceGeometry.ts      ← BoxGeometry + remap UV atlas
│   └── DiceMaterial.ts      ← MeshStandardMaterial, canvas atlas, DIE_COLOR_MAP
└── store/
    └── diceStore.ts         ← Zustand store (estado central)

pages/
└── index.tsx                ← entry point Next.js (dynamic import, ssr: false)
```

### Responsabilidades por subsistema

| Subsistema | Archivos responsables |
|---|---|
| Render 3D | `DiceScene.tsx`, `DiceGeometry.ts`, `DiceMaterial.ts` |
| Física | `DiceScene.tsx` (PhysicsDice, PhysicsFloor, PhysicsWalls), `physics/constants.ts`, `physics/settleDetection.ts` |
| Layout UI (HTML) | `WarhammerBoard.tsx`, `UIControls.tsx`, `ResultsPanel.tsx` |
| Layout dados (3D) | `ArrangeLayout.ts`, `diceStore.ts` (computa targets), `DiceScene.tsx` (los aplica) |
| Estado global | `store/diceStore.ts` |
| Cámara | `WarhammerBoard.tsx` (Canvas `camera={}`, OrbitControls) |

---

## 2. Sistema de tablero (Board System)

### Todas las definiciones de `boardWidth` / `boardDepth` / `BOARD_W` / `BOARD_D`

#### `src/physics/constants.ts` — fuente primaria
```ts
export const PHYSICS_CONFIG = {
  boardWidth: 22,   // ← ancho desktop
  boardDepth: 16,   // ← profundidad desktop
  wallHeight: 20,
  ...
} as const;
```
> **Rol**: define las dimensiones de las paredes y el suelo físico (Rapier).
> Es una constante inmutable en tiempo de compilación.

---

#### `src/components/DiceScene.tsx` — dimensiones 3D de tablero y física
```ts
const BOARD_W_DESKTOP = PHYSICS_CONFIG.boardWidth;  // 22
const BOARD_D_DESKTOP = PHYSICS_CONFIG.boardDepth;  // 16

const BOARD_W_MOBILE  = 16;
const BOARD_D_MOBILE  = 22;

let _mobileMode = false;

export function setMobileLayoutMode(v: boolean) {
  _mobileMode = v;
}

function getBoardWidth() { return _mobileMode ? BOARD_W_MOBILE : BOARD_W_DESKTOP; }
function getBoardDepth() { return _mobileMode ? BOARD_D_MOBILE : BOARD_D_DESKTOP; }

// ⚠️ BUG POTENCIAL — ver sección 9
const BOARD_W = getBoardWidth();  // evaluado en tiempo de módulo, NO reactivo
const BOARD_D = getBoardDepth();  // ídem
```
> **Rol**: controla la geometría visual del tablero (mesa de madera) y los colisores de paredes/suelo.
> `BOARD_W` y `BOARD_D` son constantes de módulo: se evalúan **una sola vez** al importar el módulo.

---

#### `src/core/ArrangeLayout.ts` — posiciones de filas de dados
```ts
const BOARD_W       = 22;   // desktop
const BOARD_D       = 16;   // desktop
const BOARD_W_M     = 16;   // mobile
const BOARD_D_M     = 22;   // mobile

const NORMAL_Z_MIN  = -7.0;
const NORMAL_Z_MAX  =  1.5;
const NORMAL_Z_MIN_M = -10.0;
const NORMAL_Z_MAX_M =   3.0;

const MAX_PER_STACK_DESKTOP = 10;
const MAX_PER_STACK_MOBILE  = 6;

let _mobileMode = false;

export function setMobileLayoutMode(mobile: boolean): void {
  _mobileMode = mobile;
}

// En computeArrangeTargets():
const boardW = _mobileMode ? BOARD_W_M : BOARD_W;
const boardD = _mobileMode ? BOARD_D_M : BOARD_D;
const maxPerStack = _mobileMode ? MAX_PER_STACK_MOBILE : MAX_PER_STACK_DESKTOP;
```
> **Rol**: determina las posiciones X/Y/Z finales de cada dado en ARRANGED.
> `_mobileMode` se lee **en tiempo de ejecución** dentro de `computeArrangeTargets` → es reactivo.

---

### Prioridad / quién manda

```
physics/constants.ts
    └── alimenta DiceScene.tsx (paredes físicas, suelo)
    └── alimenta ThrowCalculator.ts (spreadX de lanzamiento)

ArrangeLayout.ts  ←  setMobileLayoutMode() desde WarhammerBoard
    └── alimenta diceStore.ts (computeArrangeTargets)
    └── diceStore.ts → arrangeTargets → DiceScene (ArrangedDice)
```

**Las posiciones finales en pantalla las determina `ArrangeLayout.ts`**, no `DiceScene.tsx`.
`DiceScene.tsx` solo lee `arrangeTargets` del store y aplica las matrices.

---

## 3. Sistema de cámara

### `src/components/WarhammerBoard.tsx` — única fuente de cámara

```tsx
<Canvas
  shadows
  camera={{
    position: isMobile ? [0, 11, 9] : [0, 18, 15],
    fov:      isMobile ? 60         : 40,
    near: 0.5,
    far:  85,
  }}
  gl={{ antialias: true, powerPreference: 'high-performance' }}
  dpr={[1, 2]}
  style={canvasStyle}
>
```

```tsx
<OrbitControls
  enabled={!cameraLocked}
  enablePan={false}
  minPolarAngle={isMobile ? 0.9  : 0.25}
  maxPolarAngle={isMobile ? 1.35 : Math.PI / 2.1}
  minDistance={isMobile  ? 5    : 8}
  maxDistance={isMobile  ? 22   : 38}
  target={isMobile ? [0, 0, -8] : [0, 0, 0]}
/>
```

### ¿Algún componente hijo modifica la cámara?

No. Ningún componente dentro de `DiceScene.tsx` usa `useThree`, `camera.lookAt`, ni modifica la cámara.
`useFrame` en `ArrangedDice` y `PhysicsDice` solo actualiza matrices de instancias (`InstancedMesh`).

### ⚠️ Comportamiento del prop `camera={}` en R3F

El prop `camera={}` en `<Canvas>` **solo se lee en el montaje inicial**. Si `isMobile` cambia después del montaje (resize de ventana en desktop), la cámara NO se actualiza.

La versión anterior del código tenía `key={isMobile ? 'mobile' : 'desktop'}` en `<Canvas>` para forzar un remontaje al cruzar el breakpoint. **Esa key fue eliminada en el commit `862cb57`**. Sin ella, en desktop al reducir la ventana la cámara no se reajusta. En dispositivos móviles reales esto no es un problema (no hay resize).

---

## 4. Sistema de layout de dados

### Flujo de interacción

```
WarhammerBoard
    │
    ├── llama setMobileLayoutMode(isMobile)     [ArrangeLayout.ts]
    │
    └── llama throwDice() / deleteFace() / etc. [diceStore.ts]
                │
                └── computeArrangeTargets(values, activeMask, lethalMask, scale, hasLethal)
                            │                [ArrangeLayout.ts]
                            │
                            └── retorna Map<dieIdx, ArrangeTarget>
                                    { position: [x,y,z], quaternion: [x,y,z,w] }
                                            │
                                            └── guardado en store.arrangeTargets
                                                        │
                                                        └── DiceScene > ArrangedDice
                                                            lee store.arrangeTargets en useFrame
                                                            aplica matrix a InstancedMesh
```

### Qué determina la posición final

| Variable | Quién la calcula | Dónde se aplica |
|---|---|---|
| `leftX` | `ArrangeLayout.ts` | posición X del primer dado de cada fila |
| `z` por fila | `ArrangeLayout.ts` (zMin + espaciado rowSp) | posición Z de cada fila |
| `col * colSp` | `ArrangeLayout.ts` | posición X de cada dado dentro de la fila |
| `stackIdx * stackH` | `ArrangeLayout.ts` | altura Y si hay más de `maxPerStack` dados |
| `LETHAL_ZONE_Z = 6.0` | `DiceScene.tsx` (hardcoded) | zona lethal en Z=6 |
| `computeScale(n)` | `DiceScene.tsx` Y `diceStore.ts` | escala de cada dado |

> **Nota**: `computeScale` está duplicado — existe en `DiceScene.tsx` (línea 63) y se usa también en `diceStore.ts` importándolo de `ArrangeLayout.ts`. Ambas implementaciones son idénticas.

---

## 5. Sistema de viewport / mobile detection

### Todos los lugares donde se detecta `isMobile`

#### `src/components/WarhammerBoard.tsx` — fuente de verdad
```ts
const [isMobile, setIsMobile] = useState(false);

useEffect(() => {
  const check = () => setIsMobile(window.innerWidth < 768);
  check();
  window.addEventListener('resize', check);
  return () => window.removeEventListener('resize', check);
}, []);
```
> Breakpoint: `window.innerWidth < 768`. Se actualiza en cada resize.

#### Propagación de `isMobile`
```
WarhammerBoard
    ├── setMobileLayoutMode(isMobile)  → ArrangeLayout.ts (vía useEffect)
    ├── setMobileLayoutMode(isMobile)  → DiceScene.tsx (misma función, mismo módulo?)
    │   ⚠️ NO — DiceScene.tsx y ArrangeLayout.ts tienen flags _mobileMode SEPARADOS
    ├── prop isMobile → UIControls
    └── prop isMobile → ResultsPanel
```

#### Usos de `isMobile` en `WarhammerBoard.tsx`
| Uso | Valor mobile | Valor desktop |
|---|---|---|
| `canvasStyle.top` | `MOBILE_BAR_H` (60px) | `TOP_BAR_H` (72px) |
| `canvasStyle.left` | `0` | `LEFT_W` (240px) |
| `camera.position` | `[0, 11, 9]` | `[0, 18, 15]` |
| `camera.fov` | `60` | `40` |
| `OrbitControls.minPolarAngle` | `0.9` | `0.25` |
| `OrbitControls.maxPolarAngle` | `1.35` | `Math.PI/2.1` |
| `OrbitControls.minDistance` | `5` | `8` |
| `OrbitControls.maxDistance` | `22` | `38` |
| `OrbitControls.target` | `[0, 0, -8]` | `[0, 0, 0]` |

#### `src/components/UIControls.tsx` y `ResultsPanel.tsx`
Reciben `isMobile` como prop. Lo usan para:
- Cambiar estilos CSS (dropdowns, botones, sheet overlay)
- Mostrar/ocultar elementos de UI según modo

---

## 6. Flujo completo de render

### Al cargar la escena (`PREVIEW`)
```
1. pages/index.tsx       → dynamic import WarhammerBoard (ssr: false)
2. WarhammerBoard        → monta <Canvas camera={...}> con posición inicial
3. WarhammerBoard        → monta OrbitControls con target=[0,0,-8] (mobile) o [0,0,0]
4. WarhammerBoard        → renderiza DiceScene con gamePhase='PREVIEW', count=0
5. DiceScene             → renderiza <Lighting /> + <Board />
6. DiceScene             → gamePhase='PREVIEW' → renderiza <PreviewGrid count=0 />
7. PreviewGrid           → count=0 → todas las matrices = _zero (dados invisibles)
```

### Al tirar dados (`ROLLING → SETTLING → ARRANGING → ARRANGED`)
```
1. Usuario pulsa "Throw"
2. UIControls.onThrow()  → diceStore.throwDice()
3. diceStore.throwDice()
   a. rollDice(count, seed)          → DiceRollResult {values, targetQuaternions}
   b. computeThrowParams(count, seed) → ThrowParams[] {startPosition, impulse, torque}
   c. set({ phase:'ROLLING', throwParams, rollResult, activeMask, ... })

4. WarhammerBoard        → re-render con gamePhase='ROLLING'
5. DiceScene             → isPhysicsPhase=true → monta <Physics> + <PhysicsDice>
6. PhysicsDice.useFrame  → detecta phase='ROLLING' y throwApplied=false
   a. espera allReady (todos los RigidBody refs registrados)
   b. setRotation a faceUpQuaternion(value[i]) para cada dado
   c. setTranslation al startPosition del ThrowParam
   d. applyImpulse + applyTorqueImpulse
   e. useDiceStore.setState({ phase:'SETTLING' })

7. PhysicsDice.useFrame  → cada frame en 'SETTLING'
   a. settleElapsed += dt
   b. snap de rotación cuando linSpd < 0.5 && angSpd < 1.5 (rotSnapped)
   c. isBodySettled() en cada dado
   d. settleFrames++ cuando todos quietos → onAllDiceSettled()
   e. timeout a 5s → fuerza onAllDiceSettled()

8. diceStore.onAllDiceSettled()
   a. computeArrangeTargets(values, activeMask, lethalMask, scale, hasLethal)
      → usa _mobileMode de ArrangeLayout.ts
      → retorna Map<dieIdx, {position, quaternion}>
   b. set({ phase:'ARRANGING', arrangeTargets, arrangeProgress:0 })

9. DiceScene             → gamePhase='ARRANGING' → desmonta Physics, monta ArrangedDice
10. ArrangedDice.useFrame → cada frame
    a. store.tickArrangeAnimation(delta)  → arrangeProgress += delta * 2.5
    b. lee arrangeTargets del store
    c. interpola Y con easeOutCubic(arrangeProgress)
    d. aplica matrix a InstancedMesh (normal / lethal / sustained)
    e. cuando arrangeProgress >= 1 → phase='ARRANGED'

11. phase='ARRANGED'     → acciones disponibles (del, roll, lethal, sus, undo)
```

### Al pasar a `ARRANGED`
```
- ArrangedDice sigue en useFrame pero ya no llama tickArrangeAnimation
- arrangeProgress = 1, t = 1, no hay interpolación
- Matrices son exactamente las de arrangeTargets
- ResultsPanel muestra resultados + botones activos
```

---

## 7. Constantes globales

### Relativas al tablero

| Constante | Valor | Archivo | Uso |
|---|---|---|---|
| `PHYSICS_CONFIG.boardWidth` | `22` | `physics/constants.ts` | paredes físicas, spread de lanzamiento |
| `PHYSICS_CONFIG.boardDepth` | `16` | `physics/constants.ts` | paredes físicas |
| `BOARD_W_DESKTOP` | `22` | `DiceScene.tsx` | tablero visual, colisores |
| `BOARD_D_DESKTOP` | `16` | `DiceScene.tsx` | tablero visual, colisores |
| `BOARD_W_MOBILE` | `16` | `DiceScene.tsx` | tablero visual móvil |
| `BOARD_D_MOBILE` | `22` | `DiceScene.tsx` | tablero visual móvil |
| `BOARD_W` (ArrangeLayout) | `22` | `ArrangeLayout.ts` | layout de filas (desktop) |
| `BOARD_D` (ArrangeLayout) | `16` | `ArrangeLayout.ts` | layout de filas (desktop) |
| `BOARD_W_M` | `16` | `ArrangeLayout.ts` | layout de filas (mobile) |
| `BOARD_D_M` | `22` | `ArrangeLayout.ts` | layout de filas (mobile) |
| `LETHAL_ZONE_Z` | `6.0` | `DiceScene.tsx` y `ArrangeLayout.ts` | zona lethal |
| `LEFT_W` | `240` | `WarhammerBoard.tsx` | ancho panel izquierdo (desktop) |
| `TOP_BAR_H` | `72` | `WarhammerBoard.tsx` | altura barra superior (desktop) |
| `MOBILE_BAR_H` | `60` | `WarhammerBoard.tsx` | altura barra superior (mobile) |

### Relativas a la cámara

| Constante | Valor | Archivo |
|---|---|---|
| `camera.position` (desktop) | `[0, 18, 15]` | `WarhammerBoard.tsx` |
| `camera.position` (mobile) | `[0, 11, 9]` | `WarhammerBoard.tsx` |
| `camera.fov` (desktop) | `40` | `WarhammerBoard.tsx` |
| `camera.fov` (mobile) | `60` | `WarhammerBoard.tsx` |
| `camera.near` | `0.5` | `WarhammerBoard.tsx` |
| `camera.far` | `85` | `WarhammerBoard.tsx` |
| `OrbitControls.target` (desktop) | `[0, 0, 0]` | `WarhammerBoard.tsx` |
| `OrbitControls.target` (mobile) | `[0, 0, -8]` | `WarhammerBoard.tsx` |

### Relativas al spacing de dados

| Constante | Valor | Archivo |
|---|---|---|
| `ROW_SP` | `2.0` | `ArrangeLayout.ts` |
| `COL_SP` | `1.35` | `ArrangeLayout.ts` |
| `LABEL_SPACE` | `2.0` | `ArrangeLayout.ts` |
| `LETHAL_ZONE_Z` | `6.0` | `ArrangeLayout.ts` |
| `NORMAL_Z_MIN` | `-7.0` | `ArrangeLayout.ts` (desktop) |
| `NORMAL_Z_MAX` | `1.5` | `ArrangeLayout.ts` (desktop) |
| `NORMAL_Z_MIN_M` | `-10.0` | `ArrangeLayout.ts` (mobile) |
| `NORMAL_Z_MAX_M` | `3.0` | `ArrangeLayout.ts` (mobile) |
| `MAX_PER_STACK_DESKTOP` | `10` | `ArrangeLayout.ts` |
| `MAX_PER_STACK_MOBILE` | `6` | `ArrangeLayout.ts` |
| `LABEL_X` | `-(BOARD_W/2) + 0.9` | `DiceScene.tsx` (fijo en desktop) |

### Relativas a la escala de dados

```ts
// En DiceScene.tsx y en diceStore.ts (vía ArrangeLayout.ts):
computeScale(n) = clamp(5.5 / sqrt(max(1, n)), 0.4, 0.85)
```
| n | escala |
|---|---|
| 1 | 0.85 |
| 4 | 0.85 |
| 10 | 0.85 |
| 20 | 0.85 |
| 42 | ~0.85 |
| 48 | ~0.79 |
| 100 | ~0.55 |
| 120 | 0.50 |

---

## 8. Dependencias críticas

### `@react-three/fiber`

Provee `<Canvas>` (contexto WebGL + loop de render) y `useFrame` (hook ejecutado cada frame dentro del Canvas).

**Impacto en layout**:
- `<Canvas camera={}>` fija posición/FOV de la cámara en el **montaje**. Cambios posteriores a los props no tienen efecto sobre la cámara activa (solo OrbitControls puede moverla después).
- El estilo CSS del Canvas (`position: absolute, top, left, right, bottom`) define el área de render en el DOM. `WarhammerBoard.tsx` lo calcula con `canvasStyle`.

### `@react-three/rapier`

Provee `<Physics>`, `<RigidBody>`, `<CuboidCollider>`.

**Impacto en layout**:
- Las paredes físicas usan `BOARD_W` y `BOARD_D` de `DiceScene.tsx`. Estas son constantes de módulo (evaluadas al importar), **no reaccionan** a cambios de `_mobileMode` después del montaje.
- La física determina dónde **caen** los dados (ROLLING/SETTLING). Las posiciones finales (ARRANGED) son independientes de la física y las calcula `ArrangeLayout.ts`.

### `zustand`

Centraliza todo el estado del juego.

**Impacto en layout**:
- `diceStore.ts` llama `computeArrangeTargets` (de `ArrangeLayout.ts`) cada vez que cambia el layout de dados.
- El store expone `arrangeTargets: Map<number, ArrangeTarget>` que `DiceScene.tsx` lee en `useFrame` para posicionar dados.
- El store **no almacena** `isMobile`. La detección de móvil vive solo en `WarhammerBoard.tsx` y se propaga como módule-level flag.

---

## 9. Posibles conflictos y bugs

### ⚠️ CONFLICTO 1 — `BOARD_W`/`BOARD_D` en `DiceScene.tsx` son constantes de módulo

```ts
// DiceScene.tsx líneas 52-53
const BOARD_W = getBoardWidth();   // se evalúa UNA VEZ al importar el módulo
const BOARD_D = getBoardDepth();   // ídem
```

`setMobileLayoutMode()` actualiza `_mobileMode` pero `BOARD_W`/`BOARD_D` ya están fijados.
**Consecuencia**: el tablero visual y los colisores de paredes/suelo **siempre** usan las dimensiones desktop (22×16), sin importar el valor de `_mobileMode`.

Las funciones `getBoardWidth()` y `getBoardDepth()` nunca son llamadas de nuevo después del montaje del módulo.

**Contraste con `ArrangeLayout.ts`**: allí `boardW`/`boardD` se leen **dentro** de `computeArrangeTargets` en tiempo de ejecución, por eso sí son reactivas.

---

### ⚠️ CONFLICTO 2 — Dos `setMobileLayoutMode` exportadas, dos flags separados

`DiceScene.tsx` exporta `setMobileLayoutMode(v: boolean)` → actualiza `_mobileMode` en ese módulo.
`ArrangeLayout.ts` exporta `setMobileLayoutMode(mobile: boolean)` → actualiza `_mobileMode` en ese módulo.

`WarhammerBoard.tsx` solo importa y llama la de `ArrangeLayout.ts`:
```ts
import { setMobileLayoutMode } from '../core/ArrangeLayout';
```

**Consecuencia**: el flag `_mobileMode` en `DiceScene.tsx` **nunca se actualiza** desde `WarhammerBoard.tsx`. Siempre permanece `false`.

---

### ⚠️ CONFLICTO 3 — `LABEL_X` en `DiceScene.tsx` usa `BOARD_W` desktop

```ts
const LABEL_X = -(BOARD_W / 2) + 0.9;  // -(22/2) + 0.9 = -10.1 siempre
```

En móvil el tablero visual de `ArrangeLayout.ts` tiene `boardW = 16` pero las etiquetas siguen en X=-10.1, quedando fuera del tablero visual.

---

### ⚠️ CONFLICTO 4 — Cámara no se actualiza en resize

Como se mencionó en la sección 3, el prop `camera={}` de `<Canvas>` se procesa solo al montar.
Sin `key={isMobile ? 'mobile' : 'desktop'}` (eliminado en `862cb57`), si la ventana cruza el breakpoint 768px la cámara no cambia.

---

### ✅ SIN CONFLICTO — `ArrangeLayout.ts` es reactivo

`computeArrangeTargets` lee `_mobileMode` en cada llamada → las posiciones de dados en ARRANGED **sí** usan la geometría correcta para móvil (boardW=16, boardD=22, maxPerStack=6).

---

### Resumen de prioridades reales en producción mobile

| Sistema | ¿Reactivo a isMobile? | Valor real en móvil |
|---|---|---|
| Tablero visual (mesh) | ❌ No | 22×16 (desktop) |
| Colisores físicos | ❌ No | 22×16 (desktop) |
| Layout de filas (ARRANGED) | ✅ Sí | 16×22 (mobile) |
| Cámara (posición/fov) | ⚠️ Solo en montaje | Correcto si el Canvas no estaba montado antes |
| OrbitControls | ✅ Sí (re-render) | Correcto |
| Etiquetas de fila (LABEL_X) | ❌ No | -10.1 (desktop) |
