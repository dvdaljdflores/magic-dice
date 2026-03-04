# Feature: Animación de física de dados con Rapier3D

## Summary

Agregar simulación de física realista al lanzamiento de dados usando Rapier3D. Los dados se lanzan al aire, giran, caen sobre la mesa, rebotan y se asientan naturalmente. Después del asentamiento, se animan suavemente hacia sus posiciones ordenadas por valor de cara. El motor determinístico existente (`DiceEngine.ts`) sigue siendo la fuente de verdad para los resultados — la física es puramente visual.

## Motivation

El flujo actual salta instantáneamente de PREVIEW a ARRANGED sin animación. Para un simulador de Warhammer 40K, la experiencia de lanzar dados físicos es fundamental — ver los dados revolverse, caer y rebotar crea la tensión y emoción del juego de mesa real.

## Detailed Design

### Dependencias nuevas

```json
{
  "@react-three/rapier": "^2.1.0",
  "zustand": "^5.0.0"
}
```

- `@react-three/rapier`: Wrapper React para Rapier3D con soporte para `InstancedRigidBodies`.
- `zustand`: Estado global reactivo + lectura no-reactiva en `useFrame` via `getState()`.

> Nota: `@dimforge/rapier3d-compat` (v0.19.3) ya está instalado.

---

### Types

#### Extensión de `src/core/types.ts`

```typescript
/** Fases expandidas de la máquina de estados del juego */
export type GamePhase =
  | 'PREVIEW'    // Dados en grilla, sin física
  | 'ROLLING'    // Impulsos aplicados, dados en el aire
  | 'SETTLING'   // Dados rebotando, perdiendo velocidad
  | 'ARRANGING'  // Lerp desde posiciones de física a layout ordenado
  | 'ARRANGED';  // Dados ordenados por cara, acciones disponibles

/** Parámetros de lanzamiento para un dado individual */
export interface ThrowParams {
  impulse: { x: number; y: number; z: number };
  torque:  { x: number; y: number; z: number };
  startPosition: { x: number; y: number; z: number };
}

/** Posición + rotación objetivo para la animación de arrange */
export interface ArrangeTarget {
  position: [number, number, number];
  quaternion: [number, number, number, number];
}
```

#### Renombrar `GameState` → `GamePhase`

El tipo actual `GameState = 'PREVIEW' | 'ARRANGED'` se renombra a `GamePhase` y se expande con los 3 estados intermedios. Se hace search-and-replace en todos los archivos que usan `GameState`.

**Archivos afectados**: `types.ts`, `WarhammerBoard.tsx`, `DiceScene.tsx`, `UIControls.tsx`, `ResultsPanel.tsx`.

---

### State Changes

#### Nuevo: `src/store/diceStore.ts` (Zustand)

Migrar los 10 `useState` de `WarhammerBoard.tsx` a un store Zustand. Esto permite:
- Leer estado en `useFrame` sin re-renders (`getState()`)
- Suscripciones selectivas en componentes UI
- Acciones centralizadas

```typescript
interface DiceStore {
  // --- Estado existente (migrado desde useState) ---
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

  // --- Estado nuevo para física ---
  throwParams: ThrowParams[] | null;       // Impulsos por dado
  arrangeTargets: ArrangeTarget[] | null;  // Posiciones finales para lerp
  arrangeProgress: number;                 // 0→1 progreso de animación arrange

  // --- Acciones existentes (migradas) ---
  addCount: (n: number) => void;
  throwDice: () => void;
  repeatThrow: () => void;
  deleteFace: (faceValue: number) => void;
  rerollFace: (faceValue: number) => void;
  toggleLethal: (faceValue: number) => void;
  sustainedHits: (faceValue: number) => void;
  reset: () => void;
  setDieColor: (c: DieColor) => void;
  setTurn: (t: number) => void;
  setWarhPhase: (p: WarhPhase | null) => void;
  setSustainedX: (x: SustainedX) => void;

  // --- Acciones nuevas para física ---
  onAllDiceSettled: () => void;            // Llamada cuando todos los dados duermen
  tickArrangeAnimation: (delta: number) => void;  // Avanza el lerp de arrange
}
```

#### Valores iniciales nuevos

```typescript
throwParams: null,
arrangeTargets: null,
arrangeProgress: 0,
```

---

### Core Logic

#### `src/core/ThrowCalculator.ts` (nuevo)

Funciones puras para calcular parámetros de lanzamiento. Sin dependencias de Three.js ni Rapier.

