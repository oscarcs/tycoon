import type { GameState } from './types';

export interface SyncPatch {
  worldId: string;
  tick: number;
  payload: Partial<GameState>;
}

export interface MultiplayerClient {
  close: () => void;
  send: (state: GameState) => void;
}

export function encodeInvite(state: GameState): string {
  const base = typeof location === 'undefined' ? 'https://example.invalid' : location.origin;
  return `${base}?world=${state.multiplayer.worldId}&seed=${encodeURIComponent(state.seed)}`;
}

export function makePatch(state: GameState): SyncPatch {
  return {
    worldId: state.multiplayer.worldId,
    tick: state.clock.tick,
    payload: {
      seed: state.seed,
      stations: state.stations,
      trains: state.trains,
      company: state.company,
      clock: state.clock,
    },
  };
}

export function connectMultiplayer(state: GameState, onPatch: (patch: SyncPatch) => void, endpoint = import.meta.env.VITE_TYCOON_SYNC_URL as string | undefined): MultiplayerClient | undefined {
  if (!endpoint || typeof WebSocket === 'undefined') return undefined;
  const url = new URL(endpoint);
  url.searchParams.set('world', state.multiplayer.worldId);
  const socket = new WebSocket(url);
  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data as string) as { type?: string } & SyncPatch;
      if (message.type === 'patch' || message.type === 'snapshot') onPatch(message);
    } catch {
      // Multiplayer is optimistic in v1; malformed peer messages are ignored.
    }
  };
  return {
    close: () => socket.close(),
    send: (current) => {
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'patch', ...makePatch(current) }));
    },
  };
}
