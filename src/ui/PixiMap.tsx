import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react';
import { Application, Assets, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { TILE_H, TILE_W, type Camera, type TilePoint, linePoints, linePoints8, screenToWorld, screenToWorldFloat, tileId, worldToScreen } from '../game/geometry';
import { SPRITE_DATA, type SpriteDef } from '../game/spriteData';
import type { Direction, GameState, Overlay, Tile, Tool } from '../game/types';

interface PixiMapProps {
  game: GameState;
  tool: Tool;
  camera: Camera;
  onCameraChange: (camera: Camera) => void;
  onApplyTool: (tool: Tool, x: number, y: number) => void;
  onApplyToolLine: (tool: Tool, ax: number, ay: number, bx: number, by: number) => void;
}

interface TextureAsset {
  texture: Texture;
  flipX?: boolean;
  flipY?: boolean;
}

interface PixiCatalog {
  base: Texture;
  water: Texture;
  farm: Texture[];
  farmHouse: Texture;
  forest: Texture[];
  roadByKey: Record<string, TextureAsset>;
  railByKey: Record<string, TextureAsset>;
  monorailByKey: Record<string, TextureAsset>;
  station: Texture;
  depot: Texture;
  port: Texture[];
  airport: Texture;
  residential: Texture[];
  commercialLow: Texture[];
  commercialMid: Texture[];
  stackable: Texture[];
  roofCaps: Texture[];
  industry: Texture[];
  warehouse: Record<'roof' | 'front' | 'wallRoof' | 'wallFront', Texture>;
  purchased: Texture;
}

interface VisibleTile {
  tile: Tile;
  x: number;
  y: number;
}

interface PixiLayers {
  staticLayer: Container;
  dynamicLayer: Container;
  staticKey: string;
  visibleTiles: number;
}

type RenderStatsWindow = Window & {
  __TYCOON_RENDER_STATS__?: {
    visibleTiles: number;
    displayObjects: number;
    worldTiles: number;
  };
};

const DIR_ORDER: Direction[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const ROAD_DIRS: Array<{ dx: number; dy: number; dir: Direction }> = [
  { dx: 0, dy: -1, dir: 'NE' },
  { dx: 1, dy: 0, dir: 'SE' },
  { dx: 0, dy: 1, dir: 'SW' },
  { dx: -1, dy: 0, dir: 'NW' },
];
const RAIL_DIRS: Array<{ dx: number; dy: number; dir: Direction }> = [
  { dx: -1, dy: -1, dir: 'N' },
  { dx: 0, dy: -1, dir: 'NE' },
  { dx: 1, dy: -1, dir: 'E' },
  { dx: 1, dy: 0, dir: 'SE' },
  { dx: 1, dy: 1, dir: 'S' },
  { dx: 0, dy: 1, dir: 'SW' },
  { dx: -1, dy: 1, dir: 'W' },
  { dx: -1, dy: 0, dir: 'NW' },
];
const WATER_BACKGROUND = 0x426d8c;

export function PixiMap({ game, tool, camera, onCameraChange, onApplyTool, onApplyToolLine }: PixiMapProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const catalogRef = useRef<PixiCatalog | null>(null);
  const layersRef = useRef<PixiLayers | null>(null);
  const dragRef = useRef<{ pointerId: number; startClientX: number; startClientY: number; lastClientX: number; lastClientY: number; startTile: TilePoint; moved: boolean } | null>(null);
  const [previewLine, setPreviewLine] = useState<TilePoint[]>([]);
  const lineTool = isLineTool(tool);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const host = hostRef.current;
      if (!host) return;
      const app = new Application();
      await app.init({
        resizeTo: host,
        background: WATER_BACKGROUND,
        antialias: false,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
      });
      if (cancelled) {
        app.destroy({ removeView: true }, { children: true });
        return;
      }
      app.canvas.className = 'pixi-canvas';
      app.canvas.style.imageRendering = 'pixelated';
      host.appendChild(app.canvas);
      appRef.current = app;
      layersRef.current = createPixiLayers(app);
      catalogRef.current = await loadPixiCatalog();
      if (!cancelled && layersRef.current) renderPixi(app, layersRef.current, game, catalogRef.current, camera, game.selectedId, previewLine, tool);
    }
    init();
    return () => {
      cancelled = true;
      appRef.current?.destroy({ removeView: true }, { children: true });
      appRef.current = null;
      catalogRef.current = null;
      layersRef.current = null;
    };
  }, []);

  useEffect(() => {
    const app = appRef.current;
    const catalog = catalogRef.current;
    const layers = layersRef.current;
    if (!app || !catalog || !layers) return;
    renderPixi(app, layers, game, catalog, camera, game.selectedId, previewLine, tool);
  }, [game, camera, previewLine, tool]);

  useEffect(() => {
    const cancelDrag = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !dragRef.current) return;
      const host = hostRef.current;
      if (host?.hasPointerCapture(dragRef.current.pointerId)) host.releasePointerCapture(dragRef.current.pointerId);
      dragRef.current = null;
      setPreviewLine([]);
    };
    window.addEventListener('keydown', cancelDrag);
    return () => window.removeEventListener('keydown', cancelDrag);
  }, []);

  const pointFromEvent = (event: ReactPointerEvent<HTMLDivElement> | ReactWheelEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      rect,
      screenX: event.clientX - rect.left,
      screenY: event.clientY - rect.top,
    };
  };

  const tileFromEvent = (event: ReactPointerEvent<HTMLDivElement>) => {
    const { rect, screenX, screenY } = pointFromEvent(event);
    return screenToWorld(screenX, screenY, rect.width / 2 + camera.x, 40 + camera.y, camera.zoom);
  };

  return (
    <div
      ref={hostRef}
      className="game-viewport"
      onWheel={(event) => {
        event.preventDefault();
        const { rect } = pointFromEvent(event);
        const nextZoom = Math.min(4, Math.max(1, camera.zoom + (event.deltaY < 0 ? 1 : -1)));
        if (nextZoom === camera.zoom) return;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const centerWorld = screenToWorldFloat(centerX, centerY, rect.width / 2 + camera.x, 40 + camera.y, camera.zoom);
        onCameraChange({
          zoom: nextZoom,
          x: centerX - rect.width / 2 - (centerWorld.x - centerWorld.y) * (TILE_W / 2) * nextZoom,
          y: centerY - 40 - (centerWorld.x + centerWorld.y) * (TILE_H / 2) * nextZoom,
        });
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        const startTile = tileFromEvent(event);
        dragRef.current = {
          pointerId: event.pointerId,
          startClientX: event.clientX,
          startClientY: event.clientY,
          lastClientX: event.clientX,
          lastClientY: event.clientY,
          startTile,
          moved: false,
        };
        if (lineTool) setPreviewLine([startTile]);
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (!drag || event.buttons !== 1) return;
        const dx = event.clientX - drag.lastClientX;
        const dy = event.clientY - drag.lastClientY;
        if (Math.hypot(event.clientX - drag.startClientX, event.clientY - drag.startClientY) > 5) drag.moved = true;
        if (lineTool) {
          const endTile = tileFromEvent(event);
          setPreviewLine(toolLinePoints(tool, drag.startTile.x, drag.startTile.y, endTile.x, endTile.y));
        } else {
          onCameraChange({ ...camera, x: camera.x + dx, y: camera.y + dy });
        }
        drag.lastClientX = event.clientX;
        drag.lastClientY = event.clientY;
      }}
      onPointerUp={(event) => {
        const drag = dragRef.current;
        dragRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        const endTile = tileFromEvent(event);
        setPreviewLine([]);
        if (drag?.moved && lineTool) {
          onApplyToolLine(tool, drag.startTile.x, drag.startTile.y, endTile.x, endTile.y);
          return;
        }
        if (drag && !drag.moved) onApplyTool(tool, endTile.x, endTile.y);
      }}
      onPointerCancel={(event) => {
        dragRef.current = null;
        setPreviewLine([]);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
    />
  );
}

function createPixiLayers(app: Application): PixiLayers {
  destroyStageChildren(app.stage);
  const staticLayer = new Container();
  const dynamicLayer = new Container();
  app.stage.addChild(staticLayer);
  app.stage.addChild(dynamicLayer);
  return { staticLayer, dynamicLayer, staticKey: '', visibleTiles: 0 };
}

function renderPixi(app: Application, layers: PixiLayers, state: GameState, sprites: PixiCatalog, camera: Camera, selected?: string, previewLine: TilePoint[] = [], tool: Tool = 'inspect'): void {
  const originX = app.screen.width / 2 + camera.x;
  const originY = 40 + camera.y;
  const previewSet = new Set(previewLine.map((point) => tileId(point.x, point.y)));
  const previewOverlay = tool === 'road' ? 'road' : 'rail';
  const visible = visibleTiles(state, originX, originY, app.screen.width, app.screen.height, camera.zoom);
  const staticKey = staticRenderKey(visible, camera, app.screen.width, app.screen.height, selected, previewLine, tool);

  if (staticKey !== layers.staticKey) {
    destroyLayerChildren(layers.staticLayer);
    const sorted = [...visible].sort((a, b) => a.tile.x + a.tile.y - (b.tile.x + b.tile.y) || a.tile.y - b.tile.y);

    for (const { tile, x, y } of sorted) {
      drawTerrain(layers.staticLayer, state, tile, sprites, x, y, camera.zoom);
      drawDevelopment(layers.staticLayer, state, tile, sprites, x, y, camera.zoom);
      drawOverlay(layers.staticLayer, state, tile, sprites, x, y, camera.zoom, previewSet, previewOverlay, false);
      if (selected === tileId(tile.x, tile.y)) drawSelection(layers.staticLayer, x, y, camera.zoom, 0xfff2a8, 1);
    }

    for (const point of previewLine) {
      const tile = tileAtLocal(state, point.x, point.y);
      if (!tile) continue;
      const screen = worldToScreen(point.x, point.y, originX, originY, camera.zoom);
      if (!isNearViewport(screen.x, screen.y, app.screen.width, app.screen.height, camera.zoom)) continue;
      drawPreviewDiamond(layers.staticLayer, screen.x, screen.y, camera.zoom, tool === 'road' ? 0xf0da8a : 0x9ed4ff);
      drawOverlay(layers.staticLayer, state, { ...tile, overlay: previewOverlay }, sprites, screen.x, screen.y, camera.zoom, previewSet, previewOverlay, true);
    }

    layers.staticKey = staticKey;
    layers.visibleTiles = visible.length;
  }

  destroyLayerChildren(layers.dynamicLayer);
  for (const train of state.trains) {
    const ix = train.x + (train.nextX - train.x) * train.progress;
    const iy = train.y + (train.nextY - train.y) * train.progress;
    const point = worldToScreen(ix, iy, originX, originY, camera.zoom);
    if (!isNearViewport(point.x, point.y, app.screen.width, app.screen.height, camera.zoom)) continue;
    const trainShape = new Graphics()
      .rect(point.x - 14 * camera.zoom, point.y - 20 * camera.zoom, 28 * camera.zoom, 10 * camera.zoom)
      .fill(0x262a33)
      .rect(point.x - 11 * camera.zoom, point.y - 18 * camera.zoom, 22 * camera.zoom, 5 * camera.zoom)
      .fill(0xd64545);
    layers.dynamicLayer.addChild(trainShape);
  }

  if (import.meta.env.DEV) {
    (window as RenderStatsWindow).__TYCOON_RENDER_STATS__ = {
      visibleTiles: layers.visibleTiles,
      displayObjects: layers.staticLayer.children.length + layers.dynamicLayer.children.length,
      worldTiles: state.tiles.length,
    };
  }
}

function destroyStageChildren(stage: Container): void {
  for (const child of stage.removeChildren()) {
    child.destroy({ children: true });
  }
}

function destroyLayerChildren(layer: Container): void {
  for (const child of layer.removeChildren()) {
    child.destroy({ children: true });
  }
}

function visibleTiles(state: GameState, originX: number, originY: number, width: number, height: number, zoom: number): VisibleTile[] {
  const tiles: VisibleTile[] = [];
  const bounds = visibleWorldBounds(originX, originY, width, height, zoom);
  const minX = Math.max(0, Math.floor(bounds.minX) - 3);
  const maxX = Math.min(state.width - 1, Math.ceil(bounds.maxX) + 3);
  const minY = Math.max(0, Math.floor(bounds.minY) - 3);
  const maxY = Math.min(state.height - 1, Math.ceil(bounds.maxY) + 3);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const tile = tileAtLocal(state, x, y);
      if (!tile) continue;
      const point = worldToScreen(tile.x, tile.y, originX, originY, zoom);
      if (isNearViewport(point.x, point.y, width, height, zoom)) tiles.push({ tile, x: point.x, y: point.y });
    }
  }
  return tiles;
}

