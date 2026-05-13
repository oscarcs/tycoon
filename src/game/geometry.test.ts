import { describe, expect, it } from 'vitest';
import { TILE_H, screenToWorld, worldToScreen } from './geometry';

describe('geometry', () => {
  it('keeps clicks in the top half of a diamond on the same tile', () => {
    const originX = 400;
    const originY = 80;
    const zoom = 2;
    const tile = { x: 12, y: 18 };
    const center = worldToScreen(tile.x, tile.y, originX, originY, zoom);

    expect(screenToWorld(center.x, center.y - (TILE_H * zoom) / 4, originX, originY, zoom)).toEqual(tile);
  });
});
