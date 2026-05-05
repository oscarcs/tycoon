import { DurableObject } from 'cloudflare:workers';

export interface Env {
  TYCOON_WORLD: DurableObjectNamespace<TycoonWorld>;
}

interface SyncMessage {
  type: 'hello' | 'patch' | 'snapshot' | 'peer';
  worldId: string;
  clientId?: string;
  tick?: number;
  payload?: unknown;
}

interface StoredPatch {
  id: number;
  tick: number;
  payload: string;
  created_at: number;
}

export class TycoonWorld extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS patches (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tick INTEGER NOT NULL,
          payload TEXT NOT NULL,
          created_at INTEGER NOT NULL
        )
      `);
    });
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      const latest = this.ctx.storage.sql.exec<StoredPatch>(
        'SELECT id, tick, payload, created_at FROM patches ORDER BY id DESC LIMIT 1',
      ).one();
      return Response.json({ ok: true, latest: latest ? JSON.parse(latest.payload) : null });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const clientId = crypto.randomUUID();
    server.serializeAttachment({ clientId });
    this.ctx.acceptWebSocket(server);
    server.send(JSON.stringify({ type: 'hello', clientId, peers: this.ctx.getWebSockets().length }));
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(sender: WebSocket, message: string | ArrayBuffer): void {
    if (typeof message !== 'string') return;
    const parsed = safeParse(message);
    if (!parsed) return;
    if (parsed.type === 'patch' || parsed.type === 'snapshot') {
      this.ctx.storage.sql.exec(
        'INSERT INTO patches (tick, payload, created_at) VALUES (?, ?, ?)',
        parsed.tick ?? 0,
        JSON.stringify(parsed),
        Date.now(),
      );
    }
    for (const socket of this.ctx.getWebSockets()) {
      if (socket !== sender) socket.send(JSON.stringify(parsed));
    }
  }

  webSocketClose(ws: WebSocket): void {
    const attachment = ws.deserializeAttachment() as { clientId?: string } | undefined;
    const left: SyncMessage = { type: 'peer', worldId: 'unknown', clientId: attachment?.clientId };
    for (const socket of this.ctx.getWebSockets()) socket.send(JSON.stringify(left));
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/health') return Response.json({ ok: true });
    const worldId = url.searchParams.get('world') ?? url.pathname.split('/').filter(Boolean).at(0) ?? 'default';
    const stub = env.TYCOON_WORLD.getByName(worldId);
    return stub.fetch(request);
  },
};

function safeParse(message: string): SyncMessage | undefined {
  try {
    const parsed = JSON.parse(message) as SyncMessage;
    return typeof parsed.worldId === 'string' && typeof parsed.type === 'string' ? parsed : undefined;
  } catch {
    return undefined;
  }
}
