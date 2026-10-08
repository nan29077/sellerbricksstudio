"""Add STUDIO beneath the original Seller Bricks logo supplied by the owner.

The transparent crop at public/images/brand/original-logo-source.png is the
source asset. This script makes light/dark logo variants and browser icons.
Requires Pillow and a bold Latin font.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / "public" / "images" / "brand"
SOURCE = Image.open(BRAND / "original-logo-source.png").convert("RGBA")
FONT = Path("C:/Windows/Fonts/arialbd.ttf")
if not FONT.is_file():
    FONT = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")


def is_gold(red: int, green: int, blue: int) -> bool:
    return red > blue + 40 and green > blue + 25 and red > green + 10


def variant(image: Image.Image, dark_background: bool) -> Image.Image:
    if not dark_background:
        return image.copy()
    pixels = []
    for index, (red, green, blue, alpha) in enumerate(image.get_flattened_data()):
        x = index % image.width
        if x >= 80 or is_gold(red, green, blue):
            # Keep the supplied SELLERBRICKS lettering and gold details intact.
            pixels.append((red, green, blue, alpha))
        elif max(red, green, blue) < 135:
            # Only recolor the speech-bubble symbol around the play button.
            # Muted blue gray keeps the mark visible on navy without turning it white.
            pixels.append((86, 96, 120, alpha))
        else:
            # Darken any pale edge pixels around the symbol so it does not glow.
            pixels.append((25, 31, 49, alpha))
    result = Image.new("RGBA", image.size)
    result.putdata(pixels)
    return result


def make_wordmark(name: str, dark_background: bool) -> None:
    scale = 3
    original = variant(SOURCE, dark_background)
    original = original.resize((SOURCE.width * scale, SOURCE.height * scale), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (original.width + 12, original.height + 64), (0, 0, 0, 0))
    canvas.alpha_composite(original, (0, 0))

    draw = ImageDraw.Draw(canvas)
    font = ImageFont.truetype(str(FONT), 64)
    label = "STUDIO"
    spacing = 14
    label_width = sum(draw.textlength(letter, font=font) for letter in label) + spacing * (len(label) - 1)
    # The source wordmark begins after the symbol, at approximately x=80.
    wordmark_center = (80 + SOURCE.width) * scale / 2
    x = wordmark_center - label_width / 2
    for letter in label:
        draw.text((round(x), 199), letter, font=font, fill="#202126")
        x += draw.textlength(letter, font=font) + spacing

    bounds = canvas.getbbox()
    if bounds:
        canvas = canvas.crop((0, 0, bounds[2] + 8, bounds[3] + 10))
    canvas.save(BRAND / name, optimize=True)


def make_mark(name: str, dark_background: bool) -> Image.Image:
    mark = variant(SOURCE.crop((0, 0, 80, SOURCE.height)), dark_background)
    bounds = mark.getbbox()
    if bounds:
        mark = mark.crop(bounds)
    mark = mark.resize((mark.width * 3, mark.height * 3), Image.Resampling.LANCZOS)
    mark.save(BRAND / name, optimize=True)
    return mark


make_wordmark("logo-original-on-light.png", False)
make_wordmark("logo-original-on-dark.png", True)
mark = make_mark("mark-original-on-light.png", False)
make_mark("mark-original-on-dark.png", True)

icon = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
icon_mark = mark.copy()
icon_mark.thumbnail((54, 58), Image.Resampling.LANCZOS)
icon.alpha_composite(icon_mark, ((64 - icon_mark.width) // 2, (64 - icon_mark.height) // 2))
icon.save(ROOT / "src" / "app" / "icon.png", optimize=True)
for path in (ROOT / "src" / "app" / "favicon.ico", ROOT / "public" / "favicon.ico"):
    icon.save(path, sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])

apple_icon = Image.new("RGBA", (180, 180), "#FFFFFF")
apple_mark = mark.copy()
apple_mark.thumbnail((145, 155), Image.Resampling.LANCZOS)
apple_icon.alpha_composite(apple_mark, ((180 - apple_mark.width) // 2, (180 - apple_mark.height) // 2))
apple_icon.save(ROOT / "src" / "app" / "apple-icon.png", optimize=True)
print(BRAND)
