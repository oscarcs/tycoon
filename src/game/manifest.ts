import type { Direction, TileSprite } from './types';

export async function loadManifest(url = '/source_tileset_manifest.csv'): Promise<TileSprite[]> {
  const response = await fetch(url);
  const text = await response.text();
  return parseManifest(text);
}

export function parseManifest(csv: string): TileSprite[] {
  const [headerLine, ...lines] = csv.trim().split(/\r?\n/);
  const headers = parseCsvLine(headerLine);
  return lines.map((line) => {
    const row = parseCsvLine(line);
    const get = (name: string) => row[headers.indexOf(name)] ?? '';
    return {
      filename: get('filename'),
      label: get('label'),
      category: get('category'),
      transport: get('transport'),
      terrain: get('terrain'),
      connections: get('connections').split('|').filter(Boolean) as Direction[],
      waterOnly: get('water_only') === 'true',
      width: Number(get('width')) || 32,
      height: Number(get('height')) || 16,
    };
  });
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}
