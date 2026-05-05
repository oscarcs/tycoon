export type Direction = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';
export type Terrain = 'land' | 'water' | 'coast' | 'farm' | 'forest';
export type Zone = 'none' | 'residential' | 'commercial' | 'industrial';
export type Overlay = 'none' | 'rail' | 'road' | 'station' | 'depot' | 'crossing' | 'purchased' | 'port' | 'airport' | 'elevatedRail' | 'bridge' | 'monorail';
export type Tool = 'inspect' | 'rail' | 'road' | 'station' | 'depot' | 'bulldoze' | 'purchase' | 'residential' | 'commercial' | 'industrial' | 'elevatedRail' | 'bridge' | 'monorail' | 'port' | 'airport';

export interface Tile {
  x: number;
  y: number;
  terrain: Terrain;
  height: number;
  zone: Zone;
  overlay: Overlay;
  development: number;
  passengers: number;
  cargo: number;
  landValue: number;
  buildingName?: string;
  palettePhase: number;
}

export interface Station {
  id: string;
  name: string;
  x: number;
  y: number;
  radius: number;
  passengersWaiting: number;
  cargoWaiting: number;
  maintenance: number;
}

export interface Train {
  id: string;
  name: string;
  route: string[];
  routeIndex: number;
  x: number;
  y: number;
  nextX: number;
  nextY: number;
  progress: number;
  speed: number;
  capacity: number;
  cargoCapacity: number;
  passengers: number;
  cargo: number;
  costPerDay: number;
  revenue: number;
}

export interface Loan {
  principal: number;
  interestRate: number;
  daysRemaining: number;
}

export interface Company {
  cash: number;
  lifetimeRevenue: number;
  lifetimeExpenses: number;
  loans: Loan[];
}

export interface Clock {
  day: number;
  month: number;
  year: number;
  hour: number;
  tick: number;
  speed: number;
  paused: boolean;
}

export interface GameState {
  seed: string;
  width: number;
  height: number;
  tiles: Tile[];
  stations: Station[];
  trains: Train[];
  company: Company;
  clock: Clock;
  selectedId?: string;
  log: string[];
  multiplayer: MultiplayerSession;
}

export interface MultiplayerSession {
  mode: 'solo' | 'host' | 'joined';
  worldId: string;
  inviteUrl?: string;
  lastSyncAt?: number;
  peers: string[];
}

export interface TileSprite {
  filename: string;
  label: string;
  category: string;
  transport: string;
  terrain: string;
  connections: Direction[];
  waterOnly: boolean;
  width: number;
  height: number;
}
