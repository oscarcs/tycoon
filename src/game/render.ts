import type { GameState, Tile, TileSprite } from './types';

export interface SpriteCatalog {
  base?: HTMLImageElement;
  water?: HTMLImageElement;
  railNS?: HTMLImageElement;
  railEW?: HTMLImageElement;
  railDiag?: HTMLImageElement;
  road?: HTMLImageElement;
  station?: HTMLImageElement;
  house?: HTMLImageElement;
  commercial?: HTMLImageElement;
  industry?: HTMLImageElement;
  forest?: HTMLImageElement;
  purchased?: HTMLImageElement;
}

export const TILE_W = 32;
export const TILE_H = 16;

export async function loadSprites(manifest: TileSprite[]): Promise<SpriteCatalog> {
  const byLabel = (text: string) => manifest.find((sprite) => sprite.label.toLowerCase().includes(text));
  const by = {
    base: byLabel('empty tile with outline'),
    water: manifest.find((sprite) => sprite.terrain === 'water'),
    railNS: manifest.find((sprite) => sprite.transport === 'rail' && sprite.connections.includes('N') && sprite.connections.includes('S')),
    railEW: manifest.find((sprite) => sprite.transport === 'rail' && sprite.connections.includes('E') && sprite.connections.includes('W')),
    railDiag: manifest.find((sprite) => sprite.transport === 'rail' && sprite.connections.includes('SE') && sprite.connections.includes('NW')),
    road: manifest.find((sprite) => sprite.transport === 'road'),
    station: byLabel('station') ?? byLabel('platform'),
    house: byLabel('small house') ?? byLabel('group of houses'),
    commercial: byLabel('tower') ?? byLabel('office'),
    industry: byLabel('factory') ?? byLabel('plant'),
    forest: byLabel('tree'),
    purchased: byLabel('dither'),
  };
  const entries = await Promise.all(Object.entries(by).map(async ([key, sprite]) => [key, sprite ? await loadImage(`/source_tileset/${sprite.filename}`) : undefined]));
  return Object.fromEntries(entries) as SpriteCatalog;
}

export function worldToScreen(x: number, y: number, originX: number, originY: number, zoom = 2): { x: number; y: number } {
  return {
    x: originX + (x - y) * (TILE_W / 2) * zoom,
    y: originY + (x + y) * (TILE_H / 2) * zoom,
  };
}

export function screenToWorld(screenX: number, screenY: number, originX: number, originY: number, zoom = 2): { x: number; y: number } {
  const x = (screenX - originX) / zoom;
  const y = (screenY - originY) / zoom;
  return {
    x: Math.floor((y / (TILE_H / 2) + x / (TILE_W / 2)) / 2),
    y: Math.floor((y / (TILE_H / 2) - x / (TILE_W / 2)) / 2),
  };
}

export function renderGame(ctx: CanvasRenderingContext2D, state: GameState, sprites: SpriteCatalog, camera: { x: number; y: number; zoom: number }, selected?: string): void {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = '#5f88a8';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  const originX = ctx.canvas.width / 2 + camera.x;
  const originY = 40 + camera.y;
  for (const tile of state.tiles) {
    drawTile(ctx, tile, sprites, originX, originY, camera.zoom, selected === `${tile.x},${tile.y}`);
  }
  for (const train of state.trains) {
    const ix = train.x + (train.nextX - train.x) * train.progress;
    const iy = train.y + (train.nextY - train.y) * train.progress;
    const p = worldToScreen(ix, iy, originX, originY, camera.zoom);
    ctx.fillStyle = '#262a33';
    ctx.fillRect(p.x - 14 * camera.zoom, p.y - 20 * camera.zoom, 28 * camera.zoom, 10 * camera.zoom);
    ctx.fillStyle = '#d64545';
    ctx.fillRect(p.x - 11 * camera.zoom, p.y - 18 * camera.zoom, 22 * camera.zoom, 5 * camera.zoom);
    ctx.fillStyle = '#f6d36f';
    ctx.fillRect(p.x - 7 * camera.zoom, p.y - 16 * camera.zoom, 4 * camera.zoom, 3 * camera.zoom);
    ctx.fillRect(p.x + 3 * camera.zoom, p.y - 16 * camera.zoom, 4 * camera.zoom, 3 * camera.zoom);
  }
}

function drawTile(ctx: CanvasRenderingContext2D, tile: Tile, sprites: SpriteCatalog, originX: number, originY: number, zoom: number, selected: boolean): void {
  const p = worldToScreen(tile.x, tile.y, originX, originY, zoom);
  const base = tile.terrain === 'water' ? sprites.water : sprites.base;
  if (base) drawImage(ctx, base, p.x, p.y, zoom);
  else diamond(ctx, p.x, p.y, zoom, tile.terrain === 'water' ? '#4f83a5' : tile.terrain === 'farm' ? '#8ba25d' : '#789b64');

  if (tile.terrain === 'coast') diamond(ctx, p.x, p.y, zoom, '#b5b17a88');
  if (tile.terrain === 'forest') drawObject(ctx, sprites.forest, p.x, p.y, zoom, '#3c6f3f');
  if (tile.zone === 'residential') drawObject(ctx, sprites.house, p.x, p.y, zoom, '#d9c889', tile.development);
  if (tile.zone === 'commercial') drawObject(ctx, sprites.commercial, p.x, p.y, zoom, '#9bb2c5', tile.development);
  if (tile.zone === 'industrial') drawObject(ctx, sprites.industry, p.x, p.y, zoom, '#8a8d8c', tile.development);
  if (tile.overlay === 'purchased') hatch(ctx, p.x, p.y, zoom);
  if (tile.overlay === 'rail' || tile.overlay === 'crossing') drawImage(ctx, sprites.railDiag ?? sprites.railNS, p.x, p.y, zoom);
  if (tile.overlay === 'elevatedRail' || tile.overlay === 'bridge') drawElevated(ctx, p.x, p.y, zoom, tile.overlay === 'bridge');
  if (tile.overlay === 'monorail') drawMonorail(ctx, p.x, p.y, zoom);
  if (tile.overlay === 'road' || tile.overlay === 'crossing') drawRoad(ctx, p.x, p.y, zoom);
  if (tile.overlay === 'station') drawObject(ctx, sprites.station, p.x, p.y, zoom, '#6c536c');
  if (tile.overlay === 'depot') drawObject(ctx, sprites.industry, p.x, p.y, zoom, '#524d47');
  if (tile.overlay === 'port') drawObject(ctx, sprites.industry, p.x, p.y, zoom, '#4f6571');
  if (tile.overlay === 'airport') drawAirport(ctx, p.x, p.y, zoom);
  if (selected) {
    ctx.strokeStyle = '#fff2a8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - TILE_H * zoom / 2);
    ctx.lineTo(p.x + TILE_W * zoom / 2, p.y);
    ctx.lineTo(p.x, p.y + TILE_H * zoom / 2);
    ctx.lineTo(p.x - TILE_W * zoom / 2, p.y);
    ctx.closePath();
    ctx.stroke();
  }
}

