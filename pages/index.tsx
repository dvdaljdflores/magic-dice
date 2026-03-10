/**
 * Entry point — dynamic import disables SSR for the entire application.
 * Required because:
 *   1. Three.js uses browser-only APIs (WebGL, Canvas).
 *   2. @dimforge/rapier3d-compat loads a WASM binary at runtime.
 *   3. BroadcastChannel and localStorage (session layer) are browser-only.
 * None of these can execute in Node.js during Next.js server-side rendering.
 *
 * AppRouter handles all screen routing:
 *   lobby → waiting room → dice table (solo or session)
 */
import dynamic from 'next/dynamic';

const AppRouter = dynamic(
  () => import('../src/AppRouter').then(m => ({ default: m.AppRouter })),
  {
    ssr: false,
    loading: () => (
      <div style={{
        width:          '100vw',
        height:         '100vh',
        background:     '#08080f',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        color:          '#00d4ff',
        fontFamily:     "'Courier New', Courier, monospace",
        letterSpacing:  4,
        fontSize:       13,
      }}>
        INICIALIZANDO MOTOR FÍSICO...
      </div>
    ),
  }
);

export default function Home() {
  return <AppRouter />;
}
