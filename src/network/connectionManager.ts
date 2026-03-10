/**
 * ConnectionManager — Network Layer Placeholder
 *
 * PURPOSE:
 *   This file is a structural placeholder for future real-time networking.
 *   Currently the application uses a local simulation approach (localStorage +
 *   BroadcastChannel) implemented in sessionManager.ts.
 *
 * FUTURE IMPLEMENTATION — WebRTC Host-Authoritative Model:
 *
 *   Architecture:
 *     - Host tab acts as the authoritative server
 *     - Players connect to the host via WebRTC DataChannel (peer-to-peer)
 *     - Spectators connect to the host in receive-only mode
 *     - No dedicated backend server required
 *
 *   Signaling:
 *     - WebRTC requires a signaling server to exchange SDP offers/answers
 *     - Suggested: simple WebSocket server or a free service like PeerJS
 *     - Session ID maps to a PeerJS/WebRTC "room"
 *
 *   Message Protocol:
 *     - Same SessionMessage union type from sessionTypes.ts
 *     - HOST_UPDATE, ROLL_ADDED, SESSION_CLOSED messages sent over DataChannel
 *
 *   Migration Path:
 *     1. Implement `connectToHost(sessionId, onMessage)` here
 *     2. Implement `broadcastToPlayers(msg)` here (host only)
 *     3. Replace BroadcastChannel calls in sessionManager.ts with these functions
 *     4. Keep the same sessionStore / appModeStore / screen API
 *
 * CURRENT STATUS: NOT IMPLEMENTED
 *   All session communication goes through sessionManager.ts using
 *   BroadcastChannel (same tab) and localStorage (cross-tab).
 *
 * INTERACTIONS:
 *   - sessionManager.ts will delegate to this file when networking is live
 *   - No other file should import from here until networking is implemented
 */

// ─── Future Interface ─────────────────────────────────────────────────────────

/**
 * Initialize a connection as the host.
 * The host listens for incoming peer connections and relays state.
 *
 * @param sessionId - The session code to advertise
 * @param onPlayerJoined - Callback when a player connects
 */
export async function initHostConnection(
  _sessionId: string,
  _onPlayerJoined: (peerId: string) => void,
): Promise<void> {
  throw new Error('ConnectionManager: Not yet implemented. Use sessionManager.ts instead.');
}

/**
 * Connect to an existing session as a player or spectator.
 *
 * @param sessionId - The session code to connect to
 * @param onMessage - Callback for incoming messages from the host
 */
export async function connectToHost(
  _sessionId: string,
  _onMessage: (data: unknown) => void,
): Promise<void> {
  throw new Error('ConnectionManager: Not yet implemented. Use sessionManager.ts instead.');
}

/**
 * Broadcast a message to all connected peers (host → players).
 *
 * @param data - Serialisable message conforming to SessionMessage
 */
export function broadcastToPeers(_data: unknown): void {
  throw new Error('ConnectionManager: Not yet implemented. Use sessionManager.ts instead.');
}

/**
 * Cleanly close all peer connections and release resources.
 */
export function disconnect(): void {
  throw new Error('ConnectionManager: Not yet implemented. Use sessionManager.ts instead.');
}