"""
Paper Image Generator — PIL Template-based
Generates Avatar (512×512) and Cover (1200×675) for each paper.

Design system:
- Each domain has a unique color palette (bg + accent + text)
- Avatar: domain icon glyph + short title + year pill
- Cover: gradient bg + geometric pattern + full title + authors + domain tag

Usage:
    python3 generate_images.py
    python3 generate_images.py --in Geo_papers_schema_v2.xlsx --out paper_images_202
    python3 generate_images.py --limit 10 --workbook-out Geo_papers_schema_v2_with_images.xlsx

Requirements:
    pip install Pillow pandas openpyxl
"""

import argparse
import pandas as pd
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os
import math
import textwrap
import re

# ── Fonts ────────────────────────────────────────────────────────────────────
# Try project-preferred fonts first, then common macOS/Linux fallbacks.
FONT_BOLD = (
    "/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/Library/Fonts/Arial Unicode.ttf",
    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
)
FONT_MED = (
    "/usr/share/fonts/truetype/google-fonts/Poppins-Medium.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/Library/Fonts/Arial Unicode.ttf",
    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
)
FONT_REG = (
    "/usr/share/fonts/truetype/google-fonts/Poppins-Regular.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/Library/Fonts/Arial Unicode.ttf",
    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
)
FONT_LIGHT = (
    "/usr/share/fonts/truetype/google-fonts/Poppins-Light.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/Library/Fonts/Arial Unicode.ttf",
    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
)


def font(paths, size):
    for path in paths if isinstance(paths, (list, tuple)) else [paths]:
        try:
            if path and os.path.exists(path):
                return ImageFont.truetype(path, size)
        except Exception:
            pass
    return ImageFont.load_default()