function isNearViewport(x: number, y: number, width: number, height: number, zoom: number): boolean {
  const marginX = Math.max(160, TILE_W * zoom * 4);
  const marginY = Math.max(260, TILE_H * zoom * 12);
  return x >= -marginX && x <= width + marginX && y >= -marginY && y <= height + marginY;
}

function visibleWorldBounds(originX: number, originY: number, width: number, height: number, zoom: number): { minX: number; maxX: number; minY: number; maxY: number } {
  const marginX = Math.max(160, TILE_W * zoom * 4);
  const marginY = Math.max(260, TILE_H * zoom * 12);
  const corners = [
    screenToWorldFloat(-marginX, -marginY, originX, originY, zoom),
    screenToWorldFloat(width + marginX, -marginY, originX, originY, zoom),
    screenToWorldFloat(-marginX, height + marginY, originX, originY, zoom),
    screenToWorldFloat(width + marginX, height + marginY, originX, originY, zoom),
  ];
  return {
    minX: Math.min(...corners.map((point) => point.x)),
    maxX: Math.max(...corners.map((point) => point.x)),
    minY: Math.min(...corners.map((point) => point.y)),
    maxY: Math.max(...corners.map((point) => point.y)),
  };
}

function staticRenderKey(visible: VisibleTile[], camera: Camera, width: number, height: number, selected: string | undefined, previewLine: TilePoint[], tool: Tool): string {
  let hash = 2166136261;
  hash = mixNumber(hash, width);
  hash = mixNumber(hash, height);
  hash = mixNumber(hash, Math.round(camera.x));
  hash = mixNumber(hash, Math.round(camera.y));
  hash = mixNumber(hash, camera.zoom);
  hash = mixString(hash, selected ?? '');
  hash = mixString(hash, tool);
  for (const point of previewLine) {
    hash = mixNumber(hash, point.x);
    hash = mixNumber(hash, point.y);
  }
  for (const { tile } of visible) {
    hash = mixNumber(hash, tile.x);
    hash = mixNumber(hash, tile.y);
    hash = mixString(hash, tile.terrain);
    hash = mixString(hash, tile.zone);
    hash = mixString(hash, tile.overlay);
    hash = mixNumber(hash, tile.development);
    hash = mixNumber(hash, tile.palettePhase);
  }
  return `${visible.length}:${hash >>> 0}`;
}

