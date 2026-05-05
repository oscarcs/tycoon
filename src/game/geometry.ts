export const TILE_W = 32;
export const TILE_H = 16;

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export interface TilePoint {
  x: number;
  y: number;
}

export function worldToScreen(x: number, y: number, originX: number, originY: number, zoom = 2): { x: number; y: number } {
  return {
    x: originX + (x - y) * (TILE_W / 2) * zoom,
    y: originY + (x + y) * (TILE_H / 2) * zoom,
  };
}

export function screenToWorld(screenX: number, screenY: number, originX: number, originY: number, zoom = 2): TilePoint {
  const point = screenToWorldFloat(screenX, screenY, originX, originY, zoom);
  return {
    x: Math.floor(point.x),
    y: Math.floor(point.y),
  };
}

export function screenToWorldFloat(screenX: number, screenY: number, originX: number, originY: number, zoom = 2): { x: number; y: number } {
  const x = (screenX - originX) / zoom;
  const y = (screenY - originY) / zoom;
  return {
    x: (y / (TILE_H / 2) + x / (TILE_W / 2)) / 2,
    y: (y / (TILE_H / 2) - x / (TILE_W / 2)) / 2,
  };
}

export function linePoints(ax: number, ay: number, bx: number, by: number): TilePoint[] {
  const points: TilePoint[] = [];
  let x = ax;
  let y = ay;
  while (x !== bx || y !== by) {
    points.push({ x, y });
    const dx = bx - x;
    const dy = by - y;
    if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) x += Math.sign(dx);
    else if (dy !== 0) y += Math.sign(dy);
  }
  points.push({ x: bx, y: by });
  return points;
}

export function linePoints8(ax: number, ay: number, bx: number, by: number): TilePoint[] {
  const points: TilePoint[] = [];
  let x = ax;
  let y = ay;
  while (x !== bx || y !== by) {
    points.push({ x, y });
    if (x !== bx) x += Math.sign(bx - x);
    if (y !== by) y += Math.sign(by - y);
  }
  points.push({ x: bx, y: by });
  return points;
}

export function tileId(x: number, y: number): string {
  return `${x},${y}`;
}
