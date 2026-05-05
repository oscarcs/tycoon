import { useEffect, useMemo, useRef, useState } from 'react';
import { Anchor, Banknote, Building2, Cable, Factory, HandCoins, Home, Landmark, MousePointer2, Pickaxe, Plane, Play, RadioTower, Save, Share2, Square, TrainFront, Warehouse } from 'lucide-react';
import { loadManifest } from '../game/manifest';
import { connectMultiplayer } from '../game/multiplayer';
import { applyTool, createGame, formatMoney, loadGame, saveGame, setSpeed, startMultiplayer, takeLoan, tickGame } from '../game/simulation';
import { loadSprites, renderGame, screenToWorld, type SpriteCatalog } from '../game/render';
import type { GameState, Tool } from '../game/types';

const tools: Array<{ id: Tool; label: string; icon: typeof MousePointer2 }> = [
  { id: 'inspect', label: 'Inspect', icon: MousePointer2 },
  { id: 'rail', label: 'Rail', icon: TrainFront },
  { id: 'elevatedRail', label: 'Elevated', icon: Landmark },
  { id: 'monorail', label: 'Monorail', icon: Cable },
  { id: 'bridge', label: 'Bridge', icon: Anchor },
  { id: 'road', label: 'Road', icon: Square },
  { id: 'station', label: 'Station', icon: Warehouse },
  { id: 'depot', label: 'Depot', icon: RadioTower },
  { id: 'port', label: 'Port', icon: Anchor },
  { id: 'airport', label: 'Airport', icon: Plane },
  { id: 'purchase', label: 'Land', icon: HandCoins },
  { id: 'residential', label: 'Homes', icon: Home },
  { id: 'commercial', label: 'Commerce', icon: Building2 },
  { id: 'industrial', label: 'Industry', icon: Factory },
  { id: 'bulldoze', label: 'Clear', icon: Pickaxe },
];