function mixNumber(hash: number, value: number): number {
  return Math.imul(hash ^ value, 16777619);
}

function mixString(hash: number, value: string): number {
  let next = hash;
  for (let i = 0; i < value.length; i += 1) {
    next = mixNumber(next, value.charCodeAt(i));
  }
  return next;
}

function drawTerrain(scene: Container, state: GameState, tile: Tile, sprites: PixiCatalog, x: number, y: number, zoom: number): void {
  if (tile.terrain === 'water') {
    addSprite(scene, sprites.water, x, y, zoom);
    return;
  }
  const waterDir = neighborDirs(state, tile, (candidate) => candidate.terrain === 'water')[0];
  const landTexture = landTextureFor(tile, sprites);
  if (waterDir) {
    addSprite(scene, sprites.water, x, y, zoom);
    addMaskedSprite(scene, landTexture, x, y, zoom, landHalfPoints(x, y, zoom, waterDir), 1, farmFlipX(tile), farmFlipY(tile));
  } else {
    addSprite(scene, landTexture, x, y, zoom, 1, farmFlipX(tile), farmFlipY(tile));
  }
  if (tile.terrain === 'farm' && tile.zone === 'none' && tile.overlay === 'none' && shouldDrawFarmHouse(tile)) addSprite(scene, sprites.farmHouse, x, y, zoom);
}

