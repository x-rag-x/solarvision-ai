from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import sys
import xml.etree.ElementTree as ET

VOC_TO_YOLO_CLASSES: dict[str, int] = {
    "crack": 0,
    "finger": 1,
    "black_core": 2,
    "thick_line": 3,
    "star_crack": 4,
    "horizontal_dislocation": 5,
    "vertical_dislocation": 6,
    "printing_error": 7,
    "short_circuit": 8,
}


def convert_single_voc(xml_path: Path, output_dir: Path) -> dict:
    try:
        tree = ET.parse(xml_path)
        root = tree.getroot()

        size_elem = root.find("size")
        if size_elem is None:
            return {"status": "error", "file": xml_path.name, "msg": "Missing <size> tag"}

        width = float(size_elem.find("width").text)
        height = float(size_elem.find("height").text)
        if width <= 0 or height <= 0:
            return {"status": "error", "file": xml_path.name, "msg": f"Invalid dimension {width}x{height}"}

        yolo_lines: list[str] = []
        skipped_classes: list[str] = []

        for obj in root.findall("object"):
            name = obj.find("name").text
            if name not in VOC_TO_YOLO_CLASSES:
                skipped_classes.append(name)
                continue

            class_id = VOC_TO_YOLO_CLASSES[name]
            bnd = obj.find("bndbox")
            xmin = float(bnd.find("xmin").text)
            ymin = float(bnd.find("ymin").text)
            xmax = float(bnd.find("xmax").text)
            ymax = float(bnd.find("ymax").text)

            # Clamp coordinates to image dimensions
            xmin = max(0.0, min(xmin, width))
            ymin = max(0.0, min(ymin, height))
            xmax = max(xmin, min(xmax, width))
            ymax = max(ymin, min(ymax, height))

            box_w = xmax - xmin
            box_h = ymax - ymin
            if box_w <= 0 or box_h <= 0:
                continue

            x_center = (xmin + xmax) / 2.0 / width
            y_center = (ymin + ymax) / 2.0 / height
            norm_w = box_w / width
            norm_h = box_h / height

            yolo_lines.append(f"{class_id} {x_center:.6f} {y_center:.6f} {norm_w:.6f} {norm_h:.6f}")

        out_txt = output_dir / f"{xml_path.stem}.txt"
        out_txt.write_text("\n".join(yolo_lines) + ("\n" if yolo_lines else ""), encoding="utf-8")

        return {
            "status": "ok",
            "file": xml_path.name,
            "objects_converted": len(yolo_lines),
            "skipped_classes": skipped_classes,
        }
    except Exception as exc:
        return {"status": "error", "file": xml_path.name, "msg": str(exc)}


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert Pascal VOC XML annotations to YOLO TXT format")
    parser.add_argument("--voc-dir", default="downloads/test_annotation/test", help="Source VOC XML directory")
    parser.add_argument("--output-dir", default="data/dataset/labels/test", help="Target YOLO labels directory")
    parser.add_argument("--limit", type=int, default=None, help="Optional limit on converted files")
    args = parser.parse_args()

    voc_dir = Path(args.voc_dir)
    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    if not voc_dir.exists():
        print(f"Error: VOC directory {voc_dir} does not exist.")
        sys.exit(1)

    xml_files = sorted(list(voc_dir.glob("*.xml")))
    if args.limit:
        xml_files = xml_files[: args.limit]

    total = len(xml_files)
    print(f"Converting {total} Pascal VOC XML files to YOLO format in {out_dir}...")

    with ThreadPoolExecutor(max_workers=8) as ex:
        results = list(ex.map(lambda f: convert_single_voc(f, out_dir), xml_files))

    ok_count = sum(1 for r in results if r["status"] == "ok")
    err_count = sum(1 for r in results if r["status"] == "error")
    total_objs = sum(r.get("objects_converted", 0) for r in results)

    print(f"\nConversion complete: {ok_count} files converted successfully ({err_count} errors).")
    print(f"Total YOLO bounding boxes written: {total_objs}")


if __name__ == "__main__":
    main()