```typescript
/**
 * Calcula parámetros de lanzamiento para N dados.
 * Usa el RNG seeded para reproducibilidad visual (no afecta resultados).
 *
 * @param count - Número de dados
 * @param seed  - Semilla para RNG de parámetros de lanzamiento
 * @returns Array de ThrowParams, uno por dado
 */
export function computeThrowParams(count: number, seed: string): ThrowParams[];
```

**Contrato**:
- Impulso vertical (y) siempre positivo: `[8, 15]` — los dados siempre suben primero.
- Impulso horizontal (x, z) variado: `[-5, 5]` — dispersión natural.
- Torque en los 3 ejes: `[-15, 15]` — giros convincentes.
- Posiciones iniciales: distribuidas en arco sobre la mesa, elevadas `y ∈ [6, 10]`.
- Usa `mulberry32` internamente para que los mismos parámetros de seed produzcan los mismos lanzamientos visuales.

#### `src/core/ArrangeLayout.ts` (nuevo)

Función pura para calcular las posiciones finales del layout ARRANGED. Extraída de la lógica actualmente inline en `DiceScene.tsx`.

```typescript
/**
 * Calcula posiciones y quaterniones ordenadas por valor de cara.
 *
 * @param values     - Valores de cara por dado
 * @param activeMask - Máscara de dados activos
 * @param lethalMask - Máscara de dados letales
 * @param scale      - Escala de los dados
 * @param hasLethal  - Si hay dados letales activos
 * @returns Map de índice de dado → ArrangeTarget
 */
export function computeArrangeTargets(
  values: number[],
  activeMask: boolean[],
  lethalMask: boolean[],
  scale: number,
  hasLethal: boolean,
): Map<number, ArrangeTarget>;
```

**Contrato**:
- Los dados inactivos (`activeMask[i] === false`) no reciben target.
- Los dados letales se posicionan en la zona de Mortal Wounds (z ≈ 6).
- Los dados normales se ordenan en filas por valor de cara.
- El quaternion apunta la cara correcta hacia arriba (+Y).

#### `src/physics/settleDetection.ts` (nuevo)

```typescript
/**
 * Verifica si un RigidBody se ha detenido.
 * @returns true si velocidad lineal Y angular están bajo umbral.
 */
export function isBodySettled(
  linvel: { x: number; y: number; z: number },
  angvel: { x: number; y: number; z: number },
  threshold?: number,
): boolean;
```

**Contrato**:
- Umbral por defecto: `0.08` para linvel, `0.1` para angvel.
- Retorna `true` cuando `|linvel| < threshold AND |angvel| < threshold`.

#### `src/physics/constants.ts` (nuevo)

```typescript
export const PHYSICS_CONFIG = {
  gravity: [0, -50, 0] as const,    // Gravedad fuerte para caída rápida
  restitution: 0.3,                  // Rebote moderado
  friction: 0.6,                     // Fricción de mesa
  linearDamping: 0.3,                // Amortiguación lineal
  angularDamping: 0.2,               // Amortiguación angular
  settleLinvelThreshold: 0.08,       // Umbral velocidad lineal para settle
  settleAngvelThreshold: 0.1,        // Umbral velocidad angular para settle
  arrangeSpeed: 3.0,                 // Velocidad de animación arrange (unidades/s)
  throwHeightMin: 6,                 // Altura mínima de lanzamiento
  throwHeightMax: 10,                // Altura máxima de lanzamiento
  floorY: 0,                         // Posición Y del suelo
  wallMargin: 1.0,                   // Margen de paredes invisibles
} as const;
```

---

### Transiciones de fase

```
Acción del usuario      │ Fase actual  │ Fase siguiente │ Qué ocurre
─────────────────────────────────────────────────────────────────────────
addCount(n)             │ cualquiera   │ PREVIEW        │ Reset a grilla
throwDice()             │ PREVIEW      │ ROLLING        │ Calcular resultado + impulsos
(automático)            │ ROLLING      │ SETTLING       │ Tras aplicar impulsos (1 frame)
(automático)            │ SETTLING     │ ARRANGING      │ Todos los dados dormidos
(automático)            │ ARRANGING    │ ARRANGED       │ arrangeProgress alcanza 1.0
deleteFace(v)           │ ARRANGED     │ ARRANGED       │ Toggle activeMask
rerollFace(v)           │ ARRANGED     │ ROLLING        │ Nuevos impulsos solo para rerolled
sustainedHits(v)        │ ARRANGED     │ ROLLING        │ Nuevos dados entran con impulsos
toggleLethal(v)         │ ARRANGED     │ ARRANGING      │ Re-layout con animación
reset()                 │ cualquiera   │ PREVIEW        │ Todo a cero
repeatThrow()           │ ARRANGED     │ ROLLING        │ Mismos dados, nuevos valores
```

