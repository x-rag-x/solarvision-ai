from __future__ import annotations

from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import sys
import time
import xml.etree.ElementTree as ET

EXPECTED_CLASSES = [
    "crack",
    "finger",
    "black_core",
    "thick_line",
    "star_crack",
    "horizontal_dislocation",
    "vertical_dislocation",
    "printing_error",
    "short_circuit",
]


def parse_xml_file(fpath: Path) -> dict:
    try:
        tree = ET.parse(fpath)
        root = tree.getroot()
        filename_elem = root.find("filename")
        filename = filename_elem.text if filename_elem is not None else fpath.stem + ".jpg"

        path_elem = root.find("path")
        orig_path = path_elem.text if path_elem is not None else ""

        size_elem = root.find("size")
        if size_elem is not None:
            w = int(size_elem.find("width").text)
            h = int(size_elem.find("height").text)
            d = int(size_elem.find("depth").text) if size_elem.find("depth") is not None else 1
        else:
            w, h, d = 0, 0, 0

        objs = []
        for obj in root.findall("object"):
            name = obj.find("name").text
            bnd = obj.find("bndbox")
            xmin = float(bnd.find("xmin").text)
            ymin = float(bnd.find("ymin").text)
            xmax = float(bnd.find("xmax").text)
            ymax = float(bnd.find("ymax").text)
            objs.append((name, (xmin, ymin, xmax, ymax)))

        return {
            "status": "ok",
            "file": fpath.name,
            "filename": filename,
            "orig_path": orig_path,
            "size": (w, h, d),
            "objects": objs,
        }
    except Exception as exc:
        return {"status": "error", "file": fpath.name, "error": str(exc)}


def main() -> None:
    target_dir = Path("downloads/test_annotation/test")
    if not target_dir.exists():
        print(f"Directory {target_dir} does not exist.")
        sys.exit(1)

    print("Locating XML files...")
    xml_files = list(target_dir.glob("*.xml"))
    total = len(xml_files)
    print(f"Found {total} XML files. Parsing with worker threads...")

    t0 = time.time()
    classes = Counter()
    dimensions = Counter()
    obj_counts = Counter()
    sample_paths = []
    error_count = 0

    with ThreadPoolExecutor(max_workers=8) as ex:
        results = list(ex.map(parse_xml_file, xml_files))

    for r in results:
        if r["status"] == "error":
            error_count += 1
            continue

        dimensions[r["size"]] += 1
        obj_counts[len(r["objects"])] += 1
        if len(sample_paths) < 5 and r["orig_path"]:
            sample_paths.append(r["orig_path"])

        for name, bbox in r["objects"]:
            classes[name] += 1

    elapsed = time.time() - t0
    print(f"\n--- Parsed {total} files in {elapsed:.2f}s (Errors: {error_count}) ---")

    print("\n1. Image Dimensions (Width, Height, Depth):")
    for dim, cnt in dimensions.most_common():
        print(f"   {dim}: {cnt} images")

    print(f"\n2. Defect Object Frequency across {total} annotated images:")
    total_objects = sum(classes.values())
    print(f"   Total annotated defect bounding boxes: {total_objects}")
    print(f"   Images with 0 annotations (defect-free): {obj_counts[0]}")
    for n_boxes, cnt in sorted(obj_counts.items())[:10]:
        if n_boxes > 0:
            print(f"   Images with {n_boxes} defect(s): {cnt}")

    print("\n3. Class Distribution:")
    for cname, cnt in classes.most_common():
        in_model = "MATCH" if cname in EXPECTED_CLASSES else "EXTRA / UNMATCHED"
        print(f"   [{in_model:18s}] {cname:25s}: {cnt:6d} instances")

    print("\n4. Sample Origin Paths from XML headers:")
    for sp in sample_paths:
        safe_sp = sp.encode("ascii", errors="replace").decode("ascii")
        print(f"   {safe_sp}")

    # Check match with Model 1
    unmatched_dataset = [c for c in classes if c not in EXPECTED_CLASSES]
    missing_in_dataset = [c for c in EXPECTED_CLASSES if c not in classes]
    print("\n5. Class Compatibility Summary:")
    print(f"   Checkpoint classes count: {len(EXPECTED_CLASSES)}")
    print(f"   Dataset classes count:    {len(classes)}")
    print(f"   Unmatched in dataset:     {unmatched_dataset}")
    print(f"   Missing from dataset:     {missing_in_dataset}")


if __name__ == "__main__":
    main()
