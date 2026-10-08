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
    draw = ImageDraw.Draw(card)
    font_path = find_font(args.font)

    logo = Image.open(ROOT / "public" / "images" / "bee" / "studio-logo-main.png").convert("RGBA")
    logo.thumbnail((318, 84), Image.Resampling.LANCZOS)
    card.alpha_composite(logo, (72, 63))

    gold = "#FFD05A"
    white = "#FFFFFF"
    muted = "#D8DCE8"
    kicker = "셀러를 위한 올인원 성장 파트너"
    first = "방송에만 집중하세요."
    second = "나머지는 우리가 합니다."
    detail = "라이브커머스 · 스튜디오 · 정산 · 성장 지원"

    draw.rounded_rectangle((72, 204, 497, 250), radius=23, fill="#26283B", outline="#B78022", width=2)
    draw.text((91, 211), kicker, font=ImageFont.truetype(str(font_path), 22), fill=gold)
    draw.text((71, 286), first, font=fit_font(draw, first, font_path, 54, 635), fill=white, stroke_width=1, stroke_fill="#172039")
    draw.text((71, 370), second, font=fit_font(draw, second, font_path, 54, 635), fill=gold, stroke_width=1, stroke_fill="#172039")
    draw.line((73, 493, 649, 493), fill=(245, 166, 35, 180), width=2)
    draw.text((73, 517), detail, font=fit_font(draw, detail, font_path, 26, 765), fill=muted)

    output = SOCIAL / "share-card.png"
    card.convert("RGB").save(output, optimize=True)
    print(output)


if __name__ == "__main__":
    main()