### Flujo de `throwDice()` en detalle

```typescript
throwDice() {
  // 1. Calcular resultados determinísticos (ya existe)
  const seed = generateSeed();
  const result = rollDice(count, seed);

  // 2. Calcular parámetros de lanzamiento (nuevo)
  const throwSeed = generateSeed(); // seed separada para visual
  const throwParams = computeThrowParams(count, throwSeed);

  // 3. Actualizar store
  set({
    rollResult: result,
    activeMask: new Array(count).fill(true),
    lethalMask: new Array(count).fill(false),
    throwParams,
    arrangeTargets: null,
    arrangeProgress: 0,
    phase: 'ROLLING',
  });

  // 4. Registrar en historial
  // (igual que handleThrow actual)
}
```

### Flujo de `onAllDiceSettled()` en detalle

```typescript
onAllDiceSettled() {
  const { rollResult, activeMask, lethalMask } = get();
  if (!rollResult) return;

  // Calcular posiciones de arrange
  const scale = computeScale(rollResult.count);
  const hasLethal = lethalMask?.some(Boolean) ?? false;
  const targets = computeArrangeTargets(
    rollResult.values, activeMask!, lethalMask!, scale, hasLethal,
  );

  set({
    phase: 'ARRANGING',
    arrangeTargets: targets,
    arrangeProgress: 0,
  });
}
```

---

### 3D Rendering Changes (`DiceScene.tsx`)

#### Reestructura completa

El componente actual maneja PREVIEW y ARRANGED inline. La nueva versión tiene 3 modos de rendering:

**1. PREVIEW** (sin cambios): Grilla centrada con InstancedMesh estático. Sin física.

**2. ROLLING + SETTLING**: `<Physics>` wrapper activo. `InstancedRigidBodies` controla las posiciones.
- En ROLLING: se aplican impulsos a cada RigidBody.
- En SETTLING: `useFrame` monitorea velocidades para detectar asentamiento.
- La mesa y paredes invisibles son `RigidBody type="fixed"`.

**3. ARRANGING + ARRANGED**: Física deshabilitada. `useFrame` interpola posiciones con lerp hacia `arrangeTargets`.

#### Estructura del componente

```tsx
function DiceScene({ ... }) {
  const phase = useDiceStore(s => s.phase);

  return (
    <>
      <Lighting />
      <Board />

      {phase === 'PREVIEW' && <PreviewGrid count={count} />}

      {(phase === 'ROLLING' || phase === 'SETTLING') && (
        <Physics gravity={PHYSICS_CONFIG.gravity}>
          <PhysicsDice />
          <Floor />
          <Walls />
        </Physics>
      )}

      {(phase === 'ARRANGING' || phase === 'ARRANGED') && (
        <ArrangedDice />
      )}
    </>
  );
}
```

#### `PhysicsDice` subcomponente

```tsx
function PhysicsDice() {
  const rigidBodies = useRef<RapierRigidBody[]>(null);
  const throwApplied = useRef(false);

  // Aplicar impulsos una vez al entrar en ROLLING
  useFrame(() => {
    const { phase, throwParams } = useDiceStore.getState();
    if (phase === 'ROLLING' && !throwApplied.current && throwParams) {
      for (let i = 0; i < throwParams.length; i++) {
        const body = rigidBodies.current![i];
        body.setTranslation(throwParams[i].startPosition, true);
        body.applyImpulse(throwParams[i].impulse, true);
        body.applyTorqueImpulse(throwParams[i].torque, true);
      }
      throwApplied.current = true;
      useDiceStore.setState({ phase: 'SETTLING' });
    }

    // Verificar asentamiento
    if (phase === 'SETTLING') {
      let allSettled = true;
      for (const body of rigidBodies.current!) {
        if (!isBodySettled(body.linvel(), body.angvel())) {
          allSettled = false;
          break;
        }
      }
      if (allSettled) {
        useDiceStore.getState().onAllDiceSettled();
      }
    }
  });

  return (
    <InstancedRigidBodies
      ref={rigidBodies}
      instances={instances}
      colliders="cuboid"
      restitution={PHYSICS_CONFIG.restitution}
      friction={PHYSICS_CONFIG.friction}
      linearDamping={PHYSICS_CONFIG.linearDamping}
      angularDamping={PHYSICS_CONFIG.angularDamping}
    >
      <instancedMesh args={[geo, mat, MAX_DICE]} castShadow receiveShadow />
    </InstancedRigidBodies>
  );
}
```

