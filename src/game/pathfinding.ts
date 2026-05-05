import type { GameState, Tile } from './types';

const railDirs = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
];

export function tileAt(state: GameState, x: number, y: number): Tile | undefined {
  if (x < 0 || y < 0 || x >= state.width || y >= state.height) return undefined;
  return state.tiles[y * state.width + x];
}

export function neighbors(state: GameState, tile: Tile): Tile[] {
  return railDirs
    .map(([dx, dy]) => tileAt(state, tile.x + dx, tile.y + dy))
    .filter((candidate): candidate is Tile => Boolean(candidate));
}

export function findRailPath(state: GameState, start: Tile, goal: Tile): Tile[] {
  const queue: Tile[] = [start];
  const cameFrom = new Map<string, string | null>([[key(start.x, start.y), null]]);
  const lookup = new Map<string, Tile>([[key(start.x, start.y), start]]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.x === goal.x && current.y === goal.y) break;
    for (const next of neighbors(state, current)) {
      if (next.overlay !== 'rail' && next.overlay !== 'station' && next.overlay !== 'depot' && next.overlay !== 'crossing' && next.overlay !== 'elevatedRail' && next.overlay !== 'bridge') continue;
      const nextKey = key(next.x, next.y);
      if (cameFrom.has(nextKey)) continue;
      cameFrom.set(nextKey, key(current.x, current.y));
      lookup.set(nextKey, next);
      queue.push(next);
    }
  }

  const path: Tile[] = [];
  let cursor: string | null = key(goal.x, goal.y);
  if (!cameFrom.has(cursor)) return [];
  while (cursor) {
    const tile = lookup.get(cursor);
    if (tile) path.unshift(tile);
    cursor = cameFrom.get(cursor) ?? null;
  }
  return path;
}

export function key(x: number, y: number): string {
  return `${x},${y}`;
}
