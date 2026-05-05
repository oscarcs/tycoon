import { buildingName, stationName } from './names';
import { Rng } from './random';
import { findRailPath, tileAt } from './pathfinding';
import type { GameState, Overlay, Station, Tile, Tool, Train, Zone } from './types';

const MAP_W = 52;
const MAP_H = 52;
const DAY_MONTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function createGame(seed = `tycoon-${Date.now()}`): GameState {
  const rng = new Rng(seed);
  const tiles: Tile[] = [];
  const centers = Array.from({ length: 4 }, () => ({ x: rng.int(8, MAP_W - 9), y: rng.int(8, MAP_H - 9), power: rng.int(5, 9) }));
  for (let y = 0; y < MAP_H; y += 1) {
    for (let x = 0; x < MAP_W; x += 1) {
      const nx = x / MAP_W - 0.5;
      const ny = y / MAP_H - 0.5;
      const island = 0.48 - Math.sqrt(nx * nx + ny * ny) + fbm(x, y, seed) * 0.28;
      let terrain: Tile['terrain'] = island < 0.02 ? 'water' : island < 0.09 ? 'coast' : rng.chance(0.08) ? 'forest' : 'farm';
      let zone: Zone = 'none';
      let development = 0;
      for (const center of centers) {
        const dist = Math.hypot(center.x - x, center.y - y);
        if (dist < center.power && terrain !== 'water') {
          development = Math.max(development, Math.round((1 - dist / center.power) * 3));
          zone = development > 2 ? 'commercial' : rng.chance(0.68) ? 'residential' : 'commercial';
          terrain = 'land';
        }
      }
      if (terrain !== 'water' && zone === 'none' && rng.chance(0.035)) {
        zone = 'industrial';
        terrain = 'land';
        development = rng.int(1, 2);
      }
      tiles.push(makeTile(rng, x, y, terrain, zone, development));
    }
  }

  const state: GameState = {
    seed,
    width: MAP_W,
    height: MAP_H,
    tiles,
    stations: [],
    trains: [],
    company: {
      cash: 3_200_000,
      lifetimeRevenue: 0,
      lifetimeExpenses: 0,
      loans: [{ principal: 5_000_000, interestRate: 0.045, daysRemaining: 3650 }],
    },
    clock: { day: 1, month: 4, year: 1989, hour: 6, tick: 0, speed: 1, paused: false },
    log: ['Company founded with a long-term development loan.'],
    multiplayer: { mode: 'solo', worldId: worldId(seed), peers: [] },
  };
  seedStarterRail(state, rng);
  return state;
}

function makeTile(rng: Rng, x: number, y: number, terrain: Tile['terrain'], zone: Zone, development: number): Tile {
  const landValue = terrain === 'water' ? 0 : 550 + development * 900 + (zone === 'commercial' ? 800 : zone === 'industrial' ? 500 : 0);
  return {
    x,
    y,
    terrain,
    height: 0,
    zone,
    overlay: 'none',
    development,
    passengers: zone === 'residential' ? development * rng.int(8, 22) : zone === 'commercial' ? development * rng.int(4, 14) : 0,
    cargo: zone === 'industrial' ? development * rng.int(8, 20) : 0,
    landValue,
    buildingName: zone === 'none' ? undefined : buildingName(rng, zone),
    palettePhase: rng.int(0, 3),
  };
}

function seedStarterRail(state: GameState, rng: Rng): void {
  const towns = state.tiles.filter((tile) => tile.development >= 2 && tile.terrain !== 'water').slice(0, 2);
  if (towns.length < 2) return;
  const [a, b] = towns;
  layLine(state, a.x, a.y, b.x, b.y, 'rail', 0);
  placeStation(state, a.x, a.y, rng);
  placeStation(state, b.x, b.y, rng);
  addTrain(state);
}

