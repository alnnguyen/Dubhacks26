#!/usr/bin/env python3
"""
Crop NASA MGS MOLA MEGDR topography around Jezero Crater into a small 16-bit PNG.

Source dataset (NASA Planetary Data System, Geosciences Node):
  MGS-M-MOLA-5-MEGDR-L3-V1.0, product megt44n000hb.img
  128 pixels/degree (~463 m/pixel), 16-bit signed big-endian, meters relative
  to the Mars areoid. Tile covers 0..44 N, 0..90 E.
  https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg128/

Only the rows needed are fetched with an HTTP Range request (no multi-GB download).
Pure standard library: no numpy/PIL required.

Usage: python3 scripts/mars/crop_mola.py web/public/arena/mars
Writes jezero_mola.png (16-bit grayscale) and jezero_mola.json (metadata).
"""
import json
import struct
import sys
import urllib.request
import zlib
from array import array

URL = "https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg128/megt44n000hb.img"
PPD = 128  # pixels per degree
TILE_MAX_LAT = 44.0
TILE_MIN_LON = 0.0
TILE_COLS = 11520
BYTES_PER_SAMPLE = 2

# Jezero Crater center ~18.38 N, 77.58 E. Crop 2.5 degrees (~148 km) square so
# the full crater rim (~45 km diameter) and surrounding terrain are included.
CENTER_LAT = 18.38
CENTER_LON = 77.58
SPAN_DEG = 2.5
OUT_SIZE = 256


def fetch_rows(row0: int, nrows: int) -> bytes:
    start = row0 * TILE_COLS * BYTES_PER_SAMPLE
    end = start + nrows * TILE_COLS * BYTES_PER_SAMPLE - 1
    req = urllib.request.Request(URL, headers={"Range": f"bytes={start}-{end}"})
    with urllib.request.urlopen(req, timeout=120) as r:
        data = r.read()
    if len(data) != end - start + 1:
        raise SystemExit(f"Unexpected byte count {len(data)} (Range not honored?)")
    return data


def png16(path: str, w: int, h: int, values: list[int]) -> None:
    raw = bytearray()
    for y in range(h):
        raw.append(0)  # filter: none
        for x in range(w):
            raw += struct.pack(">H", values[y * w + x])

    def chunk(tag: bytes, body: bytes) -> bytes:
        return struct.pack(">I", len(body)) + tag + body + struct.pack(">I", zlib.crc32(tag + body) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", w, h, 16, 0, 0, 0, 0)  # 16-bit grayscale
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b""))


def main() -> None:
    out_dir = sys.argv[1] if len(sys.argv) > 1 else "."
    max_lat = CENTER_LAT + SPAN_DEG / 2
    min_lon = CENTER_LON - SPAN_DEG / 2
    row0 = int(round((TILE_MAX_LAT - max_lat) * PPD))
    col0 = int(round((min_lon - TILE_MIN_LON) * PPD))
    n = int(round(SPAN_DEG * PPD))

    data = fetch_rows(row0, n)
    samples = array("h")
    samples.frombytes(data)
    if sys.byteorder == "little":
        samples.byteswap()  # source is MSB_INTEGER

    crop = [[samples[r * TILE_COLS + col0 + c] for c in range(n)] for r in range(n)]

    # Bilinear resample n x n -> OUT_SIZE x OUT_SIZE
    out = []
    for y in range(OUT_SIZE):
        fy = y * (n - 1) / (OUT_SIZE - 1)
        y0 = int(fy); y1 = min(y0 + 1, n - 1); ty = fy - y0
        for x in range(OUT_SIZE):
            fx = x * (n - 1) / (OUT_SIZE - 1)
            x0 = int(fx); x1 = min(x0 + 1, n - 1); tx = fx - x0
            top = crop[y0][x0] * (1 - tx) + crop[y0][x1] * tx
            bot = crop[y1][x0] * (1 - tx) + crop[y1][x1] * tx
            out.append(top * (1 - ty) + bot * ty)

    lo, hi = min(out), max(out)
    norm = [int(round((v - lo) / (hi - lo) * 65535)) for v in out]
    png16(f"{out_dir}/jezero_mola.png", OUT_SIZE, OUT_SIZE, norm)

    meta = {
        "source": "NASA PDS MGS-M-MOLA-5-MEGDR-L3-V1.0, megt44n000hb.img",
        "sourceUrl": URL,
        "instrument": "Mars Orbiter Laser Altimeter (MOLA), Mars Global Surveyor",
        "region": "Jezero Crater, Mars",
        "centerLatDeg": CENTER_LAT,
        "centerLonDegE": CENTER_LON,
        "bounds": {"minLat": CENTER_LAT - SPAN_DEG / 2, "maxLat": max_lat, "minLonE": min_lon, "maxLonE": CENTER_LON + SPAN_DEG / 2},
        "spanDeg": SPAN_DEG,
        "spanKm": round(SPAN_DEG * 3389.5 * 3.14159265 / 180, 1),
        "sourceResolution": "128 px/deg (~463 m/px)",
        "outputSize": OUT_SIZE,
        "elevationMinM": lo,
        "elevationMaxM": hi,
        "encoding": "16-bit grayscale PNG; elevation_m = min + v/65535 * (max - min), relative to the MOLA areoid",
        "processing": "HTTP range-fetched rows, cropped, bilinear-resampled, normalized. Script: scripts/mars/crop_mola.py",
    }
    with open(f"{out_dir}/jezero_mola.json", "w") as f:
        json.dump(meta, f, indent=2)
    print(json.dumps({k: meta[k] for k in ("elevationMinM", "elevationMaxM", "spanKm")}))


if __name__ == "__main__":
    main()
