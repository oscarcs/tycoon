import type { Direction, TileSprite } from './types';

export async function loadManifest(url = '/source_tileset_manifest.csv'): Promise<TileSprite[]> {
  const response = await fetch(url);
  const text = await response.text();
  return parseManifest(text);
}

export function parseManifest(csv: string): TileSprite[] {
  const [headerLine, ...rows] = parseCsvRecords(csv.trim());
  const headers = headerLine;
  return rows.filter((row) => row.some(Boolean)).map((row) => {
    const get = (name: string) => row[headers.indexOf(name)] ?? '';
    return {
      filename: get('filename'),
      gfxId: get('gfx_id'),
      slot: get('slot'),
      label: get('label'),
      category: get('category'),
      transport: get('transport'),
      terrain: get('terrain'),
      connections: get('connections').split('|').filter(Boolean) as Direction[],
      slope: get('slope'),
      orientation: get('orientation'),
      notes: get('notes'),
      waterOnly: get('water_only') === 'true',
      width: Number(get('width')) || 32,
      height: Number(get('height')) || 16,
    };
  });
}

function parseCsvRecords(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"' && text[i + 1] === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(current);
      current = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(current);
      rows.push(row);
      row = [];
      current = '';
    } else {
      current += char;
    }
  }
  row.push(current);
  rows.push(row);
  return rows;
}