export function applyTool(state: GameState, tool: Tool, x: number, y: number): GameState {
  const next = cloneState(state);
  const tile = tileAt(next, x, y);
  if (!tile) return state;
  const rng = new Rng(`${next.seed}:${next.clock.tick}:${x}:${y}`);
  if (tool === 'inspect') {
    next.selectedId = `${x},${y}`;
    return next;
  }
  if (tool === 'bulldoze') {
    charge(next, tile.overlay === 'none' ? 1_500 : 8_000, `Cleared ${x},${y}`);
    tile.overlay = 'none';
    return next;
  }
  if (tool === 'rail' || tool === 'road' || tool === 'elevatedRail' || tool === 'bridge' || tool === 'monorail') {
    if (tile.terrain === 'water' && tool !== 'rail' && tool !== 'bridge') return log(next, 'Use bridges for open-water crossings.');
    if (tool === 'elevatedRail') tile.height = 1;
    tile.overlay = overlayWithCrossing(tile.overlay, tool === 'elevatedRail' ? 'rail' : tool === 'bridge' ? 'rail' : tool === 'monorail' ? 'rail' : tool);
    if (tool === 'elevatedRail' || tool === 'bridge' || tool === 'monorail') tile.overlay = tool;
    charge(next, tile.terrain === 'water' || tool === 'bridge' ? 70_000 : tool === 'elevatedRail' ? 54_000 : tool === 'monorail' ? 62_000 : tool === 'rail' ? 22_000 : 12_000, `${tool} construction`);
    return next;
  }
  if (tool === 'port') {
    if (!tilesInRadius(next, x, y, 2).some((candidate) => candidate.terrain === 'water')) return log(next, 'Ports need shoreline access.');
    buildPort(next, x, y);
    charge(next, 620_000, 'Port terminal construction');
    return next;
  }
  if (tool === 'airport') {
    if (tilesInRadius(next, x, y, 3).some((candidate) => candidate.terrain === 'water')) return log(next, 'Airports need dry inland land.');
    buildAirport(next, x, y);
    charge(next, 1_400_000, 'Regional airport construction');
    return next;
  }
  if (tool === 'station') {
    if (tile.overlay !== 'rail') return log(next, 'Stations must be placed on rail.');
    placeStation(next, x, y, rng);
    charge(next, 180_000 + tile.landValue * 8, 'Station construction and land acquisition');
    return next;
  }
  if (tool === 'depot') {
    if (tile.overlay !== 'rail') return log(next, 'Depots must connect to rail.');
    tile.overlay = 'depot';
    charge(next, 260_000, 'Depot and first consist');
    addTrain(next);
    return next;
  }
  if (tool === 'purchase') {
    if (tile.terrain === 'water') return log(next, 'Cannot purchase open water.');
    tile.overlay = 'purchased';
    charge(next, Math.round(tile.landValue * 15), 'Land purchased for cargo staging');
    return next;
  }
  if (tool === 'residential' || tool === 'commercial' || tool === 'industrial') {
    zoneTile(tile, tool, rng);
    charge(next, tool === 'industrial' ? 140_000 : 110_000, `${tool} development`);
    return next;
  }
  return next;
}

function layLine(state: GameState, ax: number, ay: number, bx: number, by: number, overlay: 'rail' | 'road', cost: number): void {
  let x = ax;
  let y = ay;
  while (x !== bx || y !== by) {
    const tile = tileAt(state, x, y);
    if (tile && tile.terrain !== 'water') tile.overlay = overlayWithCrossing(tile.overlay, overlay);
    if (x !== bx) x += Math.sign(bx - x);
    else y += Math.sign(by - y);
  }
  const end = tileAt(state, bx, by);
  if (end) end.overlay = overlayWithCrossing(end.overlay, overlay);
  if (cost > 0) charge(state, cost, 'Autolined corridor');
}

function overlayWithCrossing(current: Overlay, next: 'rail' | 'road'): Overlay {
  if ((current === 'rail' && next === 'road') || (current === 'road' && next === 'rail')) return 'crossing';
  return next;
}

function buildPort(state: GameState, x: number, y: number): void {
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      const tile = tileAt(state, x + dx, y + dy);
      if (!tile) continue;
      tile.overlay = tile.terrain === 'water' ? 'bridge' : 'port';
      if (tile.terrain !== 'water') {
        tile.zone = 'industrial';
        tile.development = Math.max(tile.development, 2);
        tile.cargo += 35;
      }
    }
  }
}

function buildAirport(state: GameState, x: number, y: number): void {
  for (let dx = -3; dx <= 3; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      const tile = tileAt(state, x + dx, y + dy);
      if (!tile || tile.terrain === 'water') continue;
      tile.terrain = 'land';
      tile.zone = dy === 0 ? 'none' : 'commercial';
      tile.overlay = 'airport';
      tile.development = Math.max(tile.development, dy === 0 ? 0 : 2);
      tile.passengers += dy === 0 ? 0 : 28;
    }
  }
}

function placeStation(state: GameState, x: number, y: number, rng: Rng): Station {
  const tile = tileAt(state, x, y)!;
  tile.overlay = 'station';
  const station: Station = {
    id: `st-${state.stations.length + 1}`,
    name: stationName(rng),
    x,
    y,
    radius: 5,
    passengersWaiting: 0,
    cargoWaiting: 0,
    maintenance: 3200,
  };
  state.stations.push(station);
  state.selectedId = station.id;
  log(state, `${station.name} opened.`);
  return station;
}