function drawDevelopment(scene: Container, state: GameState, tile: Tile, sprites: PixiCatalog, x: number, y: number, zoom: number): void {
  if (tile.overlay === 'road' || tile.overlay === 'rail' || tile.overlay === 'station' || tile.overlay === 'crossing') return;
  if (tile.terrain === 'forest' && !nearWater(state, tile)) addSprite(scene, pick(sprites.forest, tile), x, y, zoom);
  if (tile.zone === 'residential') addSprite(scene, pick(sprites.residential, tile), x, y, zoom);
  if (tile.zone === 'commercial') {
    if (tile.development >= 4) drawStackable(scene, sprites, tile, x, y, zoom);
    else addSprite(scene, pick(tile.development >= 2 ? sprites.commercialMid : sprites.commercialLow, tile), x, y, zoom);
  }
  if (tile.zone === 'industrial') {
    const warehouse = warehousePart(state, tile);
    if (warehouse) addSprite(scene, sprites.warehouse[warehouse], x, y, zoom);
    else addSprite(scene, pick(sprites.industry, tile), x, y, zoom);
  }
  if (tile.overlay === 'purchased') drawSelection(scene, x, y, zoom, 0xf4e5a5, 0.55);
}

function drawStackable(scene: Container, sprites: PixiCatalog, tile: Tile, x: number, y: number, zoom: number): void {
  const floors = Math.min(5, Math.max(2, tile.development - 1));
  for (let i = floors - 1; i >= 0; i -= 1) {
    addSprite(scene, pick(sprites.stackable, tile, i), x, y - i * 10 * zoom, zoom);
  }
  addSprite(scene, pick(sprites.roofCaps, tile, 41), x, y - floors * 10 * zoom, zoom);
}