#### `ArrangedDice` subcomponente

```tsx
function ArrangedDice() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const lethalMeshRef = useRef<THREE.InstancedMesh>(null);

  useFrame((_, delta) => {
    const store = useDiceStore.getState();
    if (store.phase === 'ARRANGING') {
      store.tickArrangeAnimation(delta);
    }

    // Actualizar matrices de instancias según arrangeProgress
    const { arrangeTargets, arrangeProgress } = store;
    if (!arrangeTargets || !meshRef.current) return;

    for (const [i, target] of arrangeTargets) {
      // Lerp posición y rotación hacia target usando arrangeProgress
      // ... (detalle de implementación)
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={meshRef} args={[geo, mat, MAX_DICE]} ... />
      <instancedMesh ref={lethalMeshRef} args={[geo, lethalMat, MAX_DICE]} ... />
    </>
  );
}
```

#### Paredes invisibles y suelo

```tsx
function Floor() {
  return (
    <RigidBody type="fixed" position={[0, -0.06, 0]}>
      <CuboidCollider args={[BOARD_W/2, 0.06, BOARD_D/2]} />
    </RigidBody>
  );
}

function Walls() {
  // 4 paredes invisibles en los bordes del tablero
  // Evitan que los dados salgan volando
  return (
    <>
      <RigidBody type="fixed" position={[-(BOARD_W/2 + 0.35), 2, 0]}>
        <CuboidCollider args={[0.35, 4, BOARD_D/2]} />
      </RigidBody>
      {/* ... 3 paredes más */}
    </>
  );
}
```

---

### UI Changes

#### `UIControls.tsx`

- El botón "TIRAR DADOS" se deshabilita durante `ROLLING`, `SETTLING`, y `ARRANGING`.
- El botón "Repetir" se deshabilita durante fases intermedias.
- Agregar indicador visual sutil de fase actual (opcional, baja prioridad).

#### `ResultsPanel.tsx`

- Los botones de acción (del, roll, sus, let) se deshabilitan durante `ROLLING`, `SETTLING`, y `ARRANGING`.
- El panel de resultados muestra datos vacíos durante fases intermedias.
- En ARRANGED se comporta exactamente como ahora.

---

## Test Cases

### Unit Tests (Core Logic)

#### ThrowCalculator

```
TC-1: computeThrowParams(1, "seed-A") retorna array de length 1
TC-2: computeThrowParams(120, "seed-B") retorna array de length 120
TC-3: computeThrowParams(5, "seed-C") — todos los impulse.y son positivos (dados suben)
TC-4: computeThrowParams(5, "seed-C") dos veces con misma seed → resultados idénticos
TC-5: computeThrowParams(0, "seed-D") retorna array vacío
TC-6: computeThrowParams(10, "seed-E") — startPosition.y entre [6, 10]
TC-7: computeThrowParams(10, "seed-E") — torque magnitudes entre [-15, 15]
```

#### ArrangeLayout

```
TC-8:  computeArrangeTargets([1,2,3], [true,true,true], [false,false,false], 1, false)
       → 3 targets, posiciones en filas separadas por valor
TC-9:  computeArrangeTargets([1,1,1], [true,false,true], [false,false,false], 1, false)
       → 2 targets (índice 1 omitido por activeMask)
TC-10: computeArrangeTargets([6,6], [true,true], [true,true], 1, true)
       → 2 targets en zona lethal (z ≈ 6.0)
TC-11: computeArrangeTargets([1,2], [true,true], [false,true], 1, true)
       → target[0] en zona normal, target[1] en zona lethal
TC-12: computeArrangeTargets([], [], [], 1, false) → Map vacío
TC-13: computeArrangeTargets con 120 dados → 120 targets, sin superposiciones
TC-14: Todos los quaterniones apuntan la cara correcta hacia +Y
```

#### settleDetection

```
TC-15: isBodySettled({x:0,y:0,z:0}, {x:0,y:0,z:0}) → true
TC-16: isBodySettled({x:5,y:0,z:0}, {x:0,y:0,z:0}) → false (linvel alto)
TC-17: isBodySettled({x:0,y:0,z:0}, {x:0,y:5,z:0}) → false (angvel alto)
TC-18: isBodySettled({x:0.07,y:0,z:0}, {x:0,y:0,z:0}) → true (bajo umbral 0.08)
TC-19: isBodySettled({x:0.09,y:0,z:0}, {x:0,y:0,z:0}) → false (sobre umbral)
TC-20: isBodySettled con threshold custom = 1.0 → más permisivo
```