function addTrain(state: GameState): void {
  if (state.stations.length < 2) return;
  const first = state.stations[0];
  const second = state.stations[1];
  state.trains.push({
    id: `tr-${state.trains.length + 1}`,
    name: `Series ${100 + state.trains.length * 10}`,
    route: [first.id, second.id],
    routeIndex: 0,
    x: first.x,
    y: first.y,
    nextX: first.x,
    nextY: first.y,
    progress: 0,
    speed: 0.045,
    capacity: 180,
    cargoCapacity: 80,
    passengers: 0,
    cargo: 0,
    costPerDay: 18_000,
    revenue: 0,
  });
}

export function tickGame(state: GameState, ticks = 1): GameState {
  let next = cloneState(state);
  for (let i = 0; i < ticks; i += 1) {
    if (next.clock.paused) break;
    next.clock.tick += 1;
    advanceTrains(next);
    if (next.clock.tick % 8 === 0) growDemand(next);
    if (next.clock.tick % 24 === 0) advanceHour(next);
  }
  return next;
}

function advanceHour(state: GameState): void {
  state.clock.hour += 1;
  if (state.clock.hour < 24) return;
  state.clock.hour = 0;
  const dailyMaintenance = state.stations.reduce((sum, station) => sum + station.maintenance, 0) + state.trains.reduce((sum, train) => sum + train.costPerDay, 0);
  const loanInterest = state.company.loans.reduce((sum, loan) => sum + loan.principal * loan.interestRate / 365, 0);
  state.company.cash -= Math.round(dailyMaintenance + loanInterest);
  state.company.lifetimeExpenses += Math.round(dailyMaintenance + loanInterest);
  developAroundStations(state);
  state.clock.day += 1;
  const leap = state.clock.year % 4 === 0;
  const monthLength = state.clock.month === 2 && leap ? 29 : DAY_MONTHS[state.clock.month - 1];
  if (state.clock.day > monthLength) {
    state.clock.day = 1;
    state.clock.month += 1;
    if (state.clock.month > 12) {
      state.clock.month = 1;
      state.clock.year += 1;
    }
  }
}

function growDemand(state: GameState): void {
  for (const station of state.stations) {
    const tiles = tilesInRadius(state, station.x, station.y, station.radius);
    const nearbyStations = state.stations.filter((other) => other.id !== station.id && Math.hypot(other.x - station.x, other.y - station.y) < station.radius).length;
    const cannibalise = Math.max(0.45, 1 - nearbyStations * 0.22);
    station.passengersWaiting += Math.round(tiles.reduce((sum, tile) => sum + tile.passengers, 0) * 0.015 * cannibalise);
    station.cargoWaiting += Math.round(tiles.reduce((sum, tile) => sum + tile.cargo + (tile.overlay === 'purchased' ? 9 : 0), 0) * 0.02);
    station.passengersWaiting = Math.min(station.passengersWaiting, 4500);
    station.cargoWaiting = Math.min(station.cargoWaiting, 2200);
  }
}

function developAroundStations(state: GameState): void {
  const rng = new Rng(`${state.seed}:${state.clock.year}:${state.clock.day}`);
  for (const station of state.stations) {
    for (const tile of tilesInRadius(state, station.x, station.y, station.radius + 4)) {
      if (tile.terrain === 'water' || tile.overlay === 'rail' || tile.overlay === 'road' || tile.overlay === 'station') continue;
      const distance = Math.hypot(tile.x - station.x, tile.y - station.y);
      const served = Math.max(0, 1 - distance / (station.radius + 5));
      if (tile.zone === 'none' && rng.chance(served * 0.08)) zoneTile(tile, rng.chance(0.58) ? 'residential' : 'commercial', rng);
      if (tile.zone !== 'none' && tile.development < 5 && rng.chance(served * 0.09)) tile.development += 1;
      tile.passengers = tile.zone === 'residential' ? tile.development * 18 : tile.zone === 'commercial' ? tile.development * 10 : 0;
      tile.cargo = tile.zone === 'industrial' ? tile.development * 18 : 0;
      tile.landValue = Math.round(tile.landValue * (1 + served * 0.02));
    }
  }
}

function advanceTrains(state: GameState): void {
  for (const train of state.trains) {
    const currentStation = state.stations.find((station) => station.id === train.route[train.routeIndex]);
    const targetStation = state.stations.find((station) => station.id === train.route[(train.routeIndex + 1) % train.route.length]);
    if (!currentStation || !targetStation) continue;
    const start = tileAt(state, Math.round(train.x), Math.round(train.y));
    const goal = tileAt(state, targetStation.x, targetStation.y);
    if (!start || !goal) continue;
    const path = findRailPath(state, start, goal);
    if (path.length < 2) continue;
    const nextTile = path[1];
    const occupied = state.trains.some((other) => other.id !== train.id && Math.round(other.x) === nextTile.x && Math.round(other.y) === nextTile.y);
    if (occupied) continue;
    train.nextX = nextTile.x;
    train.nextY = nextTile.y;
    train.progress += train.speed * state.clock.speed;
    if (train.progress >= 1) {
      train.x = nextTile.x;
      train.y = nextTile.y;
      train.progress = 0;
      if (nextTile.x === targetStation.x && nextTile.y === targetStation.y) {
        unloadTrain(state, train, targetStation);
        boardTrain(train, targetStation);
        train.routeIndex = (train.routeIndex + 1) % train.route.length;
      }
    }
  }
}