# ── Domain Design System ─────────────────────────────────────────────────────
DOMAINS = {
    "Deep Learning": {
        "bg":      (15,  23,  42),   # slate-950
        "accent":  (99, 102, 241),   # indigo-500
        "accent2": (139, 92, 246),   # violet-500
        "text":    (224, 231, 255),  # indigo-100
        "tag_bg":  (49,  46,  129),  # indigo-900
        "glyph":   "⬡",             # hexagon = neural net layers
        "abbr":    "DL",
    },
    "Machine Learning": {
        "bg":      (20,  20,  30),
        "accent":  (251, 191,  36),  # amber-400
        "accent2": (245, 158,  11),  # amber-500
        "text":    (254, 243, 199),  # amber-100
        "tag_bg":  (120,  53,  15),  # amber-900
        "glyph":   "◈",
        "abbr":    "ML",
    },
    "Computer Vision": {
        "bg":      (2,   44,  34),   # emerald-950
        "accent":  (52, 211, 153),   # emerald-400
        "accent2": (16, 185, 129),   # emerald-500
        "text":    (209, 250, 229),  # emerald-100
        "tag_bg":  (6,   78,  59),   # emerald-900
        "glyph":   "◎",
        "abbr":    "CV",
    },
    "NLP": {
        "bg":      (30,   7,  50),   # purple-950
        "accent":  (216,  180, 254), # violet-300
        "accent2": (167,  139, 250), # violet-400
        "text":    (237, 233, 254),  # violet-100
        "tag_bg":  (76,  29, 149),   # violet-900
        "glyph":   "✻",
        "abbr":    "NLP",
    },
    "Reinforcement Learning": {
        "bg":      (39,   8,   8),   # red-950
        "accent":  (252,  165, 165), # red-300
        "accent2": (239,  68,  68),  # red-500
        "text":    (254, 226, 226),  # red-100
        "tag_bg":  (127,  29,  29),  # red-900
        "glyph":   "▶",
        "abbr":    "RL",
    },
    "Foundations": {
        "bg":      (15,  23,  42),
        "accent":  (148, 163, 184),  # slate-400
        "accent2": (100, 116, 139),  # slate-500
        "text":    (226, 232, 240),  # slate-200
        "tag_bg":  (30,  41,  59),   # slate-800
        "glyph":   "∞",
        "abbr":    "FND",
    },
    "Symbolic AI": {
        "bg":      (28,  25,   8),
        "accent":  (253, 224, 132),  # yellow-300
        "accent2": (234, 179,   8),  # yellow-500
        "text":    (254, 252, 232),  # yellow-50
        "tag_bg":  (113,  63,  18),  # yellow-900
        "glyph":   "Ω",
        "abbr":    "SYM",
    },
    "Alignment & Safety": {
        "bg":      (28,   7,   7),
        "accent":  (252, 165, 165),  # red-300
        "accent2": (248, 113, 113),  # red-400
        "text":    (254, 226, 226),
        "tag_bg":  (127,  29,  29),
        "glyph":   "⚑",
        "abbr":    "SAFE",
    },
    "AI for Science": {
        "bg":      (2,   35,  46),
        "accent":  (103, 232, 249),  # cyan-300
        "accent2": (6,  182, 212),   # cyan-500
        "text":    (207, 250, 254),  # cyan-100
        "tag_bg":  (8,  145, 178),
        "glyph":   "✦",
        "abbr":    "SCI",
    },
    "Classical ML": {
        "bg":      (17,  24,  39),
        "accent":  (129, 140, 248),  # indigo-400
        "accent2": (99,  102, 241),
        "text":    (224, 231, 255),
        "tag_bg":  (49,  46, 129),
        "glyph":   "◈",
        "abbr":    "ML",
    },
    "Systems & Infrastructure": {
        "bg":      (10,  10,  10),
        "accent":  (163, 163, 163),  # neutral-400
        "accent2": (115, 115, 115),
        "text":    (245, 245, 245),
        "tag_bg":  (38,  38,  38),
        "glyph":   "⬡",
        "abbr":    "SYS",
    },
    # Aliases used in the dataset
    "Classical/Probabilistic ML": {
        "bg":      (17,  24,  39),
        "accent":  (129, 140, 248),
        "accent2": (99,  102, 241),
        "text":    (224, 231, 255),
        "tag_bg":  (49,  46, 129),
        "glyph":   "◈",
        "abbr":    "ML",
    },
    "Neural Networks": {
        "bg":      (15,  23,  42),
        "accent":  (99, 102, 241),
        "accent2": (139, 92, 246),
        "text":    (224, 231, 255),
        "tag_bg":  (49,  46, 129),
        "glyph":   "⬡",
        "abbr":    "NN",
    },
    "RL": {
        "bg":      (39,   8,   8),
        "accent":  (252,  165, 165),
        "accent2": (239,  68,  68),
        "text":    (254, 226, 226),
        "tag_bg":  (127,  29,  29),
        "glyph":   "▶",
        "abbr":    "RL",
    },
}

DEFAULT_DOMAIN = DOMAINS["Deep Learning"]

def get_domain_style(domain):
    return DOMAINS.get(str(domain).strip(), DEFAULT_DOMAIN)


# ── Helper: draw rounded rectangle ──────────────────────────────────────────
def rounded_rect(draw, xy, radius, fill=None, outline=None, width=1):
    x0, y0, x1, y1 = xy
    draw.rounded_rectangle([x0, y0, x1, y1], radius=radius, fill=fill, outline=outline, width=width)


# ── Helper: wrap text returning lines ───────────────────────────────────────
def wrap_text(text, font_obj, max_width, draw):
    words = text.split()
    lines = []
    current = []
    for word in words:
        test = " ".join(current + [word])
        bbox = draw.textbbox((0, 0), test, font=font_obj)
        if bbox[2] > max_width and current:
            lines.append(" ".join(current))
            current = [word]
        else:
            current.append(word)
    if current:
        lines.append(" ".join(current))
    return lines


