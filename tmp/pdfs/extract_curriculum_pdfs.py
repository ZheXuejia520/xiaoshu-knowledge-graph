from __future__ import annotations

import json
from pathlib import Path

import pdfplumber
import pypdfium2 as pdfium


FILES = [
    Path(r"D:\xwechat_files\wxid_zq8yvntm9sx122_a649\msg\file\2026-07\一年级代数知识点导图.pdf"),
    Path(r"D:\xwechat_files\wxid_zq8yvntm9sx122_a649\msg\file\2026-07\二年级知识点总结.pdf"),
    Path(r"D:\xwechat_files\wxid_zq8yvntm9sx122_a649\msg\file\2026-07\三年级数学知识点导图.pdf"),
]

OUTPUT = Path(__file__).resolve().parent / "rendered"
OUTPUT.mkdir(parents=True, exist_ok=True)


def safe_stem(path: Path) -> str:
    return path.stem.replace(" ", "_")


summary = []
for source in FILES:
    stem = safe_stem(source)
    target = OUTPUT / stem
    target.mkdir(exist_ok=True)

    pdf = pdfium.PdfDocument(str(source))
    with pdfplumber.open(source) as plumber:
        pages = []
        for index, page in enumerate(plumber.pages):
            words = page.extract_words(
                x_tolerance=2,
                y_tolerance=2,
                keep_blank_chars=False,
                use_text_flow=False,
            )
            pages.append(
                {
                    "page": index + 1,
                    "width": page.width,
                    "height": page.height,
                    "text": page.extract_text(x_tolerance=2, y_tolerance=2) or "",
                    "words": [
                        {
                            "text": word["text"],
                            "x0": round(word["x0"], 2),
                            "top": round(word["top"], 2),
                            "x1": round(word["x1"], 2),
                            "bottom": round(word["bottom"], 2),
                        }
                        for word in words
                    ],
                }
            )

            bitmap = pdf[index].render(scale=2.0)
            bitmap.to_pil().save(target / f"page-{index + 1:02d}.png")

        (target / "content.json").write_text(
            json.dumps(pages, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        summary.append(
            {
                "file": str(source),
                "pages": len(pages),
                "output": str(target),
                "page_sizes": [
                    [round(page["width"], 1), round(page["height"], 1)] for page in pages
                ],
            }
        )

print(json.dumps(summary, ensure_ascii=False, indent=2))
