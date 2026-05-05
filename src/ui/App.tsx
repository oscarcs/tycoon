import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Anchor, Banknote, Building2, Cable, Factory, HandCoins, Home, MousePointer2, Plane, Play, RadioTower, RailSymbol, Redo2, Route, Save, Share2, Ship, TrainTrack, Trash2, Undo2, Warehouse } from 'lucide-react';
import { connectMultiplayer } from '../game/multiplayer';
import { applyTool, applyToolLine, createGame, formatMoney, loadGame, saveGame, setSpeed, startMultiplayer, takeLoan, tickGame } from '../game/simulation';
import { PixiMap } from './PixiMap';
import { TILE_H, TILE_W, screenToWorldFloat, type Camera } from '../game/geometry';
import type { GameState, Tile, Tool } from '../game/types';

const tools: Array<{ id: Tool; label: string; icon: typeof MousePointer2 }> = [
  { id: 'inspect', label: 'Inspect', icon: MousePointer2 },
  { id: 'rail', label: 'Rail', icon: TrainTrack },
  { id: 'elevatedRail', label: 'Elevated', icon: RailSymbol },
  { id: 'monorail', label: 'Monorail', icon: Cable },
  { id: 'bridge', label: 'Bridge', icon: Anchor },
  { id: 'road', label: 'Road', icon: Route },
  { id: 'station', label: 'Station', icon: Warehouse },
  { id: 'depot', label: 'Depot', icon: RadioTower },
  { id: 'port', label: 'Port', icon: Ship },
  { id: 'airport', label: 'Airport', icon: Plane },
  { id: 'purchase', label: 'Land', icon: HandCoins },
  { id: 'residential', label: 'Homes', icon: Home },
  { id: 'commercial', label: 'Commerce', icon: Building2 },
  { id: 'industrial', label: 'Industry', icon: Factory },
  { id: 'bulldoze', label: 'Clear', icon: Trash2 },
];

