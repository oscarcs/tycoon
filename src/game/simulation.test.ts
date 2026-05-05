import { describe, expect, it } from 'vitest';
import { applyTool, applyToolLine, createGame, tickGame } from './simulation';
import { findRailPath, tileAt } from './pathfinding';

describe('simulation', () => {
  it('generates deterministic maps from a seed', () => {
    const a = createGame('same-seed');
    const b = createGame('same-seed');
    expect(a.tiles.map((tile) => `${tile.terrain}:${tile.zone}:${tile.development}`).slice(0, 80)).toEqual(
      b.tiles.map((tile) => `${tile.terrain}:${tile.zone}:${tile.development}`).slice(0, 80),
    );
  });

  it('starts with debt, stations, and a reachable starter rail route', () => {
    const game = createGame('rail-test');
    expect(game.company.loans[0].principal).toBeGreaterThan(0);
    expect(game.stations.length).toBeGreaterThanOrEqual(2);
    const start = tileAt(game, game.stations[0].x, game.stations[0].y)!;
    const goal = tileAt(game, game.stations[1].x, game.stations[1].y)!;
    expect(findRailPath(game, start, goal).length).toBeGreaterThan(1);
  });

  it('constructs rail, stations, and accumulates demand over ticks', () => {
    let game = createGame('tool-test');
    const rail = game.tiles.find((tile) => tile.terrain !== 'water')!;
    game = applyTool(game, 'rail', rail.x, rail.y);
    game = applyTool(game, 'station', rail.x, rail.y);
    game = tickGame(game, 80);
    expect(game.stations.some((station) => station.x === rail.x && station.y === rail.y)).toBe(true);
    expect(game.clock.tick).toBe(80);
  });

  it('treats diagonal rail as a first-class 8-way connection', () => {
    let game = createGame('diagonal-rail-test');
    game = applyToolLine(game, 'rail', 30, 30, 34, 34);
    const start = tileAt(game, 30, 30)!;
    const goal = tileAt(game, 34, 34)!;
    const path = findRailPath(game, start, goal).map((tile) => `${tile.x},${tile.y}`);
    expect(path).toEqual(['30,30', '31,31', '32,32', '33,33', '34,34']);
  });

  it('builds v1 special infrastructure procedurally', () => {
    let game = createGame('special-builds');
    const shore = game.tiles.find((tile) => tile.terrain !== 'water' && game.tiles.some((other) => other.terrain === 'water' && Math.hypot(other.x - tile.x, other.y - tile.y) <= 2))!;
    game = applyTool(game, 'port', shore.x, shore.y);
    expect(game.tiles.some((tile) => tile.overlay === 'port')).toBe(true);
    const inland = game.tiles.find((tile) => tile.terrain !== 'water' && !game.tiles.some((other) => other.terrain === 'water' && Math.hypot(other.x - tile.x, other.y - tile.y) <= 3))!;
    game = applyTool(game, 'airport', inland.x, inland.y);
    expect(game.tiles.some((tile) => tile.overlay === 'airport')).toBe(true);
    game = applyTool(game, 'monorail', inland.x + 4, inland.y);
    expect(game.tiles.some((tile) => tile.overlay === 'monorail')).toBe(true);
  });
});
