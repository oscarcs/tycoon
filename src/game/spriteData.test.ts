import { describe, expect, it } from 'vitest';
import { SPRITE_DATA, type SpriteDef } from './spriteData';

const sourceTiles = import.meta.glob('../../source_tileset/*.png', { eager: true, query: '?url', import: 'default' });

function flattenSprites(value: unknown): SpriteDef[] {
  if (Array.isArray(value)) return value.flatMap(flattenSprites);
  if (value && typeof value === 'object' && 'filename' in value) return [value as SpriteDef];
  if (value && typeof value === 'object') return Object.values(value).flatMap(flattenSprites);
  return [];
}

describe('runtime sprite data', () => {
  it('uses curated sprite definitions instead of manifest labels', () => {
    const sprites = flattenSprites(SPRITE_DATA);
    const availableFilenames = new Set(Object.keys(sourceTiles).map((path) => {
      const parts = path.split('/');
      return parts[parts.length - 1];
    }));
    expect(sprites.length).toBeGreaterThan(80);
    expect(sprites.every((sprite) => sprite.filename.endsWith('.png'))).toBe(true);
    expect(sprites.filter((sprite) => !availableFilenames.has(sprite.filename))).toEqual([]);
  });

  it('pins high-risk runtime roles to validated assets', () => {
    expect(SPRITE_DATA.water.filename).toContain('gfx_00276');
    expect(SPRITE_DATA.farm.map((sprite) => sprite.filename).join(' ')).toContain('gfx_00716');
    expect(SPRITE_DATA.farmHouses.length).toBeGreaterThan(4);
    expect(SPRITE_DATA.industry.length).toBeGreaterThan(3);
    expect(SPRITE_DATA.industry.map((sprite) => sprite.filename).join(' ')).not.toContain('gfx_00534');
    expect(SPRITE_DATA.road.every((sprite) => (sprite.connections?.length ?? 0) >= 2)).toBe(true);
    expect(SPRITE_DATA.rail.every((sprite) => (sprite.connections?.length ?? 0) >= 2)).toBe(true);
  });
});