function boardTrain(train: Train, station: Station): void {
  const passengers = Math.min(station.passengersWaiting, train.capacity - train.passengers);
  const cargo = Math.min(station.cargoWaiting, train.cargoCapacity - train.cargo);
  train.passengers += passengers;
  train.cargo += cargo;
  station.passengersWaiting -= passengers;
  station.cargoWaiting -= cargo;
}

function unloadTrain(state: GameState, train: Train, station: Station): void {
  const transferBonus = station.radius + state.stations.filter((other) => other.id !== station.id && Math.hypot(other.x - station.x, other.y - station.y) < station.radius * 2).length * 2;
  const revenue = train.passengers * (38 + transferBonus) + train.cargo * 95;
  train.revenue += revenue;
  state.company.cash += revenue;
  state.company.lifetimeRevenue += revenue;
  train.passengers = 0;
  train.cargo = 0;
}

function zoneTile(tile: Tile, zone: 'residential' | 'commercial' | 'industrial' | Zone, rng: Rng): void {
  if (tile.terrain === 'water') return;
  tile.terrain = 'land';
  tile.zone = zone as Zone;
  tile.development = Math.max(tile.development, 1);
  tile.buildingName = buildingName(rng, tile.zone);
  tile.passengers = tile.zone === 'residential' ? 18 : tile.zone === 'commercial' ? 10 : 0;
  tile.cargo = tile.zone === 'industrial' ? 18 : 0;
}

function tilesInRadius(state: GameState, x: number, y: number, radius: number): Tile[] {
  return state.tiles.filter((tile) => Math.hypot(tile.x - x, tile.y - y) <= radius);
}

function charge(state: GameState, amount: number, reason: string): void {
  state.company.cash -= amount;
  state.company.lifetimeExpenses += amount;
  log(state, `${reason}: -${formatMoney(amount)}`);
}

function log(state: GameState, message: string): GameState {
  state.log = [message, ...state.log].slice(0, 8);
  return state;
}

export function setSpeed(state: GameState, speed: number): GameState {
  const next = cloneState(state);
  next.clock.speed = speed;
  next.clock.paused = speed === 0;
  return next;
}

export function takeLoan(state: GameState, principal = 1_000_000): GameState {
  const next = cloneState(state);
  next.company.loans.push({ principal, interestRate: 0.055, daysRemaining: 1825 });
  next.company.cash += principal;
  return log(next, `Loan secured: ${formatMoney(principal)}`);
}

export function startMultiplayer(state: GameState): GameState {
  const next = cloneState(state);
  next.multiplayer = {
    mode: 'host',
    worldId: worldId(state.seed),
    inviteUrl: `${location.origin}?world=${worldId(state.seed)}&seed=${encodeURIComponent(state.seed)}`,
    lastSyncAt: Date.now(),
    peers: ['local-host'],
  };
  return log(next, 'Multiplayer room created. Cloudflare Durable Object sync endpoint is ready to bind.');
}

export function saveGame(state: GameState): void {
  localStorage.setItem('tycoon:last-save', JSON.stringify(state));
  const saves = JSON.parse(localStorage.getItem('tycoon:saves') ?? '[]') as string[];
  if (!saves.includes(state.seed)) localStorage.setItem('tycoon:saves', JSON.stringify([state.seed, ...saves].slice(0, 8)));
}

export function loadGame(): GameState | undefined {
  const raw = localStorage.getItem('tycoon:last-save');
  return raw ? JSON.parse(raw) as GameState : undefined;
}

export function cloneState(state: GameState): GameState {
  return structuredClone(state) as GameState;
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function worldId(seed: string): string {
  return btoa(seed).replace(/[^a-z0-9]/gi, '').slice(0, 10).toLowerCase() || 'world';
}

function fbm(x: number, y: number, seed: string): number {
  const a = new Rng(`${seed}:a:${Math.floor(x / 5)}:${Math.floor(y / 5)}`).next();
  const b = new Rng(`${seed}:b:${Math.floor(x / 11)}:${Math.floor(y / 11)}`).next();
  const c = new Rng(`${seed}:c:${Math.floor(x / 19)}:${Math.floor(y / 19)}`).next();
  return (a * 0.5 + b * 0.32 + c * 0.18) - 0.5;
}