# ── Helper: draw geometric background pattern ────────────────────────────────
def draw_pattern(draw, w, h, style, pattern_type="dots"):
    accent = style["accent"]

    if pattern_type == "dots":
        spacing = 28
        for x in range(0, w + spacing, spacing):
            for y in range(0, h + spacing, spacing):
                draw.ellipse([x-2, y-2, x+2, y+2], fill=(*accent, 25))

    elif pattern_type == "grid":
        spacing = 40
        for x in range(0, w + spacing, spacing):
            draw.line([(x, 0), (x, h)], fill=(*accent, 12), width=1)
        for y in range(0, h + spacing, spacing):
            draw.line([(0, y), (w, y)], fill=(*accent, 12), width=1)

    elif pattern_type == "hex":
        r = 22
        col_w = r * 2
        row_h = int(r * 1.73)
        for row in range(-1, h // row_h + 2):
            for col in range(-1, w // col_w + 2):
                cx = col * col_w + (r if row % 2 else 0)
                cy = row * row_h
                pts = []
                for i in range(6):
                    angle = math.radians(60 * i - 30)
                    pts.append((cx + r * math.cos(angle), cy + r * math.sin(angle)))
                draw.polygon(pts, outline=(*accent, 20))

    elif pattern_type == "diagonal":
        spacing = 32
        for i in range(-h, w + h, spacing):
            draw.line([(i, 0), (i + h, h)], fill=(*accent, 15), width=1)


PATTERN_MAP = {
    "Deep Learning":            "hex",
    "Machine Learning":         "dots",
    "Computer Vision":          "grid",
    "NLP":                      "diagonal",
    "Reinforcement Learning":   "diagonal",
    "Foundations":              "dots",
    "Symbolic AI":              "dots",
    "Alignment & Safety":       "grid",
    "AI for Science":           "hex",
    "Classical ML":             "dots",
    "Classical/Probabilistic ML": "dots",
    "Systems & Infrastructure": "grid",
    "Neural Networks":          "hex",
    "RL":                       "diagonal",
}


# ── Helper: gradient fill ────────────────────────────────────────────────────
def vertical_gradient(img, top_color, bottom_color):
    w, h = img.size
    draw = ImageDraw.Draw(img)
    for y in range(h):
        t = y / h
        r = int(top_color[0] + (bottom_color[0] - top_color[0]) * t)
        g = int(top_color[1] + (bottom_color[1] - top_color[1]) * t)
        b = int(top_color[2] + (bottom_color[2] - top_color[2]) * t)
        draw.line([(0, y), (w, y)], fill=(r, g, b))


# ── Clean title for display ──────────────────────────────────────────────────
def clean_title(name):
    # Remove parenthetical model names at end like "(BERT)" or "(StyleGAN)"
    name = re.sub(r'\s*\([A-Z][A-Za-z0-9\-]+\)\s*$', '', name)
    # Remove trailing common suffixes
    name = re.sub(r':\s*(A|An|The)\s+', ': ', name)
    return name.strip()


def abbrev_authors(authors_str, max_authors=2):
    if not authors_str or str(authors_str) == 'nan':
        return ""
    authors = [a.strip() for a in str(authors_str).split(";")]
    def last_name(full):
        parts = full.strip().split()
        return parts[-1] if parts else full
    shown = [last_name(a) for a in authors[:max_authors]]
    if len(authors) > max_authors:
        shown.append("et al.")
    return ", ".join(shown)


# ══════════════════════════════════════════════════════════════════════════════
#  AVATAR  512 × 512
# ══════════════════════════════════════════════════════════════════════════════
def make_avatar(paper):
    W, H = 512, 512
    name    = clean_title(str(paper.get("Name", "")))
    year    = str(paper.get("Year", ""))[:4]
    domain  = str(paper.get("Domain", "Deep Learning"))
    style   = get_domain_style(domain)

    img = Image.new("RGB", (W, H), style["bg"])

    # Gradient overlay (top lighter)
    bg2 = tuple(min(255, c + 20) for c in style["bg"])
    vertical_gradient(img, bg2, style["bg"])

    draw = ImageDraw.Draw(img, "RGBA")

    # Background pattern
    pat = PATTERN_MAP.get(domain, "dots")
    draw_pattern(draw, W, H, style, pat)

    # ── Accent circle (top-left glow) ──
    draw.ellipse([-60, -60, 220, 220], fill=(*style["accent"], 18))
    draw.ellipse([-30, -30, 160, 160], fill=(*style["accent"], 12))

    # ── Bottom-right accent dot ──
    draw.ellipse([340, 340, 560, 560], fill=(*style["accent2"], 14))

    # ── Domain abbreviation badge (top-right) ──
    abbr = style["abbr"]
    f_abbr = font(FONT_BOLD, 20)
    abbr_w = draw.textlength(abbr, font=f_abbr)
    pad = 10
    rx0 = W - abbr_w - pad*2 - 16
    ry0 = 20
    rx1 = W - 16
    ry1 = 52
    rounded_rect(draw, [rx0, ry0, rx1, ry1], 8, fill=(*style["accent"], 210))
    draw.text((rx0 + pad, ry0 + 6), abbr, font=f_abbr, fill=style["bg"])

    # ── Big glyph / icon (center-ish, top area) ──
    glyph = style["glyph"]
    f_glyph = font(FONT_BOLD, 96)
    gx = W // 2
    gy = 155
    # Glow under glyph
    draw.ellipse([gx - 70, gy - 50, gx + 70, gy + 80],
                 fill=(*style["accent"], 30))
    draw.text((gx, gy), glyph, font=f_glyph,
              fill=(*style["accent"], 220), anchor="mm")

    # ── Divider line ──
    line_y = 260
    draw.line([(52, line_y), (W - 52, line_y)],
              fill=(*style["accent"], 60), width=1)

    # ── Title text (wrapped, center) ──
    f_title    = font(FONT_BOLD, 26)
    f_title_sm = font(FONT_BOLD, 22)
    f_title_xs = font(FONT_MED,  18)

    max_w = W - 72
    lines = wrap_text(name, f_title, max_w, draw)

    # Auto-size if too many lines
    if len(lines) > 3:
        lines = wrap_text(name, f_title_sm, max_w, draw)
        f_use = f_title_sm
    else:
        f_use = f_title
    if len(lines) > 4:
        lines = wrap_text(name, f_title_xs, max_w, draw)
        f_use = f_title_xs

    # Truncate to 4 lines max
    if len(lines) > 4:
        lines = lines[:4]
        lines[-1] = lines[-1].rstrip() + "…"

    line_h = 34 if f_use == f_title else (29 if f_use == f_title_sm else 25)
    ty = 285

    for i, line in enumerate(lines):
        lw = draw.textlength(line, font=f_use)
        tx = (W - lw) / 2
        draw.text((tx, ty + i * line_h), line, font=f_use,
                  fill=style["text"])

    # ── Year pill (bottom center) ──
    f_year = font(FONT_BOLD, 22)
    year_w = draw.textlength(year, font=f_year)
    pill_w = year_w + 28
    pill_x = (W - pill_w) / 2
    pill_y = H - 58
    rounded_rect(draw, [pill_x, pill_y, pill_x + pill_w, pill_y + 34],
                 17, fill=(*style["accent2"], 180))
    draw.text((W // 2, pill_y + 17), year, font=f_year,
              fill=style["bg"], anchor="mm")

    # ── Bottom border accent ──
    draw.line([(0, H-1), (W, H-1)], fill=style["accent"], width=3)

    return img


# ══════════════════════════════════════════════════════════════════════════════
#  COVER  1200 × 675
# ══════════════════════════════════════════════════════════════════════════════
def make_cover(paper):
    W, H = 1200, 675
    name    = clean_title(str(paper.get("Name", "")))
    year    = str(paper.get("Year", ""))[:4]
    domain  = str(paper.get("Domain", "Deep Learning"))
    authors = abbrev_authors(paper.get("Authors", ""))
    venue   = str(paper.get("Venue", ""))
    style   = get_domain_style(domain)

    img = Image.new("RGB", (W, H), style["bg"])

    # Gradient: left darker → right slightly lighter
    draw_base = ImageDraw.Draw(img, "RGBA")
    for x in range(W):
        t = x / W
        factor = 1.0 + t * 0.18
        r = min(255, int(style["bg"][0] * factor))
        g = min(255, int(style["bg"][1] * factor))
        b = min(255, int(style["bg"][2] * factor))
        draw_base.line([(x, 0), (x, H)], fill=(r, g, b))

    draw = ImageDraw.Draw(img, "RGBA")

    # ── Background pattern ──
    pat = PATTERN_MAP.get(domain, "dots")
    draw_pattern(draw, W, H, style, pat)

    # ── Large glow circle (right side) ──
    draw.ellipse([700, -150, 1400, 550], fill=(*style["accent"], 22))
    draw.ellipse([820, -50,  1250, 450], fill=(*style["accent2"], 16))

    # ── Left accent bar ──
    draw.rectangle([0, 0, 6, H], fill=style["accent"])

    # ── Top-left: domain tag ──
    f_tag = font(FONT_BOLD, 22)
    tag_text = domain.upper()
    tag_w = draw.textlength(tag_text, font=f_tag)
    pad = 14
    rounded_rect(draw,
                 [44, 44, 44 + tag_w + pad*2, 44 + 40],
                 8, fill=(*style["accent"], 200))
    draw.text((44 + pad, 64), tag_text, font=f_tag,
              fill=style["bg"], anchor="lm")

    # ── Year badge (top-right) ──
    f_year = font(FONT_BOLD, 28)
    draw.text((W - 52, 64), year, font=f_year,
              fill=style["accent"], anchor="rm")

    # ── Main title ──
    f_h1 = font(FONT_BOLD, 64)
    f_h2 = font(FONT_BOLD, 52)
    f_h3 = font(FONT_BOLD, 42)
    f_h4 = font(FONT_BOLD, 34)

    max_title_w = 840

    f_title = f_h4
    lines = []
    for f_try in [f_h1, f_h2, f_h3, f_h4]:
        lines = wrap_text(name, f_try, max_title_w, draw)
        if len(lines) <= 4:
            f_title = f_try
            break

    if len(lines) > 4:
        lines = lines[:4]
        lines[-1] = lines[-1].rstrip() + "…"

    size_map = {f_h1: 80, f_h2: 66, f_h3: 54, f_h4: 44}
    line_h = size_map.get(f_title, 54)

    total_h = len(lines) * line_h
    ty = max(140, (H - total_h) // 2 - 30)

    for i, line in enumerate(lines):
        draw.text((56, ty + i * line_h), line, font=f_title,
                  fill=style["text"])

    # ── Divider ──
    div_y = ty + total_h + 28
    draw.line([(56, div_y), (500, div_y)],
              fill=(*style["accent"], 120), width=2)

    # ── Authors ──
    if authors:
        f_auth = font(FONT_MED, 26)
        draw.text((56, div_y + 20), authors, font=f_auth,
                  fill=(*style["text"][:3], 180))

    # ── Venue (truncated) ──
    if venue and str(venue) != 'nan':
        f_venue = font(FONT_LIGHT, 20)
        venue_short = venue[:70] + ("…" if len(venue) > 70 else "")
        draw.text((56, div_y + 58), venue_short, font=f_venue,
                  fill=(*style["accent"][:3], 140))

    # ── Big decorative glyph (right side, very transparent) ──
    f_big_glyph = font(FONT_BOLD, 240)
    glyph = style["glyph"]
    draw.text((W - 130, H // 2 + 20), glyph, font=f_big_glyph,
              fill=(*style["accent"], 28), anchor="mm")

    # ── Bottom accent bar ──
    draw.rectangle([0, H-5, W, H], fill=style["accent"])

    # ── Bottom-right: citation count if >= 10k ──
    cit = paper.get("Citation count", 0)
    try:
        cit_val = float(str(cit).replace(',', '') or 0)
        if cit_val >= 10000:
            cit_int = int(cit_val)
            cit_str = f"{cit_int:,} citations"
            f_cit = font(FONT_LIGHT, 18)
            draw.text((W - 52, H - 22), cit_str, font=f_cit,
                      fill=(*style["accent"][:3], 100), anchor="rm")
    except:
        pass

    return img


# ══════════════════════════════════════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════════════════════════════════════
def slugify(name):
    s = str(name).lower()
    s = re.sub(r'[^a-z0-9]+', '-', s)
    s = s.strip('-')
    return s[:60]


def generate_all(xlsx_path, out_dir, workbook_out=None, sheet_name="Papers", limit=0):
    xlsx_path = os.path.abspath(xlsx_path)
    out_dir = os.path.abspath(out_dir)
    df = pd.read_excel(xlsx_path, sheet_name=sheet_name)
    if limit and limit > 0:
        df = df.head(limit).copy()
    total = len(df)
    avatar_dir = os.path.join(out_dir, "avatars")
    cover_dir  = os.path.join(out_dir, "covers")
    os.makedirs(avatar_dir, exist_ok=True)
    os.makedirs(cover_dir,  exist_ok=True)

    avatar_paths = []
    cover_paths  = []

    for i, row in df.iterrows():
        paper = row.to_dict()
        slug = slugify(paper.get("Name", f"paper_{i}"))
        fname = f"{slug}.png"

        # Avatar
        try:
            av = make_avatar(paper)
            av_path = os.path.join(avatar_dir, fname)
            av.save(av_path, "PNG", optimize=True)
            avatar_paths.append(f"{os.path.basename(out_dir)}/avatars/{fname}")
        except Exception as e:
            print(f"  [AVATAR ERROR] row {i}: {e}")
            avatar_paths.append("")

        # Cover
        try:
            cv = make_cover(paper)
            cv_path = os.path.join(cover_dir, fname)
            cv.save(cv_path, "PNG", optimize=True)
            cover_paths.append(f"{os.path.basename(out_dir)}/covers/{fname}")
        except Exception as e:
            print(f"  [COVER ERROR] row {i}: {e}")
            cover_paths.append("")

        if (i + 1) % 20 == 0:
            print(f"  [{i+1}/{total}] done")

    # Write paths back to dataframe
    df["Image avatar"] = avatar_paths
    df["Image cover"]  = cover_paths

    out_xlsx = os.path.abspath(workbook_out or os.path.join(os.path.dirname(xlsx_path), "Geo_papers_schema_v2_with_images.xlsx"))
    df.to_excel(out_xlsx, index=False)
    print(f"\n✅ Done. {total} papers × 2 = {total*2} images generated.")
    print(f"   Avatars: {avatar_dir}")
    print(f"   Covers:  {cover_dir}")
    print(f"   Updated xlsx: {out_xlsx}")
    return df


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--in", dest="infile", default="Geo_papers_schema_v2.xlsx", help="Path to workbook with a Papers sheet")
    parser.add_argument("--out", dest="out_dir", default="paper_images_202", help="Directory for avatars/covers")
    parser.add_argument("--sheet", dest="sheet_name", default="Papers", help="Excel sheet to use")
    parser.add_argument("--limit", type=int, default=0, help="Optional row limit for test runs")
    parser.add_argument("--workbook-out", dest="workbook_out", default="", help="Optional path for updated workbook with image columns")
    args = parser.parse_args()

    generate_all(
        xlsx_path=args.infile,
        out_dir=args.out_dir,
        workbook_out=args.workbook_out or None,
        sheet_name=args.sheet_name,
        limit=args.limit,
    )
