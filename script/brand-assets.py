"""Regenerate Resonance's icons, favicon, splash screens and in-app shield
from the Blue Ember teal-flame shield (design/brand/bew_logo_source.jpg,
copied from KEWT's public/bew_logo.jpg, which is never modified).

Run from the project folder:  python script/brand-assets.py
Needs: pip install --user pillow numpy scipy
The source is a 1024 px raster; the shield alone is ~414x535 px. That covers
web-app icons (up to 512) but not a 1024 store icon: commission a vector first.
"""
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "design" / "brand" / "bew_logo_source.jpg"
OUT = ROOT / "client" / "public"
SAND, LINEN = (232, 221, 201, 255), (245, 243, 238, 255)


def extract_shield() -> Image.Image:
    a = np.asarray(Image.open(SRC).convert("RGB")).astype(float)
    top = a[:660]  # the wordmark sits below
    bg = np.median(np.concatenate([top[:40, :40].reshape(-1, 3), top[:40, -40:].reshape(-1, 3)]), axis=0)
    dist = np.sqrt(((top - bg) ** 2).sum(-1))
    lab, n = ndimage.label(dist > 60)
    sizes = ndimage.sum(dist > 60, lab, range(1, n + 1))
    shield = ndimage.binary_fill_holes(lab == 1 + int(np.argmax(sizes)))
    ys, xs = np.where(shield)
    y0, x0 = max(0, ys.min() - 6), max(0, xs.min() - 6)
    y1, x1 = ys.max() + 6, xs.max() + 6
    crop, d, inside = top[y0:y1 + 1, x0:x1 + 1], dist[y0:y1 + 1, x0:x1 + 1], shield[y0:y1 + 1, x0:x1 + 1]
    ramp = np.clip((d - 25) / 65, 0, 1)
    alpha = np.where(ndimage.binary_erosion(inside, iterations=2), 1.0,
                     np.where(ndimage.binary_dilation(inside, iterations=2), ramp, 0.0))
    al = np.clip(alpha, 1e-3, 1)[..., None]
    rgb = np.clip((crop - (1 - al) * bg) / al, 0, 255)  # remove the paper tint from edge pixels
    return Image.fromarray(np.dstack([rgb, alpha * 255]).astype(np.uint8), "RGBA")


def place(m, canvas, frac_h, bg, name):
    W, H = canvas
    c = Image.new("RGBA", (W, H), bg)
    h = round(min(W, H) * frac_h)
    w = round(m.width * h / m.height)
    c.alpha_composite(m.resize((w, h), Image.LANCZOS), ((W - w) // 2, (H - h) // 2))
    c.convert("RGB").save(OUT / name, optimize=True)


def main():
    m = extract_shield()
    for n in (72, 96, 128, 144, 152, 192, 384, 512):
        place(m, (n, n), 0.78, SAND, f"icon-{n}x{n}.png")
    place(m, (180, 180), 0.76, SAND, "apple-touch-icon.png")
    place(m, (512, 512), 0.56, SAND, "icon-maskable-512.png")  # inside Android's 80% safe circle
    fav = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
    w = round(m.width * 46 / m.height)
    fav.alpha_composite(m.resize((w, 46), Image.LANCZOS), ((48 - w) // 2, 1))
    fav.save(OUT / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    m.resize((round(m.width * 240 / m.height), 240), Image.LANCZOS).save(OUT / "brand-shield.png", optimize=True)
    for W, H in [(1125, 2436), (1242, 2688), (828, 1792), (750, 1334), (2048, 2732), (1668, 2388)]:
        place(m, (W, H), 0.30, LINEN, f"splash-{W}x{H}.png")
    print("brand assets written to", OUT)


if __name__ == "__main__":
    main()
