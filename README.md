# tycoon

## Tileset labeler

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
