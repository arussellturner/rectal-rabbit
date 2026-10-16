"""
Hand-drawn extra rabbit frames, added on the end of public/sprites/rabbit.png:

  12  vomit, mouth half open (eyes squeezed shut)
  13  vomit, mouth WIDE open, tongue out

They're built from frame 0 (sitting), pixel by pixel, so they match the
rest of the sheet. extract_sprites.py runs this after it rebuilds the
sheet; you can also run it on its own:

    .venv/bin/python tools/rabbit_extra_frames.py
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SHEET = ROOT / "public" / "sprites" / "rabbit.png"
META = ROOT / "public" / "sprites" / "sheets.json"

FW, FH = 36, 30
#: Frames that come out of the drawing (art/source/rabbit-sheet.jpg).
BASE_FRAMES = 12

INK = (10, 2, 2, 255)  # the outline
FUR = (212, 140, 92, 255)
SHADE = (176, 104, 76, 255)
MOUTH = (110, 16, 28, 255)  # inside of the mouth
THROAT = (64, 6, 14, 255)
TONGUE = (240, 116, 128, 255)
TOOTH = (255, 250, 238, 255)
NOSE = (245, 139, 146, 255)
CLEAR = (0, 0, 0, 0)

# Each picture is drawn over frame 0, on the head (x 22..31, y 15..23).
# '.' = leave frame 0's pixel alone, ' ' = see-through.
LEGEND = {"K": INK, "F": FUR, "S": SHADE, "M": MOUTH, "D": THROAT, "T": TONGUE, "W": TOOTH, "P": NOSE, " ": CLEAR}
LEFT, TOP = 22, 15

HALF_OPEN = [
    # 2345678901   (x = 22..31)
    "..........",  # 15
    ".FKK......",  # 16  eyes squeezed shut
    ".FFF......",  # 17
    "..........",  # 18
    "...KMMMW  ",  # 19  mouth open (a buck tooth)
    "...KDTTK  ",  # 20
    "...FKKKK  ",  # 21
    "..........",  # 22
    "..........",  # 23
]

WIDE_OPEN = [
    # 2345678901   (x = 22..31)
    "..........",  # 15
    ".FKK......",  # 16  eyes squeezed shut
    ".FFF..KKK ",  # 17  snout pushed up and out
    ".....FFFPK",  # 18  (pink nose on the tip)
    "...KMMMWW ",  # 19  buck teeth, mouth WIDE open at the front
    "...KDMMMM ",  # 20
    "...KDDMMM ",  # 21
    "...KDTTTT ",  # 22  tongue out
    "...KFFFFFK",  # 23  jaw dropped right down
    "....KKKKK ",  # 24
]


def draw(base: Image.Image, picture: list[str]) -> Image.Image:
    frame = base.copy()
    for dy, row in enumerate(picture):
        for dx, ch in enumerate(row):
            if ch != ".":
                frame.putpixel((LEFT + dx, TOP + dy), LEGEND[ch])
    return frame


def main() -> int:
    sheet = Image.open(SHEET).convert("RGBA")
    # Start from just the drawn frames, so running this twice doesn't add them twice.
    base = sheet.crop((0, 0, BASE_FRAMES * FW, FH))
    sitting = base.crop((0, 0, FW, FH))
    extras = [draw(sitting, HALF_OPEN), draw(sitting, WIDE_OPEN)]

    out = Image.new("RGBA", ((BASE_FRAMES + len(extras)) * FW, FH))
    out.paste(base, (0, 0))
    for i, frame in enumerate(extras):
        out.paste(frame, ((BASE_FRAMES + i) * FW, 0))
    out.save(SHEET)

    meta = json.loads(META.read_text()) if META.exists() else {}
    meta.setdefault("rabbit", {"frameWidth": FW, "frameHeight": FH})["frames"] = BASE_FRAMES + len(extras)
    META.write_text(json.dumps(meta, indent=2) + "\n")
    print(f"rabbit: added {len(extras)} vomit frames ({BASE_FRAMES}..{BASE_FRAMES + len(extras) - 1})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