function drawOverlay(scene: Container, state: GameState, tile: Tile, sprites: PixiCatalog, x: number, y: number, zoom: number, previewSet: Set<string>, previewOverlay: 'road' | 'rail', preview: boolean): void {
  const alpha = preview ? 0.72 : 1;
  if (tile.overlay === 'rail' || tile.overlay === 'crossing') drawAutotile(scene, state, tile, sprites.railByKey, 'rail', x, y, zoom, previewSet, previewOverlay, alpha);
  if (tile.overlay === 'road' || tile.overlay === 'crossing') drawAutotile(scene, state, tile, sprites.roadByKey, 'road', x, y, zoom, previewSet, previewOverlay, alpha);
  if (tile.overlay === 'monorail') drawAutotile(scene, state, tile, sprites.monorailByKey, 'rail', x, y - 4 * zoom, zoom, previewSet, previewOverlay, alpha);
  if (tile.overlay === 'elevatedRail' || tile.overlay === 'bridge') drawAutotile(scene, state, { ...tile, overlay: 'rail' }, sprites.railByKey, 'rail', x, y - 5 * zoom, zoom, previewSet, previewOverlay, alpha);
  if (tile.overlay === 'station') addSprite(scene, sprites.station, x, y, zoom, alpha);
  if (tile.overlay === 'depot') addSprite(scene, sprites.depot, x, y, zoom, alpha);
  if (tile.overlay === 'port') addSprite(scene, pick(sprites.port, tile), x, y, zoom, alpha);
  if (tile.overlay === 'airport') addSprite(scene, sprites.airport, x, y, zoom, alpha);
}

function drawAutotile(scene: Container, state: GameState, tile: Tile, sprites: Record<string, TextureAsset>, type: 'rail' | 'road', x: number, y: number, zoom: number, previewSet: Set<string>, previewOverlay: 'road' | 'rail', alpha: number): void {
  const dirs = connectionDirs(state, tile, type, previewSet, previewOverlay);
  const key = connectionKey(dirs);
  const asset = sprites[key] ?? sprites[fallbackConnectionKey(dirs, type)] ?? fallbackAsset(sprites, dirs, type);
  if (asset) addAsset(scene, asset, x, y, zoom, alpha);
}

function drawSelection(scene: Container, x: number, y: number, zoom: number, color: number, alpha: number): void {
  const graphics = new Graphics()
    .poly([x, y - TILE_H * zoom / 2, x + TILE_W * zoom / 2, y, x, y + TILE_H * zoom / 2, x - TILE_W * zoom / 2, y])
    .stroke({ width: Math.max(1, 2 * zoom), color, alpha });
  scene.addChild(graphics);
}

function drawPreviewDiamond(scene: Container, x: number, y: number, zoom: number, color: number): void {
  const graphics = new Graphics()
    .poly([x, y - TILE_H * zoom / 2, x + TILE_W * zoom / 2, y, x, y + TILE_H * zoom / 2, x - TILE_W * zoom / 2, y])
    .fill({ color, alpha: 0.28 });
  scene.addChild(graphics);
}

