#!/usr/bin/env python3
"""
Generate the app's PWA icons (no external image assets required).

Design: a teal gradient tile holding a white "bill" card with ledger lines and a
badge carrying a check-mark — i.e. "obligation settled".

Outputs into `public/`:
  icons/icon-192.png   icons/icon-512.png
  icons/maskable-192.png  icons/maskable-512.png
  apple-touch-icon.png (180)
"""

from __future__ import annotations

import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public")
ICONS = os.path.join(OUT, "icons")

SS = 4  # supersampling factor

GRADIENT_TOP = (20, 184, 166)      # teal-500
GRADIENT_BOTTOM = (11, 88, 82)     # deep teal
CARD = (255, 255, 255)
LINE = (13, 148, 136)              # teal-600
LINE_SOFT = (148, 214, 205)
BADGE = (255, 255, 255)
BADGE_INNER = (13, 148, 136)


def gradient_image(w: int, h: int) -> Image.Image:
    """Diagonal gradient built on a tiny buffer then upscaled (fast + smooth)."""
    small = 48
    buf = Image.new("RGB", (small, small))
    px = buf.load()
    for y in range(small):
        for x in range(small):
            # normalised position along the 140deg-ish diagonal
            t = (x / (small - 1)) * 0.42 + (y / (small - 1)) * 0.58
            r = int(GRADIENT_TOP[0] + (GRADIENT_BOTTOM[0] - GRADIENT_TOP[0]) * t)
            g = int(GRADIENT_TOP[1] + (GRADIENT_BOTTOM[1] - GRADIENT_TOP[1]) * t)
            b = int(GRADIENT_TOP[2] + (GRADIENT_BOTTOM[2] - GRADIENT_TOP[2]) * t)
            px[x, y] = (r, g, b)
    return buf.resize((w, h), Image.BILINEAR)


def rounded_mask(size: int, radius: float) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(radius), fill=255)
    return mask


def check_points(cx: float, cy: float, s: float) -> list[tuple[float, float]]:
    """Poly-line of a check-mark centred on (cx, cy) with overall scale s."""
    return [
        (cx - 0.50 * s, cy + 0.02 * s),
        (cx - 0.14 * s, cy + 0.38 * s),
        (cx + 0.52 * s, cy - 0.36 * s),
    ]


def draw_art(size: int, scale: float) -> Image.Image:
    """Render the icon artwork at `size` px; `scale` shrinks content for maskable safe-zone."""
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(canvas)

    cx = size / 2
    cy = size / 2

    def S(v: float) -> float:
        """map a unit-coordinate (0..1) to canvas px, honouring content scale."""
        return cx + (v - 0.5) * size * scale

    # ---- card (the "bill") ----
    card_x0, card_y0 = S(0.245), S(0.185)
    card_x1, card_y1 = S(0.755), S(0.735)
    d.rounded_rectangle(
        [card_x0, card_y0, card_x1, card_y1],
        radius=(card_x1 - card_x0) * 0.12,
        fill=CARD + (255,),
    )

    # ---- ledger lines inside the card ----
    lw = (card_x1 - card_x0)
    line_h = lw * 0.055
    xs0 = card_x0 + lw * 0.12
    for i, (frac, color) in enumerate([(0.56, LINE), (0.46, LINE_SOFT), (0.34, LINE_SOFT)]):
        ly = card_y0 + lw * (0.155 + i * 0.145)
        d.rounded_rectangle(
            [xs0, ly, xs0 + lw * frac, ly + line_h],
            radius=line_h / 2,
            fill=color + (255,),
        )

    # ---- badge with check ----
    br = (card_x1 - card_x0) * 0.26
    bx, by = S(0.665), S(0.735)
    d.ellipse([bx - br * 1.16, by - br * 1.16, bx + br * 1.16, by + br * 1.16], fill=BADGE + (255,))
    d.ellipse([bx - br, by - br, bx + br, by + br], fill=BADGE_INNER + (255,))
    pts = check_points(bx, by + br * 0.02, br * 1.12)
    d.line(pts, fill=(255, 255, 255, 255), width=int(br * 0.30), joint="curve")
    for p in pts:
        rr = br * 0.15
        d.ellipse([p[0] - rr, p[1] - rr, p[0] + rr, p[1] + rr], fill=(255, 255, 255, 255))

    return canvas


def build(final_size: int, maskable: bool, path: str) -> None:
    big = final_size * SS
    scale = 0.80 if maskable else 1.0

    art = draw_art(big, scale)

    bg = gradient_image(big, big).convert("RGBA")
    # soft top-right highlight
    hi = Image.new("L", (big, big), 0)
    hd = ImageDraw.Draw(hi)
    hd.ellipse(
        [big * 0.42, -big * 0.45, big * 1.45, big * 0.58],
        fill=46,
    )
    bg.putalpha(255)
    overlay = Image.new("RGBA", (big, big), (255, 255, 255, 0))
    overlay.putalpha(hi)
    bg = Image.alpha_composite(bg, overlay)

    comp = Image.alpha_composite(bg, art)

    if maskable:
        # full-bleed square (launcher will crop it)
        out = comp
    else:
        radius = big * 0.2237  # matches modern Android/iOS squircle feel
        mask = rounded_mask(big, radius)
        out = Image.new("RGBA", (big, big), (0, 0, 0, 0))
        out.paste(comp, (0, 0), mask)

    out = out.resize((final_size, final_size), Image.LANCZOS)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    out.save(path, "PNG", optimize=True)
    print(f"  wrote {os.path.relpath(path, ROOT)}  ({os.path.getsize(path)} bytes)")


def main() -> None:
    print("Generating PWA icons…")
    build(512, False, os.path.join(ICONS, "icon-512.png"))
    build(192, False, os.path.join(ICONS, "icon-192.png"))
    build(384, False, os.path.join(ICONS, "icon-384.png"))
    build(512, True, os.path.join(ICONS, "maskable-512.png"))
    build(192, True, os.path.join(ICONS, "maskable-192.png"))
    build(180, False, os.path.join(OUT, "apple-touch-icon.png"))
    build(64, False, os.path.join(OUT, "icons", "icon-64.png"))
    print("Done.")


if __name__ == "__main__":
    main()
