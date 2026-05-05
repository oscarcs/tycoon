import { describe, expect, it } from 'vitest';
import manifestCsv from '../../source_tileset_manifest.csv?raw';
import { parseManifest } from './manifest';

describe('sprite manifest', () => {
  it('parses quoted manifest notes without splitting sprite rows', () => {
    const sprites = parseManifest(manifestCsv);
    expect(sprites.length).toBeGreaterThan(250);
    expect(sprites.every((sprite) => sprite.filename.endsWith('.png'))).toBe(true);
  });
});
