# Tycoon

A browser-based railway tycoon prototype inspired by Japanese rail and urban
development simulations.

## Requirements

- Node.js 18 or newer
- npm
- Python 3 for the optional tileset labeler
- Wrangler login/configuration, only for Cloudflare multiplayer deployment

## Getting Started

Install dependencies:

```sh
npm install
```

Start the local development server:

```sh
npm run dev
```

Open the Vite URL, usually http://127.0.0.1:5173.

Build the production app:

```sh
npm run build
```

Run the test suite:

```sh
npm test
```

Preview the production build locally:

```sh
npm run preview
```

## Multiplayer

The frontend can connect to a Cloudflare Worker WebSocket endpoint when
`VITE_TYCOON_SYNC_URL` is set.

Run the Worker locally:

```sh
npm run worker:dev
```

Deploy the Worker:

```sh
npm run worker:deploy
```

The Worker is configured in `wrangler.jsonc` and uses the `TYCOON_WORLD`
Durable Object binding. Once a sync endpoint is available, expose it to Vite:

```sh
VITE_TYCOON_SYNC_URL=wss://your-worker.example.workers.dev npm run dev
```

Use the in-game Share button to create an invite URL for the current world.

## Project Layout

- `src/ui/` - React UI, PixiJS map renderer, menu, panels, and controls.
- `src/game/` - simulation, pathfinding, deterministic random generation,
  multiplayer client helpers, sprite data, and tests.
- `worker/` - Cloudflare Worker and Durable Object multiplayer room.
- `source_tileset/` - source pixel-art tiles.
- `source_tileset_manifest.csv` - tile metadata consumed by the app and labeler.
- `docs/` - design spec, progress notes, verification records, and completion
  audit.
- `tools/tileset_labeler/` - local labeling UI for maintaining the tileset
  manifest.

## Tileset Labeler

Run the local labeling UI from the repo root:

```sh
python3 tools/tileset_labeler/server.py
```

Then open http://127.0.0.1:8765.

The tool reads PNGs from `source_tileset/` and writes labels to
`source_tileset_manifest.csv`. The CSV captures filename metadata, free-form
label and notes, category, transport type, water-only flag, 8-way connections,
slope, and orientation.

Useful shortcuts:

- `Enter`: save and next
- `Shift+Enter`: save and previous
- `Left` / `Right`: previous / next
- `S`: save
- `L` / `M`: focus label / notes
- `1`-`8`: terrain, road, rail, vehicle, building, industry, decoration, unknown
- `Q W E` / `A D` / `Z X C`: toggle NW N NE / W E / SW S SE connections
- `Shift` plus a direction key: set orientation
- `F`: flat slope
- `U` / `J`: up / down slope using current orientation
- `R` / `T` / `V` / `B`: road, rail, road vehicle, rail vehicle
- `Y`: toggle water only
- `-` / `=`: zoom out / in