function landTextureFor(tile: Tile, sprites: PixiCatalog): Texture | undefined {
  return tile.terrain === 'farm' ? pick(sprites.farm, tile, 2) : sprites.base;
}

function shouldDrawFarmHouse(tile: Tile): boolean {
  return variantIndex(tile, 11, 93) === 0;
}

function farmFlipX(tile: Tile): boolean {
  return tile.terrain === 'farm' && variantIndex(tile, 2, 17) === 1;
}

function farmFlipY(tile: Tile): boolean {
  return tile.terrain === 'farm' && variantIndex(tile, 3, 29) === 1;
}

function addSprite(scene: Container, texture: Texture | undefined, x: number, y: number, zoom: number, alpha = 1, flipX = false, flipY = false): Sprite | undefined {
  if (!texture) return;
  const sprite = new Sprite(texture);
  if (flipX || flipY) {
    sprite.anchor.set(0.5, 0.5);
    sprite.position.set(Math.round(x), Math.round(y));
    sprite.scale.set(flipX ? -zoom : zoom, flipY ? -zoom : zoom);
  } else {
    sprite.anchor.set(0.5, 1);
    sprite.position.set(Math.round(x), Math.round(y + TILE_H * zoom / 2));
    sprite.scale.set(zoom);
  }
  sprite.alpha = alpha;
  scene.addChild(sprite);
  return sprite;
}

function addMaskedSprite(scene: Container, texture: Texture | undefined, x: number, y: number, zoom: number, maskPoints: number[], alpha = 1, flipX = false, flipY = false): void {
  const sprite = addSprite(scene, texture, x, y, zoom, alpha, flipX, flipY);
  if (!sprite) return;
  const mask = new Graphics().poly(maskPoints).fill(0xffffff);
  mask.renderable = false;
  sprite.mask = mask;
  scene.addChild(mask);
}

function addAsset(scene: Container, asset: TextureAsset, x: number, y: number, zoom: number, alpha: number): void {
  const sprite = new Sprite(asset.texture);
  if (asset.flipX || asset.flipY) {
    sprite.anchor.set(0.5, 0.5);
    sprite.position.set(Math.round(x), Math.round(y - asset.texture.height * zoom / 2 + TILE_H * zoom / 2));
    sprite.scale.set(asset.flipX ? -zoom : zoom, asset.flipY ? -zoom : zoom);
  } else {
    sprite.anchor.set(0.5, 1);
    sprite.position.set(Math.round(x), Math.round(y + TILE_H * zoom / 2));
    sprite.scale.set(zoom);
  }
  sprite.alpha = alpha;
  scene.addChild(sprite);
}

function connectionDirs(state: GameState, tile: Tile, type: 'rail' | 'road', previewSet: Set<string>, previewOverlay: 'road' | 'rail'): Direction[] {
  const dirs = type === 'road' ? ROAD_DIRS : RAIL_DIRS;
  return dirs
    .filter(({ dx, dy }) => {
      const candidate = tileAtLocal(state, tile.x + dx, tile.y + dy);
      const preview = previewSet.has(tileId(tile.x + dx, tile.y + dy)) && previewOverlay === type;
      return preview || (candidate ? type === 'road' ? isRoadish(candidate.overlay) : isRailish(candidate.overlay) : false);
    })
    .map(({ dir }) => dir);
}

function neighborDirs(state: GameState, tile: Tile, predicate: (tile: Tile) => boolean): Direction[] {
  return ROAD_DIRS
    .filter(({ dx, dy }) => {
      const candidate = tileAtLocal(state, tile.x + dx, tile.y + dy);
      return candidate ? predicate(candidate) : false;
    })
    .map(({ dir }) => dir);
}

function fallbackConnectionKey(dirs: Direction[], type: 'rail' | 'road'): string {
  const key = connectionKey(dirs);
  if (key === 'NE' || key === 'SW' || key === 'NE|SW') return type === 'rail' ? 'N|S' : 'NE|SW';
  if (key === 'SE' || key === 'NW') return 'SE|NW';
  if (type === 'road') return dirs.length >= 3 ? 'NE|SE|SW|NW' : key || 'SE|NW';
  if (dirs.length === 1) return connectionKey([dirs[0], oppositeDirection(dirs[0])]);
  if (dirs.length >= 3) return connectionKey(dirs.slice(0, 3));
  return key || 'SE|NW';
}

