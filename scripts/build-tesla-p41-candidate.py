"""Re-crop TESLA P41 from its exact PDF; preserve all question content and IDs.

Uses the installed importer's PDFium crop and strict packaging routines unchanged.
Run with that importer's Python environment and an explicit new output directory.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import io
import json
import struct
import sys
import zipfile
from pathlib import Path

BOXES = {
    "crop-q41-opt-a": [50, 130, 290, 310],
    "crop-q41-opt-b": [330, 130, 570, 310],
    "crop-q41-opt-c": [50, 310, 290, 500],
    "crop-q41-opt-d": [330, 310, 570, 500],
}
ORIGINAL_SHA = "2eedea311058d63e9a8b1eb9d67f638bd541f3634c97a521088bdaad767275d7"


def sha(content):
    return hashlib.sha256(content).hexdigest()


def dimensions(content):
    if content[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("Not a PNG")
    return list(struct.unpack(">II", content[16:24]))


def contains(box, region, margin=0):
    return box[0] >= region[0]+margin and box[1] >= region[1]+margin and box[2] <= region[2]-margin and box[3] <= region[3]-margin


def verify_pdf_crops(pdfium, pdf_assets, pdf_path, root, data):
    """Independent read-only check of delivered bytes and native PDF labels/axes."""
    results = []
    with pdfium.PdfDocument(str(pdf_path)) as pdf:
        page = pdf[17]
        try:
            width, height = page.get_size()
            text = page.get_textpage()
            try:
                labels = []
                for i in range(text.count_chars()):
                    value = text.get_text_range(i, 1)
                    if value.strip():
                        x0, y0, x1, y1 = text.get_charbox(i)
                        labels.append({"text": value, "bbox": [x0, height-y1, x1, height-y0]})
            finally:
                text.close()
            paths = [pdf_assets.visible_bounds(obj.get_bounds(), page.get_rotation(), width, height)
                     for obj in page.get_objects(max_depth=8) if obj.type == pdfium.raw.FPDF_PAGEOBJ_PATH]
            for asset in data["assets"]:
                if asset["id"] not in BOXES:
                    continue
                x0, y0, x1, y1 = box = BOXES[asset["id"]]
                bitmap = page.render(scale=2, crop=(x0, height-y1, width-x1, y0))
                try:
                    rendered = io.BytesIO()
                    bitmap.to_pil().save(rendered, format="PNG")
                finally:
                    bitmap.close()
                delivered = (root / asset["path"]).read_bytes()
                if delivered != rendered.getvalue() or sha(delivered) != asset["sha256"]:
                    raise ValueError("PNG differs from direct PDF render: " + asset["id"])
                visible = [label for label in labels if contains(label["bbox"], box)]
                if not {"2", "X", "Y"}.issubset(label["text"] for label in visible):
                    raise ValueError("Missing PDF labels in crop: " + asset["id"])
                if not all(contains(label["bbox"], box, margin=10) for label in visible):
                    raise ValueError("Insufficient text margin: " + asset["id"])
                axes = [b for b in paths if contains(b, box) and b[2]-b[0] < 2 and 150 < b[3]-b[1] < 155]
                if len(axes) != 1 or not contains(axes[0], box, margin=10):
                    raise ValueError("Incomplete vertical axis or insufficient margin: " + asset["id"])
                results.append({"id": asset["id"], "exact_direct_pdf_render": True,
                                "labels_margin_points": 10, "vertical_axis_bbox": axes[0],
                                "vertical_axis_margin_points": 10, "dimensions": dimensions(delivered)})
        finally:
            page.close()
    if len(results) != 4:
        raise ValueError("Not all four PDF crops were verified")
    return results


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--original", required=True, type=Path)
    parser.add_argument("--pdf", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--importer-root", required=True, type=Path)
    parser.add_argument("--verify-only", action="store_true", help="Check an existing candidate without changing files")
    args = parser.parse_args()
    sys.path.insert(0, str(args.importer_root.resolve() / "shared/scripts"))
    import lab
    import package_io
    import pdf_assets
    import pypdfium2 as pdfium

    raw_original = args.original.read_bytes()
    if sha(raw_original) != ORIGINAL_SHA:
        raise ValueError("Original TESLA package differs from the reviewed source")
    with zipfile.ZipFile(args.original) as original:
        data = json.loads(original.read("final.json"))
        manifest = json.loads(original.read("manifest.json"))
        for entry in manifest["files"]:
            content = original.read(entry["path"])
            if sha(content) != entry["sha256"] or len(content) != entry["bytes"]:
                raise ValueError("Original manifest mismatch: " + entry["path"])
        source = next(s for s in data["sources"] if s["id"] == "tesla-m1")
        if sha(args.pdf.read_bytes()) != source["sha256"]:
            raise ValueError("PDF does not match the source hash in final.json")
        if len(data["questions"]) != 65 or len(data["assets"]) != 18:
            raise ValueError("Unexpected TESLA inventory")
        root = lab.configure_workspace(args.output)
        if args.verify_only:
            existing = lab.read(root / "final.json")
            result = package_io.inspect_package(root / "package.paessed")
            if (root / "package.zip").read_bytes() != (root / "package.paessed").read_bytes():
                raise ValueError("ZIP/.paessed bytes differ")
            with zipfile.ZipFile(root / "package.paessed") as archive:
                if json.loads(archive.read("final.json")) != existing:
                    raise ValueError("Loose and packaged JSON differ")
                for asset in existing["assets"]:
                    if archive.read(asset["path"]) != (root / asset["path"]).read_bytes():
                        raise ValueError("Loose and packaged PNG differ")
            crops = verify_pdf_crops(pdfium, pdf_assets, args.pdf, root, existing)
            print(json.dumps({"package": result, "pdf_crops": crops}, indent=2))
            return
        if root.exists():
            raise ValueError("Candidate directory already exists; use a new version")
        candidate = copy.deepcopy(data)
        root.mkdir(parents=True)
        changes = []
        unchanged = []
        with pdfium.PdfDocument(str(args.pdf)) as pdf:
            if len(pdf) != source["page_count"]:
                raise ValueError("PDF page count mismatch")
            page = pdf[17]
            try:
                width, height = page.get_size()
                pdf_assets.render_crop(page, root / "audit/source-page18.png", scale=1.5)
                text = page.get_textpage()
                try:
                    labels = []
                    for i in range(text.count_chars()):
                        char = text.get_text_range(i, 1)
                        if not char.strip():
                            continue
                        x0, y0, x1, y1 = text.get_charbox(i)
                        labels.append({"text": char, "bbox": [x0, height-y1, x1, height-y0]})
                finally:
                    text.close()
                for asset in candidate["assets"]:
                    before = original.read(asset["path"])
                    if sha(before) != asset["sha256"]:
                        raise ValueError("Original resource hash mismatch: " + asset["id"])
                    target = lab.artifact_path(root, asset["path"], "assets")
                    if asset["id"] not in BOXES:
                        target.parent.mkdir(parents=True, exist_ok=True)
                        target.write_bytes(before)
                        unchanged.append({"id": asset["id"], "sha256": sha(before)})
                        continue
                    if asset["source_id"] != source["id"] or asset["page"] != 18:
                        raise ValueError("Unexpected P41 source/page")
                    old_box = asset["bbox"][:]
                    box = BOXES[asset["id"]]
                    pdf_assets.render_crop(page, target, box, scale=2)
                    after = target.read_bytes()
                    asset["bbox"] = box[:]
                    asset["sha256"] = sha(after)
                    before_path = lab.inside(root / "audit/before" / target.name)
                    before_path.parent.mkdir(parents=True, exist_ok=True)
                    before_path.write_bytes(before)
                    visible_labels = [label for label in labels if contains(label["bbox"], box)]
                    changes.append({
                        "id": asset["id"], "path": asset["path"], "page": 18,
                        "old_bbox": old_box, "new_bbox": box[:],
                        "old_sha256": sha(before), "new_sha256": sha(after),
                        "old_dimensions": dimensions(before), "new_dimensions": dimensions(after),
                        "new_bytes": len(after), "scale": 2, "dpi": 144,
                        "labels_in_pdf": visible_labels,
                        "labels_not_fully_inside_old_crop": [label for label in visible_labels if not contains(label["bbox"], old_box)],
                    })
            finally:
                page.close()
        if set(change["id"] for change in changes) != set(BOXES):
            raise ValueError("Missing P41 resource")
        expected = copy.deepcopy(data)
        for asset in expected["assets"]:
            if asset["id"] in BOXES:
                changed = next(c for c in changes if c["id"] == asset["id"])
                asset.update(bbox=changed["new_bbox"], sha256=changed["new_sha256"])
        if candidate != expected:
            raise ValueError("Unrelated JSON changes")
        verified_crops = verify_pdf_crops(pdfium, pdf_assets, args.pdf, root, candidate)
        # Original audit remains outside the strict package, byte for byte.
        for name in original.namelist():
            if name.startswith("audit/") and not name.endswith("/"):
                destination = lab.artifact_path(root, name)
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_bytes(original.read(name))
        lab.write(root / "final.json", candidate)
        packed = package_io.pack(root / "final.json")
        with zipfile.ZipFile(root / "package.zip") as archive:
            if json.loads(archive.read("final.json")) != candidate:
                raise ValueError("Packager altered candidate data")
            for asset in candidate["assets"]:
                if archive.read(asset["path"]) != (root / asset["path"]).read_bytes():
                    raise ValueError("Packager altered resource bytes")
        if args.original.read_bytes() != raw_original:
            raise ValueError("Original package changed")
        lab.write(root / "audit/candidate-audit.json", {
            "version": root.name, "status": "candidate-not-promoted",
            "original_package_sha256": ORIGINAL_SHA,
            "pdf_source": source, "pdf_page_size": [width, height],
            "coordinate_system": "top_left_pdf_points", "renderer": "PDFium",
            "changes": changes, "unchanged_resources": unchanged,
            "pdf_crops_verified": verified_crops,
            "json_changes": "Only bbox and sha256 of the four P41 assets",
            "packages": packed,
        })
        print(json.dumps(packed, indent=2))


if __name__ == "__main__":
    main()
