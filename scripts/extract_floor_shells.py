from __future__ import annotations

from collections import defaultdict
from pathlib import Path
from typing import Iterable
import html

import pymupdf


SOURCE = Path(r"C:\Users\Jhayzo\Downloads\Evacuation-plan-OnePerFloor.pdf")
OUTPUT = Path(r"C:\Mabansag\OJT\InventorySystem\public\floor-plans")

# Crops isolate the architectural drawing and discard the evacuation legend,
# branding, page headings, and unused page margins.
CROPS = [
    (195, 40, 1000, 730),
    (200, 27, 995, 712),
    (200, 35, 1000, 720),
    (194, 29, 987, 710),
    (194, 44, 987, 711),
    (194, 20, 1000, 708),
    (194, 44, 994, 710),
]


def neutral(color: tuple[float, ...] | None) -> bool:
    return color is not None and max(color) - min(color) <= 0.04


def point(value: object) -> tuple[float, float]:
    return float(value.x), float(value.y)


def number(value: float) -> str:
    return f"{value:.2f}".rstrip("0").rstrip(".")


def path_commands(items: Iterable[tuple]) -> str:
    commands: list[str] = []
    for item in items:
        kind = item[0]
        if kind == "l":
            x1, y1 = point(item[1])
            x2, y2 = point(item[2])
            commands.append(f"M{number(x1)} {number(y1)}L{number(x2)} {number(y2)}")
        elif kind == "c":
            x1, y1 = point(item[1])
            x2, y2 = point(item[2])
            x3, y3 = point(item[3])
            x4, y4 = point(item[4])
            commands.append(
                f"M{number(x1)} {number(y1)}C{number(x2)} {number(y2)} "
                f"{number(x3)} {number(y3)} {number(x4)} {number(y4)}"
            )
        elif kind == "re":
            rect = item[1]
            commands.append(
                f"M{number(rect.x0)} {number(rect.y0)}H{number(rect.x1)}"
                f"V{number(rect.y1)}H{number(rect.x0)}Z"
            )
        elif kind == "qu":
            quad = item[1]
            commands.append(
                f"M{number(quad.ul.x)} {number(quad.ul.y)}"
                f"L{number(quad.ur.x)} {number(quad.ur.y)}"
                f"L{number(quad.lr.x)} {number(quad.lr.y)}"
                f"L{number(quad.ll.x)} {number(quad.ll.y)}Z"
            )
    return "".join(commands)


def intersects(rect: pymupdf.Rect, crop: pymupdf.Rect) -> bool:
    return not (rect.x1 < crop.x0 or rect.x0 > crop.x1 or rect.y1 < crop.y0 or rect.y0 > crop.y1)


def export_page(page: pymupdf.Page, floor: int, crop_values: tuple[int, int, int, int]) -> Path:
    crop = pymupdf.Rect(*crop_values)
    groups: dict[tuple[float, str], list[str]] = defaultdict(list)

    for drawing in page.get_drawings():
        stroke = drawing.get("color")
        fill = drawing.get("fill")
        rect = drawing.get("rect", pymupdf.Rect())

        # Architectural geometry is neutral stroked linework. Filled glyphs,
        # evacuation routes, location markers, and fire symbols are omitted.
        if not neutral(stroke) or fill is not None or not intersects(rect, crop):
            continue
        if rect.width >= page.rect.width * 0.95 and rect.height >= page.rect.height * 0.95:
            continue

        commands = path_commands(drawing.get("items", []))
        if not commands:
            continue

        width = max(0.35, min(float(drawing.get("width", 0.7)), 3.5))
        dash = str(drawing.get("dashes") or "").strip()
        groups[(round(width, 2), dash)].append(commands)

    width = crop.width
    height = crop.height
    translate = f"translate({number(-crop.x0)} {number(-crop.y0)})"
    paths: list[str] = []
    for (stroke_width, dash), commands in sorted(groups.items()):
        dash_attr = ""
        if dash and dash not in {"[] 0", "[]0"}:
            dash_attr = f' stroke-dasharray="{html.escape(dash)}"'
        paths.append(
            f'<path d="{"".join(commands)}" stroke-width="{number(stroke_width)}"{dash_attr}/>'
        )

    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {number(width)} {number(height)}" role="img" aria-labelledby="floor-{floor}-title floor-{floor}-desc" data-floor="{floor}" preserveAspectRatio="xMidYMid meet">
  <title id="floor-{floor}-title">TGMCI Floor {floor} architectural shell</title>
  <desc id="floor-{floor}-desc">Clean skeletal floor plan with walls, partitions, doors, stairs, elevators, and room boundaries. Evacuation graphics and labels removed.</desc>
  <g id="floor-{floor}-shell" transform="{translate}" fill="none" stroke="#30363c" stroke-linecap="square" stroke-linejoin="miter" vector-effect="non-scaling-stroke">
    {''.join(paths)}
  </g>
</svg>
'''
    destination = OUTPUT / f"floor-{floor}.svg"
    destination.write_text(svg, encoding="utf-8")
    return destination


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    document = pymupdf.open(SOURCE)
    if len(document) != len(CROPS):
        raise RuntimeError(f"Expected {len(CROPS)} pages, found {len(document)}")

    for index, page in enumerate(document):
        result = export_page(page, index + 1, CROPS[index])
        print(result)


if __name__ == "__main__":
    main()