function fallbackAsset(sprites: Record<string, TextureAsset>, dirs: Direction[], type: 'rail' | 'road'): TextureAsset | undefined {
  if (type === 'road') return sprites['SE|NW'];
  if (dirs.length > 3) {
    for (const subset of combinations(dirs, 3)) {
      const asset = sprites[connectionKey(subset)];
      if (asset) return asset;
    }
  }
  if (dirs.length === 2) {
    for (const dir of dirs) {
      const asset = sprites[connectionKey([dir, oppositeDirection(dir)])];
      if (asset) return asset;
    }
  }
  return sprites['SE|NW'] ?? sprites['N|S'] ?? sprites['E|W'];
}

function combinations<T>(items: T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (items.length < size) return [];
  const [head, ...tail] = items;
  return combinations(tail, size - 1).map((combo) => [head, ...combo]).concat(combinations(tail, size));
}

function oppositeDirection(dir: Direction): Direction {
  if (dir === 'N') return 'S';
  if (dir === 'NE') return 'SW';
  if (dir === 'E') return 'W';
  if (dir === 'SE') return 'NW';
  if (dir === 'S') return 'N';
  if (dir === 'SW') return 'NE';
  if (dir === 'W') return 'E';
  return 'SE';
}

function connectionKey(dirs: Direction[]): string {
  return [...new Set(dirs)].sort((a, b) => DIR_ORDER.indexOf(a) - DIR_ORDER.indexOf(b)).join('|');
}

function isRoadish(overlay: Overlay): boolean {
  return overlay === 'road' || overlay === 'crossing';
}

function isRailish(overlay: Overlay): boolean {
  return overlay === 'rail' || overlay === 'station' || overlay === 'depot' || overlay === 'crossing' || overlay === 'elevatedRail' || overlay === 'bridge' || overlay === 'monorail';
}

function nearWater(state: GameState, tile: Tile): boolean {
  return neighborDirs(state, tile, (candidate) => candidate.terrain === 'water').length > 0;
}

function tileAtLocal(state: GameState, x: number, y: number): Tile | undefined {
  if (x < 0 || y < 0 || x >= state.width || y >= state.height) return undefined;
  return state.tiles[y * state.width + x];
}

function warehousePart(state: GameState, tile: Tile): 'roof' | 'front' | 'wallRoof' | 'wallFront' | undefined {
  if (tile.zone !== 'industrial' || tile.development < 2) return undefined;
  const ox = tile.x - (tile.x % 2);
  const oy = tile.y - (tile.y % 2);
  const block = [
    tileAtLocal(state, ox, oy),
    tileAtLocal(state, ox + 1, oy),
    tileAtLocal(state, ox, oy + 1),
    tileAtLocal(state, ox + 1, oy + 1),
  ];
  if (!block.every((candidate) => candidate?.zone === 'industrial' && candidate.development >= 2 && candidate.overlay === 'none')) return undefined;
  const px = tile.x - ox;
  const py = tile.y - oy;
  if (py === 0 && px === 0) return 'roof';
  if (py === 0) return 'wallRoof';
  if (px === 0) return 'front';
  return 'wallFront';
}

function landHalfPoints(x: number, y: number, zoom: number, waterDir: Direction): number[] {
  const top = [x, y - TILE_H * zoom / 2];
  const right = [x + TILE_W * zoom / 2, y];
  const bottom = [x, y + TILE_H * zoom / 2];
  const left = [x - TILE_W * zoom / 2, y];
  if (waterDir === 'NE') return [...left, ...right, ...bottom];
  if (waterDir === 'SE') return [...top, ...bottom, ...left];
  if (waterDir === 'SW') return [...top, ...right, ...left];
  return [...top, ...right, ...bottom];
}

function pick<T>(items: T[], tile: Tile, salt = 0): T | undefined {
  if (items.length === 0) return undefined;
  return items[variantIndex(tile, items.length, salt)];
}

function variantIndex(tile: Tile, length: number, salt = 0): number {
  if (length <= 1) return 0;
  const hash = (tile.x * 73856093) ^ (tile.y * 19349663) ^ (tile.palettePhase * 83492791) ^ (tile.development * 2654435761) ^ salt;
  return Math.abs(hash) % length;
}

