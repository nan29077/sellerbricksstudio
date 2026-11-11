"""Build the dark STORAGE MARKET logo, standalone marks, and browser icons.

The approved light logo is the wordmark source. The warehouse, play button,
and REC dot follow the grid in studio-favicon-source.svg. Requires Pillow.
"""

from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / "public" / "images" / "brand"
NAVY = (26, 26, 46, 255)
# Lifted navy so the mark tile stays visible on navy page backgrounds.
NAVY_ON_DARK = (43, 49, 84, 255)
GOLD = (245, 166, 35, 255)
RED = (255, 59, 48, 255)


def _round_poly(d, pts, fill, r):
    """Fill a polygon and stroke it with round joins (like SVG stroke-linejoin=round)."""
    d.polygon(pts, fill=fill)
    for i, (x1, y1) in enumerate(pts):
        x2, y2 = pts[(i + 1) % len(pts)]
        d.line((x1, y1, x2, y2), fill=fill, width=max(1, round(2 * r)))
        d.ellipse((x1 - r, y1 - r, x1 + r, y1 + r), fill=fill)

def draw_mark(size: int, tile=NAVY, full_bleed: bool = False) -> Image.Image:
    """Studio mark: gold warehouse with a play button and a red REC dot.
    Coordinates follow the 64-unit grid of studio-favicon-source.svg."""
    ss=8; S=size*ss; u=S/64
    im=Image.new("RGBA",(S,S),(0,0,0,0)); d=ImageDraw.Draw(im)
    if full_bleed: d.rectangle((0,0,S,S),fill=tile)
    else: d.rounded_rectangle((0,0,S-1,S-1),radius=14*u,fill=tile)
    P=lambda pts:[(x*u,y*u) for x,y in pts]
    body=P([(8,27),(32,15),(56,27),(56,53),(8,53)])
    _round_poly(d,body,GOLD,1*u)
    tri=P([(27,31),(27,47),(41,39)])
    _round_poly(d,tri,tile,1.25*u)
    r=6.5*u+1.25*u; cx,cy=52*u,12*u
    d.ellipse((cx-r,cy-r,cx+r,cy+r),fill=tile)
    r=6.5*u-1.25*u
    d.ellipse((cx-r,cy-r,cx+r,cy+r),fill=RED)
    return im.resize((size,size),Image.Resampling.LANCZOS)


def make_dark_logo(mark: Image.Image) -> None:
    """Lift the charcoal lettering for dark backgrounds and reuse the gold lettering."""
    with Image.open(BRAND / "storage-market-logo-on-light.png") as light_logo:
        dark_logo = light_logo.convert("RGBA")
    pixels = dark_logo.load()
    for y in range(dark_logo.height):
        for x in range(mark.width, dark_logo.width):
            r, g, b, a = pixels[x, y]
            if a and max(r, g, b) <= 60 and max(r, g, b) - min(r, g, b) < 9:
                pixels[x, y] = (236, 240, 246, a)
    dark_logo.paste(mark, (0, 0))
    dark_logo.save(BRAND / "storage-market-logo-on-dark.png", optimize=True)


light_mark = draw_mark(240, NAVY)
dark_mark = draw_mark(240, NAVY_ON_DARK)
light_mark.save(BRAND / "mark-original-on-light.png", optimize=True)
dark_mark.save(BRAND / "mark-original-on-dark.png", optimize=True)
make_dark_logo(dark_mark)

draw_mark(64, NAVY).save(ROOT / "src" / "app" / "icon.png", optimize=True)
favicon = draw_mark(256, NAVY)
for path in (ROOT / "src" / "app" / "favicon.ico", ROOT / "public" / "favicon.ico"):
    favicon.save(path, sizes=[(16, 16), (32, 32), (48, 48)])
# iOS rounds the corners itself, so the apple icon is full bleed.
draw_mark(180, NAVY, full_bleed=True).convert("RGB").save(ROOT / "src" / "app" / "apple-icon.png", optimize=True)
print(BRAND)
