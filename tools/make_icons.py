"""
The game's icons, made from the rabbit sprite (frame 0, sitting) on a little
snowy scene, as chunky pixels:

  public/icon.svg              the icon (also the favicon in modern browsers)
  public/favicon.png           32 x 32 favicon for browsers without SVG icons
  public/favicon.ico           16 / 32 / 48 for very old browsers
  public/apple-touch-icon.png  180 x 180, for iPhone/iPad "Add to Home Screen"
  public/icon-192.png          for Android "Add to Home screen" (manifest)
  public/icon-512.png

Run it again if the rabbit sprite changes:

    .venv/bin/python tools/make_icons.py
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
SHEET = PUBLIC / "sprites" / "rabbit.png"

GRID = 38  # the icon is 38 x 38 art pixels (room around the rabbit)
SKY_TOP = (60, 124, 216)
SKY_LOW = (100, 160, 236)
SNOW = (236, 246, 252)
SNOW_SHADE = (188, 220, 244)
DIRT = (140, 92, 36)
DIRT_DARK = (100, 62, 22)
GROUND = 31  # first row of snow


def scene() -> Image.Image:
    """The icon at 1 pixel per art pixel."""
    img = Image.new("RGBA", (GRID, GRID))
    px = img.load()
    for y in range(GRID):
        for x in range(GRID):
            if y < 18:
                c = SKY_TOP
            elif y < GROUND:
                c = SKY_LOW
            elif y == GROUND:
                c = SNOW
            elif y == GROUND + 1:
                c = SNOW_SHADE
            else:
                # Dirt with a few darker specks.
                c = DIRT_DARK if (x * 7 + y * 13) % 11 == 0 else DIRT
            px[x, y] = (*c, 255)

    # The rabbit, trimmed and kept to a handful of colors (a tidier SVG).
    rabbit = Image.open(SHEET).convert("RGBA").crop((0, 0, 36, 30))
    alpha = rabbit.getchannel("A").point(lambda a: 255 if a >= 128 else 0)
    # Only the rabbit itself: drop the little "twitch" marks floating by its ears.
    alpha = largest_blob(alpha)
    rabbit.putalpha(alpha)
    box = alpha.getbbox()
    rabbit, alpha = rabbit.crop(box), alpha.crop(box)
    rgb = rabbit.convert("RGB").quantize(colors=20, method=Image.Quantize.MEDIANCUT).convert("RGB")
    rabbit = Image.merge("RGBA", (*rgb.split(), alpha))
    # Centered, sitting on the snow.
    x0 = (GRID - rabbit.width) // 2
    y0 = GROUND + 1 - rabbit.height
    img.alpha_composite(rabbit, (x0, y0))
    return img


def largest_blob(mask: Image.Image) -> Image.Image:
    """Keep only the biggest connected patch of solid pixels."""
    w, h = mask.size
    px = mask.load()
    seen: set[tuple[int, int]] = set()
    best: list[tuple[int, int]] = []
    for sy in range(h):
        for sx in range(w):
            if px[sx, sy] == 0 or (sx, sy) in seen:
                continue
            blob, stack = [], [(sx, sy)]
            seen.add((sx, sy))
            while stack:
                x, y = stack.pop()
                blob.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and px[nx, ny] and (nx, ny) not in seen:
                        seen.add((nx, ny))
                        stack.append((nx, ny))
            if len(blob) > len(best):
                best = blob
    out = Image.new("L", mask.size, 0)
    for xy in best:
        out.putpixel(xy, 255)
    return out


def to_svg(img: Image.Image) -> str:
    """One <rect> per run of same-colored pixels in a row."""
    px = img.load()
    rects = []
    for y in range(img.height):
        x = 0
        while x < img.width:
            c = px[x, y]
            run = 1
            while x + run < img.width and px[x + run, y] == c:
                run += 1
            if c[3] > 0:
                rects.append(f'<rect x="{x}" y="{y}" width="{run}" height="1" fill="#{c[0]:02x}{c[1]:02x}{c[2]:02x}"/>')
            x += run
    body = "".join(rects)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {img.width} {img.height}" '
        f'shape-rendering="crispEdges"><title>Rectal Rabbit</title>{body}</svg>\n'
    )


def scaled(img: Image.Image, size: int) -> Image.Image:
    """Big, crisp pixels: scale up by a whole number, then trim the edges to fit."""
    k = math.ceil(size / img.width)
    big = img.resize((img.width * k, img.height * k), Image.NEAREST)
    left = (big.width - size) // 2
    top = (big.height - size) // 2
    return big.crop((left, top, left + size, top + size))


def main() -> int:
    img = scene()
    (PUBLIC / "icon.svg").write_text(to_svg(img))
    scaled(img, 32).save(PUBLIC / "favicon.png")
    # Apple's icon has no see-through parts (iOS rounds the corners itself).
    scaled(img, 180).convert("RGB").save(PUBLIC / "apple-touch-icon.png")
    scaled(img, 192).save(PUBLIC / "icon-192.png")
    scaled(img, 512).save(PUBLIC / "icon-512.png")
    scaled(img, 48).save(PUBLIC / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    print("icons written to public/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
