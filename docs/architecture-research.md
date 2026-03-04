# Investigación: Arquitectura 3D para Magic Dice

## Contexto

El flujo deseado es:

```
Generar dados → Lanzar → Revolver en el aire → Caer y rebotar → Ordenar → Fin
```

El flujo actual salta de PREVIEW a ARRANGED instantáneamente, sin animación ni física.

---

## Patrón recomendado: Híbrido (Option C)

**Resultados determinísticos + física solo como capa visual.**

Usado en producción por [Owlbear Rodeo](https://github.com/owlbear-rodeo/dice). El motor determinístico (`DiceEngine.ts`) calcula valores ANTES de la física. Rapier3D solo anima el lanzamiento/rebote. Si un dado cae en la cara "equivocada", se corrige con torque sutil.

### Por qué este patrón

- Los valores de los dados ya están decididos cuando se presiona "Tirar".
- Las reglas Warhammer (Sustained Hits, Lethal Hits, rerolls) necesitan resultados instantáneos.
- La física es solo el espectáculo visual, no decide el resultado.
- El motor determinístico actual se preserva sin cambios.

### Alternativas descartadas

| Opción | Descripción | Problema |
|--------|-------------|----------|
| **A: Lógica pura separada** | State machine + funciones puras. Rendering pasivo. | No puede usar física para animación visual. |
| **B: Todo en R3F** | Física, estado, rendering en `useFrame` y componentes R3F. | Difícil de testear. Reglas mezcladas con rendering. |
| **C: Híbrido** | Motor determinístico + física visual. | **Seleccionado.** |

---

## Separación en 4 capas

```
src/
  core/                  # CAPA 1: Lógica pura (sin Three.js)
    DiceEngine.ts        # RNG determinístico (ya existe, no cambia)
    StateMachine.ts      # NUEVO: máquina de estados de fases
    RulesConfig.ts       # Reglas Warhammer (ya existe)
    types.ts             # Tipos (se expande)

  physics/               # CAPA 2: Física (Rapier3D) — solo animación
    DicePhysics.ts       # Config mundo Rapier, fuerzas de lanzamiento
    settleDetection.ts   # Detectar cuándo los dados se detienen

  rendering/             # CAPA 3: Three.js/R3F visual
    DiceGeometry.ts      # (ya existe)
    DiceMaterial.ts      # (ya existe)

  components/            # CAPA 3+4: Componentes R3F + UI
    DiceScene.tsx         # InstancedMesh + puente con física
    WarhammerBoard.tsx    # Orquestador (ya existe, se adapta)

  ui/                    # CAPA 4: React DOM puro
    UIControls.tsx
    ResultsPanel.tsx
```

### Responsabilidades por capa

**Capa 1 — Core (lógica pura, cero dependencias de Three.js)**

- `DiceEngine.ts`: RNG seeded Mulberry32, cálculo de valores y quaterniones finales. Ya existe y no cambia.
- `StateMachine.ts`: Define las transiciones entre fases del juego. Funciones puras que reciben estado actual y evento, devuelven estado siguiente.
- `types.ts`: Se expande con los nuevos estados de la máquina.
- `RulesConfig.ts`: Reglas Warhammer (umbrales, sustained, lethal). Ya existe.

**Capa 2 — Physics (Rapier3D, solo animación)**

- `DicePhysics.ts`: Configuración del mundo Rapier (gravedad, materiales, restitución). Funciones para calcular vectores de impulso y torque de lanzamiento.
- `settleDetection.ts`: Lógica para detectar cuándo todos los dados se han detenido (velocidad lineal + angular < umbral).

**Capa 3 — Rendering (Three.js/R3F)**

- `DiceGeometry.ts`, `DiceMaterial.ts`: Ya existen, no cambian.
- `DiceScene.tsx`: Se adapta para manejar los estados intermedios (ROLLING, SETTLING, ANIMATING). Usa `useFrame` para mutaciones por ref.

**Capa 4 — UI (React DOM puro)**

- `UIControls.tsx`, `ResultsPanel.tsx`: Ya existen. Sin dependencias de Three.js.

---

## Máquina de estados

```
PREVIEW ──► ROLLING ──► SETTLING ──► RESULT ──► ANIMATING ──► ARRANGED
  │          impulsos     esperando    leer       lerp hacia     ordenados
  │          aplicados    velocidad    caras      posiciones     por cara
  │                       ≈ 0         (ya las     finales
  │                                   sabíamos)
  └──────────────────── RESET ◄────────────────────────────────────┘
```

### Detalle de cada fase

| Fase | Qué ocurre | Física activa | Duración |
|------|-----------|---------------|----------|
| `PREVIEW` | Dados en grilla mostrando cara 6. Sin física. | No | Indefinida |
| `ROLLING` | Impulsos aplicados a cada RigidBody. Dados vuelan y giran. | Sí | ~1-2s |
| `SETTLING` | Esperando que todos los dados duerman (velocidad ≈ 0). | Sí | ~0.5-1s |
| `RESULT` | Valores leídos (ya pre-computados). Reglas aplicadas. | No | Instantáneo |
| `ANIMATING` | Lerp suave desde posiciones de física a posiciones ordenadas. | No | ~0.5s |
| `ARRANGED` | Dados ordenados por valor de cara. Acciones disponibles (del/reroll/sus/let). | No | Indefinida |

---

## Integración con Rapier3D

### InstancedRigidBodies para 120 dados

`@react-three/rapier` provee `InstancedRigidBodies` que wrappea un solo `InstancedMesh` dando a cada instancia su propio `RigidBody`:

```tsx
const instances = useMemo(() =>
  Array.from({ length: count }, (_, i) => ({
    key: `die_${i}`,
    position: [gridX(i), gridY(i), gridZ(i)],
    rotation: [0, 0, 0],
  })),
[count]);

<InstancedRigidBodies
  ref={rigidBodies}
  instances={instances}
  colliders="cuboid"
>
  <instancedMesh args={[diceGeometry, diceMaterial, MAX_DICE]} />
</InstancedRigidBodies>
```

### Aplicar impulsos de lanzamiento

```tsx
function throwDice() {
  for (let i = 0; i < count; i++) {
    const body = rigidBodies.current[i];
    const force = 3 + 5 * rng();
    body.applyImpulse({ x: -force, y: force * 1.5, z: rng() - 0.5 }, true);
    body.applyTorqueImpulse({
      x: (rng() - 0.5) * 10,
      y: (rng() - 0.5) * 10,
      z: (rng() - 0.5) * 10,
    }, true);
  }
}
```

### Detección de asentamiento (settle)

**Opción A — Callbacks de sleep (recomendada):**

```tsx
<RigidBody
  canSleep={true}
  onSleep={() => {
    settledCount.current++;
    if (settledCount.current === totalDice) {
      transitionToResult();
    }
  }}
/>
```

**Opción B — Polling de velocidad en useFrame:**

```tsx
useFrame(() => {
  if (phase !== 'SETTLING') return;
  let allSettled = true;
  for (const body of rigidBodies.current) {
    const v = body.linvel();
    const w = body.angvel();
    const speed = Math.sqrt(v.x**2 + v.y**2 + v.z**2);
    const spin  = Math.sqrt(w.x**2 + w.y**2 + w.z**2);
    if (speed > 0.01 || spin > 0.01) { allSettled = false; break; }
  }
  if (allSettled) transitionToResult();
});
```

### Corrección de cara (torque sutil)

Como los resultados ya están pre-computados, si un dado cae en una cara diferente a la predeterminada, se aplica un torque correctivo durante SETTLING:

```tsx
// Durante SETTLING, verificar cara actual vs cara predeterminada
const currentFace = readFaceFromQuaternion(body.rotation());
const targetFace  = precomputedValues[i];
if (currentFace !== targetFace) {
  const correctionQ = faceUpQuaternion(targetFace);
  // Aplicar torque sutil hacia la orientación correcta
  body.applyTorqueImpulse(computeCorrectionTorque(body.rotation(), correctionQ), true);
}
```

---

## Estado: Zustand vs useState actual

### Problema actual

`WarhammerBoard.tsx` tiene 10 llamadas a `useState`. Cada actualización de estado causa re-render del árbol completo, incluyendo el Canvas 3D.

### Solución: Zustand

Zustand permite leer estado dentro de `useFrame` sin causar re-renders:

```tsx
// Store
const useDiceStore = create((set, get) => ({
  phase: 'PREVIEW',
  rollResult: null,
  activeMask: null,
  lethalMask: null,
  // ... acciones
  throwDice: () => { /* ... */ },
}));

// En componente R3F — leer sin re-render
useFrame(() => {
  const { phase } = useDiceStore.getState();
  if (phase === 'ROLLING') { /* actualizar física */ }
});

// En componente UI — suscripción selectiva
function ResultsPanel() {
  const rollResult = useDiceStore(s => s.rollResult);
  // solo re-renderiza cuando rollResult cambia
}
```

---

## Performance con 120 dados

| Técnica | Detalle |
|---------|---------|
| `InstancedRigidBodies` | Un solo draw call para 120 dados |
| Colliders `cuboid` | Forma más eficiente para d6 (evitar `trimesh` o `hull`) |
| Física deshabilitada cuando no se necesita | En PREVIEW/ARRANGED: `type="fixed"` o `"kinematicPosition"` |
| `useFrame` + refs | Mutaciones sin re-renders de React |
| Rapier WASM | Corre en su propio thread, rápido para 120 cubos simples |
| Geometría/material compartidos | `useMemo` para reusar instancias (ya implementado) |

---

## ECS: No necesario

El proyecto tiene:
- Un solo tipo de entidad (dado), con variante menor (normal vs lethal).
- Tres sistemas: física, rendering, reglas.
- Composición manejable con masks (`activeMask[]`, `lethalMask[]`).

React + hooks + Zustand es suficiente. ECS agrega indirección sin beneficio proporcional.

---

## El flujo completo con el patrón híbrido

```
1. Usuario agrega dados (+1D6, +5D6...)
   └─► PREVIEW: grilla centrada, cara 6 visible, sin física

2. Presiona "TIRAR DADOS"
   ├─► DiceEngine.rollDice() calcula valores determinísticos
   ├─► Resultados guardados en store (aún no mostrados)
   └─► Transición a ROLLING

3. ROLLING: impulsos aplicados a cada RigidBody
   └─► useFrame sincroniza InstancedMesh con posiciones de Rapier

4. SETTLING: dados rebotando, perdiendo velocidad
   ├─► Corrección sutil de cara si difiere del resultado pre-computado
   └─► Cuando todos duermen → RESULT

5. RESULT: lectura instantánea
   ├─► Valores ya conocidos desde paso 2
   ├─► Reglas Warhammer aplicadas (successes, criticals)
   └─► Computar posiciones de ARRANGED layout

6. ANIMATING: lerp suave de posiciones físicas a posiciones ordenadas
   └─► ~0.5s de transición con THREE.MathUtils.lerp

7. ARRANGED: dados ordenados por cara
   └─► Acciones disponibles: del, reroll, sustained, lethal
```

---

## Fuentes

- [R3F Performance Pitfalls](https://r3f.docs.pmnd.rs/advanced/pitfalls)
- [R3F Scaling Performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance)
- [@react-three/rapier](https://github.com/pmndrs/react-three-rapier)
- [Rapier Rigid Bodies](https://rapier.rs/docs/user_guides/javascript/rigid_bodies/)
- [Rapier Determinism](https://rapier.rs/docs/user_guides/javascript/determinism/)
- [Codrops Dice Roller Tutorial](https://tympanus.net/codrops/2023/01/25/crafting-a-dice-roller-with-three-js-and-cannon-es/)
- [Owlbear Rodeo Dice](https://github.com/owlbear-rodeo/dice)
- [Owlbear Rodeo Dice Deep Dive](https://blog.owlbear.rodeo/owlbear-rodeo-2-0-dice-deep-dive/)
- [Modular WebGL con R3F](https://varun.ca/modular-webgl/)
- [R3F + ECS](https://douges.dev/blog/simplifying-r3f-with-ecs)
