"""
Turns the hand-drawn sprite sheets in art/source/ into game-ready sprite sheets
in public/sprites/.

The source sheets are JPGs on a white background with text labels and frames
laid out loosely. This script:
  1. finds each frame (a big blob of non-white pixels) and any small bits that
     belong to it (motion lines, flying poop),
  2. removes the white background,
  3. shrinks it down to chunky 8-bit pixels (one game pixel = BLOCK source px),
  4. packs the frames into a strip of equal-sized cells, feet on the bottom.

Run it again whenever the art changes:

    python3 -m venv .venv && .venv/bin/pip install pillow numpy scipy
    .venv/bin/python tools/extract_sprites.py

Frame order in each output strip is row by row, left to right, as drawn.
The animation ranges are listed in src/data/spriteSheets.ts.
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art" / "source"
OUT = ROOT / "public" / "sprites"

# Pixels darker than this (in their lightest channel) are definitely sprite.
INK = 215
# Enclosed near-white areas brighter than this are background showing through
# a gap (e.g. between a tail and a body), not white fur.
PAPER = 247


@dataclass
class Sheet:
    name: str
    file: str
    # One game pixel = this many source pixels.
    block: int
    # Small bits within this many px of a frame belong to it (flying poop etc).
    margin: int
    # Ignore small bits left of this x (the text labels).
    label_right: int
    # Blobs smaller than this many px are bits, not frames.
    min_frame_px: int = 2500
    # Skip frames this small (e.g. the tiny icons next to the rabbit).
    min_frame_h: int = 60


SHEETS = [
    Sheet("rabbit", "rabbit-sheet.jpg", block=4, margin=4, label_right=140),
    Sheet("snow-leopard", "snow-leopard-sheet.jpg", block=4, margin=22, label_right=75),
]


def find_frames(fg: np.ndarray, sheet: Sheet) -> list[tuple[np.ndarray, tuple[float, float]]]:
    """For each frame, in reading order: a boolean mask (full sheet size) and
    the bottom-center of its main body (x, y), used to line the frames up."""
    lab, _ = ndimage.label(fg)
    objs = ndimage.find_objects(lab)
    big, small = [], []
    for i, s in enumerate(objs):
        count = int((lab[s] == i + 1).sum())
        h = s[0].stop - s[0].start
        if count >= sheet.min_frame_px and h >= sheet.min_frame_h:
            big.append((i + 1, s))
        elif count >= 12 and s[1].start >= sheet.label_right:
            small.append((i + 1, s))

    # Reading order: group into rows by vertical center, then left to right.
    big.sort(key=lambda b: (b[1][0].start + b[1][0].stop) / 2)
    rows: list[list] = []
    for b in big:
        cy = (b[1][0].start + b[1][0].stop) / 2
        if rows and abs(cy - rows[-1][0][2]) < 70:
            rows[-1].append((*b, cy))
        else:
            rows.append([(*b, cy)])
    ordered = [b for row in rows for b in sorted(row, key=lambda b: b[1][1].start)]

    frames = []
    m = sheet.margin
    for label, s, _ in ordered:
        mask = lab == label
        y0, y1, x0, x1 = s[0].start - m, s[0].stop + m, s[1].start - m, s[1].stop + m
        for sl, ss in small:
            cy = (ss[0].start + ss[0].stop) / 2
            cx = (ss[1].start + ss[1].stop) / 2
            # Nothing below the feet: those are specks, not part of the pose.
            if y0 <= cy < s[0].stop - 2 and x0 <= cx <= x1:
                mask |= lab == sl
        frames.append((mask, ((s[1].start + s[1].stop) / 2, s[0].stop)))
    return frames


def solid_mask(rgb: np.ndarray, ink: np.ndarray) -> np.ndarray:
    """Ink plus the light areas it encloses, minus enclosed pure-white gaps."""
    filled = ndimage.binary_fill_holes(ink)
    holes, n = ndimage.label(filled & ~ink)
    lightest = rgb.min(axis=2)
    for i in range(1, n + 1):
        region = holes == i
        if lightest[region].mean() >= PAPER and region.sum() > 40:
            filled &= ~region
    return filled


def best_phase(alpha: np.ndarray, block: int) -> tuple[int, int]:
    """Grid offset that lines our blocks up with the art's own pixels."""
    best, best_score = (0, 0), -1.0
    for oy in range(block):
        for ox in range(block):
            a = alpha[oy:, ox:]
            h, w = (a.shape[0] // block) * block, (a.shape[1] // block) * block
            cells = a[:h, :w].reshape(h // block, block, w // block, block).mean(axis=(1, 3))
            # Crisp grid = cells that are fully in or fully out.
            score = float(((cells < 0.05) | (cells > 0.95)).mean())
            if score > best_score:
                best, best_score = (oy, ox), score
    return best


@dataclass
class Frame:
    image: Image.Image
    # Where the body's center-bottom (between the feet) is, in frame pixels.
    anchor_x: float
    anchor_y: float


def pixelate(rgb: np.ndarray, mask: np.ndarray, anchor: tuple[float, float], block: int) -> Frame:
    """Crop to the mask and shrink by `block`, one median color per cell."""
    ys, xs = np.nonzero(mask)
    pad = block
    y0, y1 = max(0, ys.min() - pad), ys.max() + 1 + pad
    x0, x1 = max(0, xs.min() - pad), xs.max() + 1 + pad
    crop, alpha = rgb[y0:y1, x0:x1], mask[y0:y1, x0:x1].astype(float)

    oy, ox = best_phase(alpha, block)
    crop, alpha = crop[oy:, ox:], alpha[oy:, ox:]
    h, w = alpha.shape[0] // block, alpha.shape[1] // block
    out = np.zeros((h, w, 4), dtype=np.uint8)
    for cy in range(h):
        for cx in range(w):
            a = alpha[cy * block:(cy + 1) * block, cx * block:(cx + 1) * block]
            if a.mean() < 0.5:
                continue
            px = crop[cy * block:(cy + 1) * block, cx * block:(cx + 1) * block][a > 0]
            # Darkest-leaning median keeps outlines solid after shrinking.
            color = np.median(px, axis=0)
            if (px.max(axis=1) < 80).mean() > 0.35:
                color = np.minimum(color, [40, 30, 30])
            out[cy, cx, :3] = color
            out[cy, cx, 3] = 255
    img = Image.fromarray(out)
    ax = (anchor[0] - x0 - ox) / block
    ay = (anchor[1] - y0 - oy) / block
    bbox = img.getbbox()
    if not bbox:
        return Frame(img, ax, ay)
    return Frame(img.crop(bbox), ax - bbox[0], ay - bbox[1])


def pack(frames: list[Frame]) -> tuple[Image.Image, int, int]:
    """Equal cells; every frame's anchor lands on the same spot (bottom center)."""
    left = max(f.anchor_x for f in frames)
    right = max(f.image.width - f.anchor_x for f in frames)
    up = max(f.anchor_y for f in frames)
    down = max(f.image.height - f.anchor_y for f in frames)
    half = int(np.ceil(max(left, right))) + 1
    fw, fh = half * 2, int(np.ceil(up + down)) + 1
    base = int(np.ceil(up))
    strip = Image.new("RGBA", (fw * len(frames), fh), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        strip.paste(f.image, (i * fw + round(half - f.anchor_x), round(base - f.anchor_y)), f.image)
    return strip, fw, fh


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    meta = {}
    for sheet in SHEETS:
        rgb = np.asarray(Image.open(SRC / sheet.file).convert("RGB")).astype(int)
        ink = rgb.min(axis=2) < INK
        frames = []
        for mask, anchor in find_frames(ink, sheet):
            frames.append(pixelate(rgb, solid_mask(rgb, mask), anchor, sheet.block))
        strip, fw, fh = pack(frames)
        strip.save(OUT / f"{sheet.name}.png")
        meta[sheet.name] = {"frameWidth": fw, "frameHeight": fh, "frames": len(frames)}
        print(f"{sheet.name}: {len(frames)} frames of {fw}x{fh}")
    (OUT / "sheets.json").write_text(json.dumps(meta, indent=2) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
