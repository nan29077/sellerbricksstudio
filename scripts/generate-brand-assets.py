"""Build the Seller Bricks Studio logo set.

The symbol is the studio mark (gold warehouse + play button + red REC dot),
drawn in code on the same 64-unit grid as studio-favicon-source.svg. The
SELLERBRICKS lettering comes from the transparent crop at
public/images/brand/original-logo-source.png, with STUDIO set beneath it.
This script makes light/dark logo variants, the standalone marks and the
browser icons. Requires Pillow and a bold Latin font.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / "public" / "images" / "brand"
SOURCE = Image.open(BRAND / "original-logo-source.png").convert("RGBA")
FONT = Path("C:/Windows/Fonts/arialbd.ttf")
if not FONT.is_file():
    FONT = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")

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


def is_gold(red: int, green: int, blue: int) -> bool:
    return red > blue + 40 and green > blue + 25 and red > green + 10


def variant(image: Image.Image, dark_background: bool) -> Image.Image:
    if not dark_background:
        return image.copy()
    pixels = []
    for index, (red, green, blue, alpha) in enumerate(image.get_flattened_data()):
        x = index % image.width
        if is_gold(red, green, blue):
            pixels.append((red, green, blue, alpha))
        elif 80 <= x < 234 and max(red, green, blue) < 70:
            # Recolor only the solid SELLER letter interiors.
            pixels.append((222, 227, 235, alpha))
        elif x < 80 and max(red, green, blue) < 135:
            # Only recolor the speech-bubble symbol around the play button.
            # Muted blue gray keeps the mark visible on navy without turning it white.
            pixels.append((86, 96, 120, alpha))
        else:
            # Remove the source raster's outline. Transparency lets the exact
            # page background show through in the footer, sidebar and cards.
            pixels.append((0, 0, 0, 0))
    result = Image.new("RGBA", image.size)
    result.putdata(pixels)
    return result


def make_wordmark(name: str, dark_background: bool) -> None:
    scale = 3
    # Lettering only: the old symbol lives in x < 80 of the source crop.
    letters = variant(SOURCE, dark_background).crop((80, 0, SOURCE.width, SOURCE.height))
    letters = letters.resize((letters.width * scale, letters.height * scale), Image.Resampling.LANCZOS)
    text = Image.new("RGBA", (letters.width + 12, letters.height + 96), (0, 0, 0, 0))
    text.alpha_composite(letters, (0, 0))

    draw = ImageDraw.Draw(text)
    font = ImageFont.truetype(str(FONT), 72)
    x = 0
    for letter in "STUDIO":
        draw.text((round(x), 220), letter, font=font, fill="#D5DCE8" if dark_background else "#202126")
        x += draw.textlength(letter, font=font) + 16

    top, bottom = text.getbbox()[1], text.getbbox()[3]
    # The mark is as tall as the SELLERBRICKS + STUDIO block.
    mark = draw_mark(bottom - top + 8, NAVY_ON_DARK if dark_background else NAVY)
    gap = 30
    canvas = Image.new("RGBA", (mark.width + gap + text.width, text.height), (0, 0, 0, 0))
    canvas.alpha_composite(mark, (0, max(0, top - 4)))
    canvas.alpha_composite(text, (mark.width + gap, 0))
    bounds = canvas.getbbox()
    canvas = canvas.crop((0, bounds[1], bounds[2] + 8, bounds[3] + 6))
    canvas.save(BRAND / name, optimize=True)


make_wordmark("logo-original-on-light.png", False)
make_wordmark("logo-original-on-dark.png", True)
draw_mark(240, NAVY).save(BRAND / "mark-original-on-light.png", optimize=True)
draw_mark(240, NAVY_ON_DARK).save(BRAND / "mark-original-on-dark.png", optimize=True)

draw_mark(64, NAVY).save(ROOT / "src" / "app" / "icon.png", optimize=True)
favicon = draw_mark(256, NAVY)
for path in (ROOT / "src" / "app" / "favicon.ico", ROOT / "public" / "favicon.ico"):
    favicon.save(path, sizes=[(16, 16), (32, 32), (48, 48)])
# iOS rounds the corners itself, so the apple icon is full bleed.
draw_mark(180, NAVY, full_bleed=True).convert("RGB").save(ROOT / "src" / "app" / "apple-icon.png", optimize=True)
print(BRAND)