function isLineTool(tool: Tool): boolean {
  return tool === 'rail' || tool === 'road' || tool === 'elevatedRail' || tool === 'bridge' || tool === 'monorail';
}

function toolLinePoints(tool: Tool, ax: number, ay: number, bx: number, by: number): TilePoint[] {
  return tool === 'road' ? linePoints(ax, ay, bx, by) : linePoints8(ax, ay, bx, by);
}

async function loadPixiCatalog(): Promise<PixiCatalog> {
  const defs = flattenSpriteDefs(SPRITE_DATA);
  const paths = [...new Set(defs.map(spritePath))];
  await Promise.all(paths.map((path) => Assets.load(path)));
  const texture = (def: SpriteDef) => {
    const result = Texture.from(spritePath(def));
    result.source.scaleMode = 'nearest';
    return result;
  };
  return {
    base: texture(SPRITE_DATA.base),
    water: texture(SPRITE_DATA.water),
    farm: SPRITE_DATA.farm.map(texture),
    farmHouse: texture(SPRITE_DATA.farmHouse),
    forest: SPRITE_DATA.forest.map(texture),
    roadByKey: loadTextureMap(SPRITE_DATA.road, texture),
    railByKey: loadTextureMap(SPRITE_DATA.rail, texture),
    monorailByKey: loadTextureMap(SPRITE_DATA.monorail, texture),
    station: texture(SPRITE_DATA.station),
    depot: texture(SPRITE_DATA.depot),
    port: SPRITE_DATA.port.map(texture),
    airport: texture(SPRITE_DATA.airport),
    residential: SPRITE_DATA.residential.map(texture),
    commercialLow: SPRITE_DATA.commercialLow.map(texture),
    commercialMid: SPRITE_DATA.commercialMid.map(texture),
    stackable: SPRITE_DATA.stackable.map(texture),
    roofCaps: SPRITE_DATA.roofCaps.map(texture),
    industry: SPRITE_DATA.industry.map(texture),
    warehouse: {
      roof: texture(SPRITE_DATA.warehouse.roof),
      front: texture(SPRITE_DATA.warehouse.front),
      wallRoof: texture(SPRITE_DATA.warehouse.wallRoof),
      wallFront: texture(SPRITE_DATA.warehouse.wallFront),
    },
    purchased: texture(SPRITE_DATA.purchased),
  };
}

function loadTextureMap(sprites: SpriteDef[], texture: (def: SpriteDef) => Texture): Record<string, TextureAsset> {
  const assets: Record<string, TextureAsset> = {};
  for (const sprite of sprites) {
    const key = connectionKey(sprite.connections ?? []);
    assets[key] ??= { texture: texture(sprite) };
  }
  for (const sprite of sprites) {
    const base = texture(sprite);
    const connections = sprite.connections ?? [];
    assets[connectionKey(connections.map(flipDirectionX))] ??= { texture: base, flipX: true };
    assets[connectionKey(connections.map(flipDirectionY))] ??= { texture: base, flipY: true };
    assets[connectionKey(connections.map(flipDirectionX).map(flipDirectionY))] ??= { texture: base, flipX: true, flipY: true };
  }
  return assets;
}

function flipDirectionX(dir: Direction): Direction {
  if (dir === 'NE') return 'NW';
  if (dir === 'NW') return 'NE';
  if (dir === 'SE') return 'SW';
  if (dir === 'SW') return 'SE';
  if (dir === 'E') return 'W';
  if (dir === 'W') return 'E';
  return dir;
}

function flipDirectionY(dir: Direction): Direction {
  if (dir === 'NE') return 'SE';
  if (dir === 'SE') return 'NE';
  if (dir === 'NW') return 'SW';
  if (dir === 'SW') return 'NW';
  if (dir === 'N') return 'S';
  if (dir === 'S') return 'N';
  return dir;
}

function flattenSpriteDefs(value: unknown): SpriteDef[] {
  if (Array.isArray(value)) return value.flatMap(flattenSpriteDefs);
  if (value && typeof value === 'object' && 'filename' in value) return [value as SpriteDef];
  if (value && typeof value === 'object') return Object.values(value).flatMap(flattenSpriteDefs);
  return [];
}

function spritePath(sprite: SpriteDef): string {
  return `/source_tileset/${sprite.filename}`;
}