### Integration Tests (State Transitions)

```
TC-21: phase=PREVIEW, count=10, throwDice()
       → phase=ROLLING, rollResult.count=10, throwParams.length=10

TC-22: phase=ROLLING → (impulsos aplicados) → phase=SETTLING (automático en 1 frame)

TC-23: phase=SETTLING → (todos settled) → phase=ARRANGING, arrangeTargets !== null

TC-24: phase=ARRANGING → (arrangeProgress=1.0) → phase=ARRANGED

TC-25: phase=ARRANGED, deleteFace(3) → phase=ARRANGED, activeMask actualizado

TC-26: phase=ARRANGED, rerollFace(2) → phase=ROLLING, rollResult actualizado

TC-27: phase=ROLLING, reset() → phase=PREVIEW, todo limpio

TC-28: phase=SETTLING, addCount(5) → phase=PREVIEW (interrumpe la animación)

TC-29: phase=ARRANGED, toggleLethal(6) → phase=ARRANGING (re-layout animado)

TC-30: phase=ARRANGED, sustainedHits(6) → phase=ROLLING (nuevos dados entran animados)
```

### Visual Verification

```
VV-1:  PREVIEW → 10 dados en grilla mostrando cara 6.
VV-2:  ROLLING → dados salen disparados hacia arriba con rotación visible.
VV-3:  SETTLING → dados rebotan en la mesa, van perdiendo velocidad.
VV-4:  SETTLING → ningún dado sale volando fuera del tablero (paredes invisibles).
VV-5:  ARRANGING → dados se deslizan suavemente hacia posiciones ordenadas.
VV-6:  ARRANGED → layout idéntico al actual (filas por valor de cara).
VV-7:  120 dados → performance fluida (>30 FPS durante todas las fases).
VV-8:  Dados letales se mueven a zona morada durante ARRANGING.
VV-9:  Reroll → solo los dados re-tirados se lanzan de nuevo.
VV-10: Colores de dados se mantienen correctos durante todas las fases.
```

---

## Implementation Plan

### Paso 0: Instalar dependencias

```bash
npm install @react-three/rapier zustand
```

### Paso 1: Tipos (`src/core/types.ts`)

- Renombrar `GameState` → `GamePhase`.
- Agregar fases: `'ROLLING' | 'SETTLING' | 'ARRANGING'`.
- Agregar interfaces: `ThrowParams`, `ArrangeTarget`.
- Search-and-replace `GameState` en todos los archivos.

**Verificar**: `npx tsc --noEmit`

### Paso 2: Constantes de física (`src/physics/constants.ts`)

- Crear archivo con `PHYSICS_CONFIG`.

**Verificar**: `npx tsc --noEmit`

### Paso 3: ThrowCalculator (`src/core/ThrowCalculator.ts`)

- Implementar `computeThrowParams()`.
- Usa `mulberry32` del `DiceEngine`.

**Verificar**: ejecutar tests TC-1 a TC-7.

### Paso 4: ArrangeLayout (`src/core/ArrangeLayout.ts`)

- Extraer lógica de layout de `DiceScene.tsx` a función pura.
- Implementar `computeArrangeTargets()`.

**Verificar**: ejecutar tests TC-8 a TC-14.

### Paso 5: settleDetection (`src/physics/settleDetection.ts`)

- Implementar `isBodySettled()`.

**Verificar**: ejecutar tests TC-15 a TC-20.

### Paso 6: Zustand store (`src/store/diceStore.ts`)

- Crear store con todo el estado migrado desde `WarhammerBoard.tsx`.
- Implementar todas las acciones.
- `throwDice()` calcula `rollResult` + `throwParams` y cambia a `ROLLING`.
- `onAllDiceSettled()` calcula `arrangeTargets` y cambia a `ARRANGING`.
- `tickArrangeAnimation()` avanza `arrangeProgress` y cambia a `ARRANGED` al completar.

**Verificar**: `npx tsc --noEmit`

### Paso 7: WarhammerBoard refactor (`src/components/WarhammerBoard.tsx`)

- Eliminar todos los `useState` y `useCallback`.
- Consumir estado y acciones desde `useDiceStore`.
- Mantener el mismo layout DOM (Canvas, UIControls, ResultsPanel).