export function App() {
  const [game, setGame] = useState<GameState>(() => initialGame());
  const [tool, setTool] = useState<Tool>('inspect');
  const [screen, setScreen] = useState<'menu' | 'game' | 'credits'>('menu');
  const [camera, setCamera] = useState<Camera>(() => defaultCamera(game));
  const [undoStack, setUndoStack] = useState<GameState[]>([]);
  const [redoStack, setRedoStack] = useState<GameState[]>([]);
  const gameRef = useRef(game);
  gameRef.current = game;

  const commitGame = (update: (current: GameState) => GameState) => {
    setGame((current) => {
      const next = update(current);
      if (next === current) return current;
      setUndoStack((stack) => [...stack.slice(-24), current]);
      setRedoStack([]);
      return next;
    });
  };

  const replaceWorld = (next: GameState) => {
    setGame(next);
    setUndoStack([]);
    setRedoStack([]);
    setCamera(defaultCamera(next));
  };

  useEffect(() => {
    if (screen !== 'game') return undefined;
    const id = window.setInterval(() => {
      setGame((current) => current.clock.paused || current.clock.speed === 0 ? current : tickGame(current, current.clock.speed || 1));
    }, 220);
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

  const selectedTile = useMemo(() => {
    if (!game.selectedId?.includes(',')) return undefined;
    const [x, y] = game.selectedId.split(',').map(Number);
    return tileAtGame(game, x, y);
  }, [game.selectedId, game.tiles, game.width, game.height]);
  const selectedStation = game.stations.find((station) => station.id === game.selectedId);
  const date = `${game.clock.year}-${String(game.clock.month).padStart(2, '0')}-${String(game.clock.day).padStart(2, '0')} ${String(game.clock.hour).padStart(2, '0')}:00`;

  if (screen === 'credits') {
    return (
      <main className="menu">
        <section className="menu-panel">
          <h1>Credits</h1>
          <p>Tycoon v1 prototype. Design inspired by Japanese rail and urban development simulations. Pixel tiles are rendered from a curated in-app sprite registry.</p>
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
            <button onClick={() => { replaceWorld(createGame(`world-${Date.now()}`)); setScreen('game'); }}>New Seeded World</button>
            <button onClick={() => { const loaded = loadGame(); if (loaded) replaceWorld(loaded); setScreen('game'); }}><Save size={18} /> Last Save</button>
            <button onClick={() => setScreen('credits')}>Credits</button>
          </div>
          <div className="save-list">
            <strong>Previous worlds</strong>
            {saves.length === 0 ? <span>No local saves yet.</span> : saves.map((seed) => <button key={seed} onClick={() => { replaceWorld(createGame(seed)); setScreen('game'); }}>{seed}</button>)}
            <strong>Connected multiplayer</strong>
            <ConnectedWorlds onOpen={(world) => { replaceWorld(joinWorld(world)); setScreen('game'); }} />
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
        <button aria-label="Undo" disabled={undoStack.length === 0} title="Undo" onClick={() => {
          setUndoStack((stack) => {
            const previous = stack[stack.length - 1];
            if (!previous) return stack;
            setRedoStack((redo) => [...redo, gameRef.current]);
            setGame(previous);
            return stack.slice(0, -1);
          });
        }}><Undo2 size={17} /></button>
        <button aria-label="Redo" disabled={redoStack.length === 0} title="Redo" onClick={() => {
          setRedoStack((stack) => {
            const next = stack[stack.length - 1];
            if (!next) return stack;
            setUndoStack((undo) => [...undo, gameRef.current]);
            setGame(next);
            return stack.slice(0, -1);
          });
        }}><Redo2 size={17} /></button>
        <button onClick={() => { saveGame(game); setGame((current) => ({ ...current, log: ['Game saved locally.', ...current.log].slice(0, 8) })); }}><Save size={17} /> Save</button>
        <button onClick={() => commitGame((current) => rememberConnectedWorld(startMultiplayer(current)))}><Share2 size={17} /> Share</button>
      </header>

      <aside className="toolbar">
        {tools.map(({ id, label, icon: Icon }) => (
          <button aria-label={label} className={tool === id ? 'active' : ''} data-tooltip={label} key={id} title={label} onClick={() => setTool(id)}><Icon size={20} /></button>
        ))}
      </aside>

      <PixiMap
        game={game}
        tool={tool}
        camera={camera}
        onCameraChange={setCamera}
        onApplyTool={(selectedTool, x, y) => commitGame((current) => applyTool(current, selectedTool, x, y))}
        onApplyToolLine={(selectedTool, ax, ay, bx, by) => commitGame((current) => applyToolLine(current, selectedTool, ax, ay, bx, by))}
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
          <MiniMap camera={camera} game={game} onJump={(x, y) => setCamera((current) => cameraForTile(clampMinimapJumpX(x, current.zoom, game), clampMinimapJumpY(y, current.zoom, game), current.zoom))} />
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

function defaultCamera(game: GameState): Camera {
  return cameraForTile(Math.floor(game.width / 2), Math.floor(game.height / 2), 2);
}

function cameraForTile(x: number, y: number, zoom: number): Camera {
  const viewportCenterY = typeof window === 'undefined' ? 360 : Math.max(280, (window.innerHeight - 52) / 2);
  return {
    zoom,
    x: -(x - y) * (TILE_W / 2) * zoom,
    y: viewportCenterY - 40 - (x + y) * (TILE_H / 2) * zoom,
  };
}

function clampMinimapJumpX(x: number, zoom: number, game: GameState): number {
  const margin = minimapJumpMargin(zoom);
  return Math.max(margin, Math.min(game.width - 1 - margin, x));
}

function clampMinimapJumpY(y: number, zoom: number, game: GameState): number {
  const margin = minimapJumpMargin(zoom);
  return Math.max(margin, Math.min(game.height - 1 - margin, y));
}

function minimapJumpMargin(zoom: number): number {
  const viewport = typeof document === 'undefined' ? undefined : document.querySelector('.game-viewport');
  const width = viewport instanceof HTMLElement ? viewport.clientWidth : Math.max(1, window.innerWidth - 374);
  const height = viewport instanceof HTMLElement ? viewport.clientHeight : Math.max(1, window.innerHeight - 52);
  const xRadius = width / (TILE_W * zoom);
  const yRadius = height / (TILE_H * zoom);
  return Math.max(4, Math.ceil((xRadius + yRadius) / 2));
}

function tileAtGame(game: GameState, x: number, y: number): Tile | undefined {
  if (x < 0 || y < 0 || x >= game.width || y >= game.height) return undefined;
  return game.tiles[y * game.width + x];
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

function MiniMap({ camera, game, onJump }: { camera: Camera; game: GameState; onJump: (x: number, y: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = game.width;
    canvas.height = game.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    const image = ctx.createImageData(game.width, game.height);
    for (const tile of game.tiles) {
      const [r, g, b] = minimapColor(tile);
      const index = (tile.y * game.width + tile.x) * 4;
      image.data[index] = r;
      image.data[index + 1] = g;
      image.data[index + 2] = b;
      image.data[index + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    drawMinimapViewport(ctx, game, camera);
  }, [camera, game.tiles, game.width, game.height]);

  const jumpFromPointer = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(game.width - 1, Math.floor((event.clientX - rect.left) / rect.width * game.width)));
    const y = Math.max(0, Math.min(game.height - 1, Math.floor((event.clientY - rect.top) / rect.height * game.height)));
    onJump(x, y);
  };

  return (
    <canvas
      ref={canvasRef}
      aria-label="Map overview"
      className="minimap"
      role="button"
      tabIndex={0}
      title="Map overview"
      onPointerDown={jumpFromPointer}
    />
  );
}

function drawMinimapViewport(ctx: CanvasRenderingContext2D, game: GameState, camera: Camera): void {
  const viewport = document.querySelector('.game-viewport');
  const viewportWidth = viewport instanceof HTMLElement ? viewport.clientWidth : Math.max(1, window.innerWidth - 374);
  const viewportHeight = viewport instanceof HTMLElement ? viewport.clientHeight : Math.max(1, window.innerHeight - 52);
  const originX = viewportWidth / 2 + camera.x;
  const originY = 40 + camera.y;
  const corners = [
    screenToWorldFloat(0, 0, originX, originY, camera.zoom),
    screenToWorldFloat(viewportWidth, 0, originX, originY, camera.zoom),
    screenToWorldFloat(viewportWidth, viewportHeight, originX, originY, camera.zoom),
    screenToWorldFloat(0, viewportHeight, originX, originY, camera.zoom),
  ].map((point) => ({
    x: Math.max(0, Math.min(game.width, point.x)),
    y: Math.max(0, Math.min(game.height, point.y)),
  }));
  ctx.save();
  ctx.strokeStyle = '#d83232';
  ctx.lineWidth = Math.max(1.5, game.width / 180);
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (const corner of corners.slice(1)) ctx.lineTo(corner.x, corner.y);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function minimapColor(tile: Tile): [number, number, number] {
  if (tile.overlay === 'rail' || tile.overlay === 'station' || tile.overlay === 'depot' || tile.overlay === 'crossing') return [39, 42, 50];
  if (tile.overlay === 'elevatedRail' || tile.overlay === 'bridge' || tile.overlay === 'monorail') return [45, 50, 56];
  if (tile.overlay === 'port') return [79, 101, 113];
  if (tile.overlay === 'airport') return [51, 57, 64];
  if (tile.overlay === 'road') return [214, 211, 184];
  if (tile.zone === 'residential') return [217, 200, 137];
  if (tile.zone === 'commercial') return [138, 176, 196];
  if (tile.zone === 'industrial') return [138, 141, 140];
  if (tile.terrain === 'water') return [79, 131, 165];
  if (tile.terrain === 'coast') return [181, 177, 122];
  if (tile.terrain === 'forest') return [63, 122, 70];
  if (tile.terrain === 'farm') return [91, 142, 78];
  return [123, 151, 95];
}
