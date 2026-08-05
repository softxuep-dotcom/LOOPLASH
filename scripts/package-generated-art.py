"""Package ImageGen source sheets into runtime-ready Looplash WebP assets."""

from __future__ import annotations

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "artifacts" / "art-source"
CREATURE_DIR = ROOT / "public" / "assets" / "art" / "creatures"
PLAYER_DIR = ROOT / "public" / "assets" / "art" / "player"
ENVIRONMENT_DIR = ROOT / "public" / "assets" / "art" / "environment"

FRAME_SIZE = 256
FRAME_PADDING = 16

SHEETS: tuple[tuple[str, tuple[str, str, str, str]], ...] = (
    (
        "meadow-creatures-transparent.png",
        ("puff", "needler", "shellbud", "bomb-bloom"),
    ),
    (
        "reef-creatures-transparent.png",
        ("skipper", "splitter", "mirrorling", "bubble-ray"),
    ),
    (
        "elite-creatures-transparent.png",
        ("knot-knight", "storm-spool", "twin-maw", "tanglejaw"),
    ),
)


def alpha_bounds(image: Image.Image) -> tuple[int, int, int, int]:
    alpha = image.getchannel("A")
    bounds = alpha.getbbox()
    if bounds is None:
        raise ValueError("source cell contains no opaque pixels")
    return bounds


def package_quad_sheet(
    filename: str,
    names: tuple[str, str, str, str],
    output_dir: Path,
) -> None:
    source = Image.open(SOURCE_DIR / filename).convert("RGBA")
    cell_width = source.width // 2
    cell_height = source.height // 2
    available = FRAME_SIZE - FRAME_PADDING * 2

    for index, name in enumerate(names):
        column = index % 2
        row = index // 2
        cell = source.crop(
            (
                column * cell_width,
                row * cell_height,
                (column + 1) * cell_width,
                (row + 1) * cell_height,
            )
        )
        subject = cell.crop(alpha_bounds(cell))
        scale = min(available / subject.width, available / subject.height)
        size = (
            max(1, round(subject.width * scale)),
            max(1, round(subject.height * scale)),
        )
        subject = subject.resize(size, Image.Resampling.LANCZOS)
        frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
        frame.alpha_composite(
            subject,
            ((FRAME_SIZE - subject.width) // 2, (FRAME_SIZE - subject.height) // 2),
        )
        frame.save(output_dir / f"{name}.webp", "WEBP", lossless=True, method=6)
        print(f"{name}: {size[0]}x{size[1]} subject in {FRAME_SIZE}x{FRAME_SIZE}")


def package_backgrounds() -> None:
    source = Image.open(SOURCE_DIR / "biome-backgrounds.png").convert("RGB")
    panel_width = source.width // 2
    panels = {
        "meadow": source.crop((0, 0, panel_width, source.height)),
        "reef": source.crop((panel_width, 0, source.width, source.height)),
    }
    for name, panel in panels.items():
        mirrored = panel.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        tile = Image.new("RGB", (panel.width * 2, panel.height))
        tile.paste(panel, (0, 0))
        tile.paste(mirrored, (panel.width, 0))
        tile.save(ENVIRONMENT_DIR / f"{name}.webp", "WEBP", quality=86, method=6)
        print(f"{name} background: {tile.width}x{tile.height}")


def main() -> None:
    CREATURE_DIR.mkdir(parents=True, exist_ok=True)
    PLAYER_DIR.mkdir(parents=True, exist_ok=True)
    ENVIRONMENT_DIR.mkdir(parents=True, exist_ok=True)
    for filename, names in SHEETS:
        package_quad_sheet(filename, names, CREATURE_DIR)
    package_quad_sheet(
        "player-and-needles-transparent.png",
        ("loomheart", "needle-dawn", "needle-twin", "needle-moon"),
        PLAYER_DIR,
    )
    package_backgrounds()


if __name__ == "__main__":
    main()
