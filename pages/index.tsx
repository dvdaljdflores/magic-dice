/**
 * Entry point — dynamic import disables SSR for the entire 3D board.
 * Required because:
 *   1. Three.js uses browser-only APIs (WebGL, Canvas).
 *   2. @dimforge/rapier3d-compat loads a WASM binary at runtime.
 * Neither can execute in Node.js during Next.js server-side rendering.
 */
import dynamic from 'next/dynamic';

const WarhammerBoard = dynamic(
  () => import('../src/components/WarhammerBoard'),
  {
    ssr: false,
    loading: () => (
      <div style={{
        width: '100vw',
        height: '100vh',
        background: '#08080f',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#00d4ff',
        fontFamily: "'Courier New', Courier, monospace",
        letterSpacing: 4,
        fontSize: 13,
      }}>
        INICIALIZANDO MOTOR FÍSICO...
      </div>
    ),
  }
);

export default function Home() {
  return <WarhammerBoard />;
}