function drawImage(ctx: CanvasRenderingContext2D, image: HTMLImageElement | undefined, x: number, y: number, zoom: number): void {
  if (!image) return;
  ctx.drawImage(image, Math.round(x - image.width * zoom / 2), Math.round(y - image.height * zoom + TILE_H * zoom / 2), image.width * zoom, image.height * zoom);
}

function drawObject(ctx: CanvasRenderingContext2D, image: HTMLImageElement | undefined, x: number, y: number, zoom: number, fallback: string, stack = 1): void {
  if (image) {
    const count = Math.min(3, Math.max(1, Math.ceil(stack / 2)));
    for (let i = 0; i < count; i += 1) drawImage(ctx, image, x, y - i * 8 * zoom, zoom);
    return;
  }
  ctx.fillStyle = fallback;
  ctx.fillRect(x - 7 * zoom, y - (14 + stack * 4) * zoom, 14 * zoom, (12 + stack * 4) * zoom);
}

function diamond(ctx: CanvasRenderingContext2D, x: number, y: number, zoom: number, fill: string): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x, y - TILE_H * zoom / 2);
  ctx.lineTo(x + TILE_W * zoom / 2, y);
  ctx.lineTo(x, y + TILE_H * zoom / 2);
  ctx.lineTo(x - TILE_W * zoom / 2, y);
  ctx.closePath();
  ctx.fill();
}

function drawRoad(ctx: CanvasRenderingContext2D, x: number, y: number, zoom: number): void {
  ctx.strokeStyle = '#53545a';
  ctx.lineWidth = 5 * zoom;
  ctx.beginPath();
  ctx.moveTo(x - 13 * zoom, y);
  ctx.lineTo(x + 13 * zoom, y);
  ctx.stroke();
  ctx.strokeStyle = '#e2d28a';
  ctx.lineWidth = zoom;
  ctx.stroke();
}

function drawElevated(ctx: CanvasRenderingContext2D, x: number, y: number, zoom: number, bridge: boolean): void {
  ctx.strokeStyle = bridge ? '#6b6f76' : '#474d55';
  ctx.lineWidth = 3 * zoom;
  ctx.beginPath();
  ctx.moveTo(x - 13 * zoom, y - 12 * zoom);
  ctx.lineTo(x + 13 * zoom, y - 12 * zoom);
  ctx.stroke();
  ctx.strokeStyle = '#2e3338';
  ctx.lineWidth = zoom;
  ctx.stroke();
  ctx.fillStyle = '#6f7478';
  ctx.fillRect(x - 2 * zoom, y - 11 * zoom, 4 * zoom, 15 * zoom);
}

function drawMonorail(ctx: CanvasRenderingContext2D, x: number, y: number, zoom: number): void {
  ctx.strokeStyle = '#ede5cf';
  ctx.lineWidth = 4 * zoom;
  ctx.beginPath();
  ctx.moveTo(x - 13 * zoom, y - 16 * zoom);
  ctx.lineTo(x + 13 * zoom, y - 16 * zoom);
  ctx.stroke();
  ctx.strokeStyle = '#4f6571';
  ctx.lineWidth = zoom;
  ctx.stroke();
  ctx.fillStyle = '#8a8d8c';
  ctx.fillRect(x - zoom, y - 15 * zoom, 2 * zoom, 19 * zoom);
}

function drawAirport(ctx: CanvasRenderingContext2D, x: number, y: number, zoom: number): void {
  ctx.strokeStyle = '#333940';
  ctx.lineWidth = 5 * zoom;
  ctx.beginPath();
  ctx.moveTo(x - 13 * zoom, y);
  ctx.lineTo(x + 13 * zoom, y);
  ctx.stroke();
  ctx.strokeStyle = '#f6f0df';
  ctx.lineWidth = zoom;
  ctx.setLineDash([4 * zoom, 4 * zoom]);
  ctx.stroke();
  ctx.setLineDash([]);
}

function hatch(ctx: CanvasRenderingContext2D, x: number, y: number, zoom: number): void {
  ctx.strokeStyle = '#f4e5a5';
  ctx.lineWidth = zoom;
  for (let i = -10; i <= 10; i += 6) {
    ctx.beginPath();
    ctx.moveTo(x + i * zoom, y - 5 * zoom);
    ctx.lineTo(x + (i + 6) * zoom, y + 5 * zoom);
    ctx.stroke();
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}
