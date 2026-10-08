"""Build the static 1200 x 630 social preview from the generated background.

Requires Pillow and a Korean font. Pass --font when the default system font
is unavailable. This script is only needed when changing the share card.
"""

from argparse import ArgumentParser
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
SOCIAL = ROOT / "public" / "images" / "social"
SIZE = (1200, 630)


def find_font(explicit: str | None) -> Path:
    candidates = [
        Path(explicit) if explicit else None,
        Path("C:/Windows/Fonts/malgunbd.ttf"),
        Path("/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf"),
        Path("/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc"),
        Path("/System/Library/Fonts/AppleSDGothicNeo.ttc"),
    ]
    for path in candidates:
        if path and path.is_file():
            return path
    raise SystemExit("Korean font not found. Pass --font PATH.")


def fit_font(draw: ImageDraw.ImageDraw, text: str, font_path: Path, size: int, max_width: int) -> ImageFont.FreeTypeFont:
    while size >= 16:
        font = ImageFont.truetype(str(font_path), size)
        if draw.textbbox((0, 0), text, font=font)[2] <= max_width:
            return font
        size -= 1
    raise SystemExit(f"Text is too wide: {text}")


def main() -> None:
    parser = ArgumentParser()
    parser.add_argument("--font", help="Path to a bold Korean font")
    args = parser.parse_args()

    background = Image.open(SOCIAL / "share-background.png").convert("RGB")
    card = ImageOps.fit(background, SIZE, method=Image.Resampling.LANCZOS).convert("RGBA")
    shade = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    shade_draw = ImageDraw.Draw(shade)
    for x in range(960):
        opacity = round(230 * (1 - x / 960) ** 1.1)
        shade_draw.line((x, 0, x, SIZE[1]), fill=(12, 18, 37, opacity))
    card = Image.alpha_composite(card, shade)
    draw = ImageDraw.Draw(card)
    font_path = find_font(args.font)

    logo = Image.open(ROOT / "public" / "images" / "brand" / "logo-original-on-dark.png").convert("RGBA")
    logo.thumbnail((342, 92), Image.Resampling.LANCZOS)
    card.alpha_composite(logo, (72, 55))

    gold = "#FFD05A"
    white = "#FFFFFF"
    muted = "#D8DCE8"
    kicker = "SELLERBRICKS STUDIO"
    first = "좋은 상품이,"
    second = "더 멀리 닿는 라이브."
    detail = "창고(스튜디오) 찾기  ·  라이브 준비  ·  판매 관리"

    draw.rounded_rectangle((72, 201, 474, 249), radius=24, fill=(25, 30, 49, 230), outline=(245, 166, 35, 160), width=2)
    draw.text((94, 211), kicker, font=ImageFont.truetype(str(font_path), 21), fill=gold)
    draw.rounded_rectangle((72, 284, 78, 444), radius=3, fill=gold)
    draw.text((100, 283), first, font=fit_font(draw, first, font_path, 57, 610), fill=white, stroke_width=1, stroke_fill="#11172B")
    draw.text((100, 368), second, font=fit_font(draw, second, font_path, 57, 610), fill=gold, stroke_width=1, stroke_fill="#11172B")
    draw.line((73, 499, 635, 499), fill=(245, 166, 35, 190), width=2)
    draw.text((73, 523), detail, font=fit_font(draw, detail, font_path, 25, 620), fill=muted)

    output = SOCIAL / "share-card.png"
    share_jpg = SOCIAL / "share-card-v3.jpg"
    rgb_card = card.convert("RGB")
    rgb_card.save(output, optimize=True)
    rgb_card.save(share_jpg, quality=90, optimize=True, progressive=True)
    print(output)
    print(share_jpg)


if __name__ == "__main__":
    main()
