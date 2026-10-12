#!/usr/bin/env python3
"""Render the extension icons (extension/icons/icon{16,32,48,128}.png).

Run once after changing the design: python3 scripts/make-icons.py
The PNGs are committed, so the extension itself has no build step.
"""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "extension" / "icons"
SIZE = 512
BLUE = (37, 99, 235, 255)
WHITE = (255, 255, 255, 255)
FADED = (255, 255, 255, 110)
RED = (248, 113, 113, 255)


def tab(draw: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int, fill) -> None:
    """A browser tab: rounded top corners, flat bottom."""
    r = h // 3
    draw.rounded_rectangle((x, y, x + w, y + h), radius=r, fill=fill)
    draw.rectangle((x, y + h - r, x + w, y + h), fill=fill)


def render() -> Image.Image:
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle((16, 16, SIZE - 16, SIZE - 16), radius=110, fill=BLUE)
    # Three tabs in a row: two kept, the oldest one faded out.
    tab(draw, 70, 150, 110, 80, FADED)
    tab(draw, 196, 150, 110, 80, WHITE)
    tab(draw, 322, 150, 110, 80, WHITE)
    # Browser body under the kept tabs.
    draw.rounded_rectangle((196, 222, 442, 400), radius=26, fill=WHITE)
    # Strike through the faded tab.
    draw.line((62, 262, 188, 118), fill=RED, width=28)
    return img


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    big = render()
    for size in (16, 32, 48, 128):
        big.resize((size, size), Image.LANCZOS).save(OUT / f"icon{size}.png", optimize=True)


if __name__ == "__main__":
    main()