export function App() {
  const [game, setGame] = useState<GameState>(() => initialGame());
  const [tool, setTool] = useState<Tool>('inspect');
  const [sprites, setSprites] = useState<SpriteCatalog>({});
  const [screen, setScreen] = useState<'menu' | 'game' | 'credits'>('menu');
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 2 });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    loadManifest().then(loadSprites).then(setSprites).catch(() => setSprites({}));
  }, []);

  useEffect(() => {
    if (screen !== 'game') return undefined;
    const id = window.setInterval(() => setGame((current) => tickGame(current, current.clock.speed || 1)), 130);
    return () => window.clearInterval(id);
  }, [screen]);

  useEffect(() => {
    if (game.multiplayer.mode === 'solo') return undefined;
    const client = connectMultiplayer(game, (patch) => {
      setGame((current) => ({
        ...current,
        ...patch.payload,
        log: [`Synced multiplayer patch at tick ${patch.tick}.`, ...current.log].slice(0, 8),
      }));
    });
    return () => client?.close();
  }, [game.multiplayer.mode, game.multiplayer.worldId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || screen !== 'game') return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const resize = () => {
      canvas.width = Math.floor(canvas.clientWidth * window.devicePixelRatio);
      canvas.height = Math.floor(canvas.clientHeight * window.devicePixelRatio);
      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
      renderGame(ctx, game, sprites, camera, game.selectedId);
    };
    resize();
    window.addEventListener('resize', resize);
    renderGame(ctx, game, sprites, camera, game.selectedId);
    return () => window.removeEventListener('resize', resize);
  }, [game, sprites, camera, screen]);

  const selectedTile = useMemo(() => {
    if (!game.selectedId?.includes(',')) return undefined;
    const [x, y] = game.selectedId.split(',').map(Number);
    return game.tiles.find((tile) => tile.x === x && tile.y === y);
  }, [game]);
  const selectedStation = game.stations.find((station) => station.id === game.selectedId);
  const date = `${game.clock.year}-${String(game.clock.month).padStart(2, '0')}-${String(game.clock.day).padStart(2, '0')} ${String(game.clock.hour).padStart(2, '0')}:00`;

  if (screen === 'credits') {
    return (
      <main className="menu">
        <section className="menu-panel">
          <h1>Credits</h1>
          <p>Tycoon v1 prototype. Design inspired by Japanese rail and urban development simulations. Pixel tiles are loaded from the local source tileset manifest.</p>
          <button onClick={() => setScreen('menu')}>Back</button>
        </section>
      </main>
    );
  }

  if (screen === 'menu') {
    const saves = JSON.parse(localStorage.getItem('tycoon:saves') ?? '[]') as string[];
    return (
      <main className="menu">
        <section className="menu-panel">
          <h1>Tycoon</h1>
          <div className="menu-actions">
            <button onClick={() => setScreen('game')}><Play size={18} /> Continue</button>
            <button onClick={() => { setGame(createGame(`world-${Date.now()}`)); setScreen('game'); }}>New Seeded World</button>
            <button onClick={() => { const loaded = loadGame(); if (loaded) setGame(loaded); setScreen('game'); }}><Save size={18} /> Last Save</button>
            <button onClick={() => setScreen('credits')}>Credits</button>
          </div>
          <div className="save-list">
            <strong>Previous worlds</strong>
            {saves.length === 0 ? <span>No local saves yet.</span> : saves.map((seed) => <button key={seed} onClick={() => { setGame(createGame(seed)); setScreen('game'); }}>{seed}</button>)}
            <strong>Connected multiplayer</strong>
            <ConnectedWorlds onOpen={(world) => { setGame(joinWorld(world)); setScreen('game'); }} />
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button onClick={() => setScreen('menu')}>Menu</button>
        <div>
          <strong>{date}</strong>
          <span>{formatMoney(game.company.cash)}</span>
        </div>
        <div className="speed">
          {[0, 1, 2, 4].map((speed) => <button className={game.clock.speed === speed ? 'active' : ''} key={speed} onClick={() => setGame((current) => setSpeed(current, speed))}>{speed === 0 ? 'Pause' : `${speed}x`}</button>)}
        </div>
        <button onClick={() => { saveGame(game); setGame((current) => ({ ...current, log: ['Game saved locally.', ...current.log].slice(0, 8) })); }}><Save size={17} /> Save</button>
        <button onClick={() => setGame((current) => rememberConnectedWorld(startMultiplayer(current)))}><Share2 size={17} /> Share</button>
      </header>

      <aside className="toolbar">
        {tools.map(({ id, label, icon: Icon }) => (
          <button className={tool === id ? 'active' : ''} key={id} title={label} onClick={() => setTool(id)}><Icon size={20} /></button>
        ))}
      </aside>

      <canvas
        ref={canvasRef}
        className="game-canvas"
        onWheel={(event) => setCamera((current) => ({ ...current, zoom: Math.min(3, Math.max(1.2, current.zoom - Math.sign(event.deltaY) * 0.15)) }))}
        onPointerDown={(event) => { dragRef.current = { x: event.clientX, y: event.clientY }; }}
        onPointerMove={(event) => {
          if (!dragRef.current || event.buttons !== 1) return;
          setCamera((current) => ({ ...current, x: current.x + event.clientX - dragRef.current!.x, y: current.y + event.clientY - dragRef.current!.y }));
          dragRef.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerUp={(event) => {
          const moved = dragRef.current && Math.hypot(event.clientX - dragRef.current.x, event.clientY - dragRef.current.y) > 5;
          dragRef.current = null;
          if (moved) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const point = screenToWorld(event.clientX - rect.left, event.clientY - rect.top, rect.width / 2 + camera.x, 40 + camera.y, camera.zoom);
          setGame((current) => applyTool(current, tool, point.x, point.y));
        }}
      />

      <aside className="side-panel">
        <section>
          <h2>Company</h2>
          <dl>
            <dt>Revenue</dt><dd>{formatMoney(game.company.lifetimeRevenue)}</dd>
            <dt>Expenses</dt><dd>{formatMoney(game.company.lifetimeExpenses)}</dd>
            <dt>Loans</dt><dd>{formatMoney(game.company.loans.reduce((sum, loan) => sum + loan.principal, 0))}</dd>
          </dl>
          <button onClick={() => setGame((current) => takeLoan(current))}><Banknote size={17} /> Take Loan</button>
        </section>
        <section>
          <h2>Selection</h2>
          {selectedStation ? <StationView station={selectedStation} /> : selectedTile ? <TileView tile={selectedTile} /> : <p>No selection.</p>}
        </section>
        <section>
          <h2>Minimap</h2>
          <MiniMap game={game} onJump={(x, y) => setCamera((current) => ({ ...current, x: (game.width / 2 - x) * 20, y: (4 - y) * 12 }))} />
        </section>
        <section>
          <h2>Operations</h2>
          {game.trains.map((train) => <p key={train.id}>{train.name}: {train.passengers}/{train.capacity} pax, {train.cargo}/{train.cargoCapacity} cargo</p>)}
        </section>
        <section className="log">
          <h2>Log</h2>
          {game.log.map((entry, index) => <p key={`${entry}-${index}`}>{entry}</p>)}
          {game.multiplayer.inviteUrl && <input readOnly value={game.multiplayer.inviteUrl} />}
        </section>
      </aside>
    </main>
  );
}

function initialGame(): GameState {
  const params = new URLSearchParams(location.search);
  const seed = params.get('seed') ?? 'showa-mainline';
  const world = params.get('world');
  if (!world) return loadGame() ?? createGame(seed);
  return joinWorld({ worldId: world, seed, inviteUrl: location.href });
}

function joinWorld(world: { worldId: string; seed: string; inviteUrl?: string }): GameState {
  const game = createGame(world.seed);
  game.multiplayer = {
    mode: 'joined',
    worldId: world.worldId,
    inviteUrl: world.inviteUrl,
    peers: ['local-player'],
    lastSyncAt: Date.now(),
  };
  game.log = [`Joined multiplayer world ${world.worldId}.`, ...game.log].slice(0, 8);
  rememberConnectedWorld(game);
  return game;
}

function rememberConnectedWorld(game: GameState): GameState {
  const worlds = JSON.parse(localStorage.getItem('tycoon:multiplayer-worlds') ?? '[]') as Array<{ worldId: string; seed: string; inviteUrl?: string }>;
  const next = [{ worldId: game.multiplayer.worldId, seed: game.seed, inviteUrl: game.multiplayer.inviteUrl }, ...worlds.filter((world) => world.worldId !== game.multiplayer.worldId)].slice(0, 8);
  localStorage.setItem('tycoon:multiplayer-worlds', JSON.stringify(next));
  return game;
}

function ConnectedWorlds({ onOpen }: { onOpen: (world: { worldId: string; seed: string; inviteUrl?: string }) => void }) {
  const worlds = JSON.parse(localStorage.getItem('tycoon:multiplayer-worlds') ?? '[]') as Array<{ worldId: string; seed: string; inviteUrl?: string }>;
  if (worlds.length === 0) return <span>No connected worlds yet.</span>;
  return worlds.map((world) => <button key={world.worldId} onClick={() => onOpen(world)}>{world.worldId}</button>);
}

function TileView({ tile }: { tile: GameState['tiles'][number] }) {
  return (
    <dl>
      <dt>Tile</dt><dd>{tile.x}, {tile.y}</dd>
      <dt>Terrain</dt><dd>{tile.terrain}</dd>
      <dt>Zone</dt><dd>{tile.zone}</dd>
      <dt>Overlay</dt><dd>{tile.overlay}</dd>
      <dt>Name</dt><dd>{tile.buildingName ?? 'Undeveloped'}</dd>
      <dt>People</dt><dd>{tile.passengers}</dd>
      <dt>Cargo</dt><dd>{tile.cargo}</dd>
      <dt>Land</dt><dd>{formatMoney(tile.landValue)}</dd>
    </dl>
  );
}

function StationView({ station }: { station: GameState['stations'][number] }) {
  return (
    <dl>
      <dt>Name</dt><dd>{station.name}</dd>
      <dt>Waiting</dt><dd>{station.passengersWaiting} pax</dd>
      <dt>Cargo</dt><dd>{station.cargoWaiting}</dd>
      <dt>Radius</dt><dd>{station.radius} tiles</dd>
      <dt>Maint.</dt><dd>{formatMoney(station.maintenance)}/day</dd>
    </dl>
  );
}

function MiniMap({ game, onJump }: { game: GameState; onJump: (x: number, y: number) => void }) {
  return (
    <div className="minimap">
      {game.tiles.map((tile) => <button key={`${tile.x}-${tile.y}`} className={tile.terrain} data-zone={tile.zone} data-overlay={tile.overlay} onClick={() => onJump(tile.x, tile.y)} />)}
    </div>
  );
}