**Verificar**: `npx tsc --noEmit` + `npm run build`

### Paso 8: DiceScene refactor (`src/components/DiceScene.tsx`)

- Reestructurar en subcomponentes: `PreviewGrid`, `PhysicsDice`, `ArrangedDice`.
- `PhysicsDice`: `<Physics>` + `<InstancedRigidBodies>` + settle detection en `useFrame`.
- `ArrangedDice`: lerp animado en `useFrame`.
- `PreviewGrid`: lógica de grilla existente.
- Agregar `Floor` y `Walls` (colliders invisibles).

**Verificar**: `npm run build` + verificación visual VV-1 a VV-10.

### Paso 9: UI updates

- `UIControls.tsx`: Deshabilitar botones durante fases intermedias.
- `ResultsPanel.tsx`: Deshabilitar acciones durante fases intermedias.

**Verificar**: `npm run build`

### Paso 10: Validación final

- Ejecutar `/validate` completo.
- Verificar los 10 puntos de verificación visual.
- Probar con 1, 10, 50, 120 dados.

---

## Invariants

Todas estas condiciones DEBEN mantenerse después de la implementación:

1. **Determinismo**: `DiceEngine.rollDice(count, seed)` sigue siendo la fuente de verdad. Misma seed + count = mismos valores. La física NO determina resultados.
2. **Mask lengths**: `activeMask.length === lethalMask.length === rollResult.count` siempre que no sean `null`.
3. **Lethal exclusion**: Dados con `lethalMask[i] === true` nunca se incluyen en rerolls.
4. **InstancedMesh ≤ 120**: Máximo 120 dados por mesh, enforced en `addCount` y `sustainedHits`.
5. **No Math.random() en rolls**: Solo `generateSeed()` usa `Math.random()`. Los valores de dados usan Mulberry32.
6. **SSR boundary**: `WarhammerBoard` sigue importado con `dynamic({ ssr: false })`. Rapier3D solo se carga client-side.
7. **Física = visual**: Si se deshabilita la física (fallback), los resultados del juego no cambian — solo se pierde la animación.
8. **Phase gating**: Los botones de acción (del, reroll, sus, let) solo funcionan en `ARRANGED`. El botón de tirar solo funciona en `PREVIEW` y `ARRANGED`.
9. **Interrumpibilidad**: `reset()` y `addCount()` pueden interrumpir cualquier fase y volver a `PREVIEW`.

---

## Decisiones de diseño clave

### ¿Por qué no usar la física para determinar resultados?

- El Warhammer requiere reglas aplicadas instantáneamente (Sustained Hits, Lethal Hits).
- La detección de cara por física es imprecisa — un dado puede quedar inclinado.
- El motor determinístico permite repetir exactamente la misma tirada (misma seed).
- Redes multijugador en el futuro necesitan resultados sincronizados antes de la animación.

### ¿Por qué Zustand en vez de seguir con useState?

- `useFrame` necesita leer estado sin causar re-renders de React.
- `useState` en WarhammerBoard causa re-render de todo el Canvas en cada cambio.
- Zustand permite `getState()` para lectura no-reactiva dentro del frame loop.
- Las suscripciones selectivas (`useDiceStore(s => s.phase)`) minimizan re-renders en la UI.

### ¿Por qué no ECS?

- Un solo tipo de entidad (dado) con variante menor (normal vs lethal).
- Solo 3 sistemas (física, rendering, reglas).
- React + hooks + Zustand es suficiente para esta complejidad.

### ¿Corrección de cara por torque o por snap?

Se usa **snap + lerp** en la fase ARRANGING, no torque correctivo durante SETTLING. Razones:
- Torque correctivo puede crear oscilaciones infinitas si el dado está entre dos caras.
- El snap durante ARRANGING es indistinguible del movimiento natural de acomodo.
- Más simple de implementar y mantener.

---

## Out of Scope

- **Sonido**: Efectos de sonido de dados cayendo/rebotando. (Feature separada.)
- **Partículas**: Efectos visuales de impacto en la mesa. (Feature separada.)
- **Multijugador / networking**: Sincronización de lanzamientos entre clientes.
- **Physics LOD**: Simplificación de física para dados lejanos a la cámara.
- **Custom throw direction**: Arrastrar y soltar para controlar la dirección del lanzamiento.
- **Dice trails**: Estelas visuales durante el vuelo.
- **Replay**: Repetir la animación de un lanzamiento anterior.
- **Configuración de física**: UI para ajustar gravedad, rebote, etc.
