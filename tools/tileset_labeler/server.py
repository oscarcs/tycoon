#!/usr/bin/env python3
"""Local tileset labeling server.

Run from the repo root:
    python3 tools/tileset_labeler/server.py
"""

from __future__ import annotations

import argparse
import csv
import json
import mimetypes
import os
import re
import tempfile
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse


ROOT = Path(__file__).resolve().parents[2]
STATIC_ROOT = Path(__file__).resolve().parent / "static"
DEFAULT_TILESET = ROOT / "source_tileset"
DEFAULT_MANIFEST = ROOT / "source_tileset_manifest.csv"

CSV_FIELDS = [
    "filename",
    "gfx_id",
    "eff",
    "slot",
    "width",
    "height",
    "label",
    "category",
    "transport",
    "terrain",
    "water_only",
    "connections",
    "slope",
    "orientation",
    "notes",
    "updated_at",
]

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
NAME_RE = re.compile(r"gfx_(?P<gfx_id>\d+).*?_eff_(?P<eff>\d+)_slot_(?P<slot>\d+)_")


class LabelStore:
    def __init__(self, tileset_dir: Path, manifest_path: Path) -> None:
        self.tileset_dir = tileset_dir
        self.manifest_path = manifest_path

    def images(self) -> list[dict[str, object]]:
        files = sorted(self.tileset_dir.glob("*.png"), key=self._sort_key)
        rows = self._read_manifest()
        result = []
        for path in files:
            filename = path.name
            meta = self._metadata(path)
            merged = {**self._empty_row(meta), **rows.get(filename, {})}
            merged.update(meta)
            result.append(merged)
        return result

    def save_row(self, incoming: dict[str, object]) -> dict[str, str]:
        filename = str(incoming.get("filename", ""))
        image_path = self._safe_image_path(filename)
        meta = self._metadata(image_path)
        rows = self._read_manifest()

        row = self._empty_row(meta)
        row.update(rows.get(filename, {}))
        for field in CSV_FIELDS:
            if field in incoming:
                row[field] = self._stringify(incoming[field])
        row.update(meta)
        row["updated_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")

        rows[filename] = row
        self._write_manifest(rows)
        return row

    def manifest_text(self) -> str:
        if not self.manifest_path.exists():
            self._write_manifest({})
        return self.manifest_path.read_text(encoding="utf-8")

    def image_path(self, filename: str) -> Path:
        return self._safe_image_path(filename)

    def _read_manifest(self) -> dict[str, dict[str, str]]:
        if not self.manifest_path.exists():
            return {}
        with self.manifest_path.open("r", newline="", encoding="utf-8") as handle:
            return {
                row["filename"]: {field: row.get(field, "") for field in CSV_FIELDS}
                for row in csv.DictReader(handle)
                if row.get("filename")
            }

    def _write_manifest(self, rows: dict[str, dict[str, str]]) -> None:
        ordered = [rows[path.name] for path in sorted(self.tileset_dir.glob("*.png"), key=self._sort_key) if path.name in rows]
        self.manifest_path.parent.mkdir(parents=True, exist_ok=True)
        fd, temp_name = tempfile.mkstemp(prefix=".manifest.", suffix=".csv", dir=str(self.manifest_path.parent))
        with os.fdopen(fd, "w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=CSV_FIELDS)
            writer.writeheader()
            for row in ordered:
                writer.writerow({field: row.get(field, "") for field in CSV_FIELDS})
        os.replace(temp_name, self.manifest_path)

    def _empty_row(self, meta: dict[str, str]) -> dict[str, str]:
        row = {field: "" for field in CSV_FIELDS}
        row.update(meta)
        return row

    def _metadata(self, path: Path) -> dict[str, str]:
        width, height = self._png_size(path)
        match = NAME_RE.search(path.name)
        return {
            "filename": path.name,
            "gfx_id": match.group("gfx_id") if match else "",
            "eff": match.group("eff") if match else "",
            "slot": match.group("slot") if match else "",
            "width": str(width),
            "height": str(height),
        }

    def _png_size(self, path: Path) -> tuple[int, int]:
        with path.open("rb") as handle:
            header = handle.read(24)
        if len(header) < 24 or not header.startswith(PNG_SIGNATURE):
            return 0, 0
        return int.from_bytes(header[16:20], "big"), int.from_bytes(header[20:24], "big")

    def _safe_image_path(self, filename: str) -> Path:
        candidate = (self.tileset_dir / Path(unquote(filename)).name).resolve()
        if candidate.parent != self.tileset_dir.resolve() or candidate.suffix.lower() != ".png" or not candidate.exists():
            raise FileNotFoundError(filename)
        return candidate

    def _sort_key(self, path: Path) -> tuple[int, int, str]:
        match = NAME_RE.search(path.name)
        if not match:
            return (999999, 999999, path.name)
        return (int(match.group("slot")), int(match.group("gfx_id")), path.name)

    def _stringify(self, value: object) -> str:
        if isinstance(value, list):
            return "|".join(str(item) for item in value)
        if isinstance(value, bool):
            return "true" if value else "false"
        return "" if value is None else str(value)


def make_handler(store: LabelStore) -> type[BaseHTTPRequestHandler]:
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            parsed = urlparse(self.path)
            try:
                if parsed.path == "/api/images":
                    self._send_json({"images": store.images()})
                    return
                if parsed.path == "/api/manifest":
                    self._send_bytes(store.manifest_text().encode("utf-8"), "text/csv; charset=utf-8")
                    return
                if parsed.path == "/tile":
                    filename = parse_qs(parsed.query).get("file", [""])[0]
                    image_path = store.image_path(filename)
                    self._send_bytes(image_path.read_bytes(), "image/png")
                    return
                self._send_static(parsed.path)
            except FileNotFoundError:
                self.send_error(HTTPStatus.NOT_FOUND, "Not found")
            except Exception as exc:
                self.send_error(HTTPStatus.INTERNAL_SERVER_ERROR, str(exc))

        def do_POST(self) -> None:
            if urlparse(self.path).path != "/api/label":
                self.send_error(HTTPStatus.NOT_FOUND, "Not found")
                return
            length = int(self.headers.get("content-length", "0"))
            payload = json.loads(self.rfile.read(length) or b"{}")
            try:
                self._send_json({"row": store.save_row(payload)})
            except FileNotFoundError:
                self.send_error(HTTPStatus.NOT_FOUND, "Image not found")

        def log_message(self, fmt: str, *args: object) -> None:
            print(f"{self.address_string()} - {fmt % args}")

        def _send_static(self, path: str) -> None:
            relative = "index.html" if path in ("", "/") else path.lstrip("/")
            candidate = (STATIC_ROOT / relative).resolve()
            if STATIC_ROOT.resolve() not in candidate.parents and candidate != STATIC_ROOT.resolve():
                raise FileNotFoundError(relative)
            if not candidate.is_file():
                raise FileNotFoundError(relative)
            content_type = mimetypes.guess_type(candidate.name)[0] or "application/octet-stream"
            self._send_bytes(candidate.read_bytes(), content_type)

        def _send_json(self, value: object) -> None:
            self._send_bytes(json.dumps(value).encode("utf-8"), "application/json; charset=utf-8")

        def _send_bytes(self, body: bytes, content_type: str) -> None:
            self.send_response(HTTPStatus.OK)
            self.send_header("content-type", content_type)
            self.send_header("content-length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    return Handler


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the tileset labeling tool.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--tileset", type=Path, default=DEFAULT_TILESET)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    args = parser.parse_args()

    store = LabelStore(args.tileset.resolve(), args.manifest.resolve())
    server = ThreadingHTTPServer((args.host, args.port), make_handler(store))
    print(f"Tileset labeler: http://{args.host}:{args.port}")
    print(f"Tileset: {store.tileset_dir}")
    print(f"Manifest: {store.manifest_path}")
    server.serve_forever()


if __name__ == "__main__":
    main()
