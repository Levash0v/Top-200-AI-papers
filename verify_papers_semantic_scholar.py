#!/usr/bin/env python3
"""
Verify and enrich the Top-200 papers workbook with Semantic Scholar matches.

This script is intentionally conservative:
- it does not overwrite curator fields by default
- it adds candidate/QA columns for manual review
- it can run against the public Semantic Scholar API without an API key
"""

from __future__ import annotations

import argparse
import json
import math
import re
import time
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any, Dict, Optional

import pandas as pd
import requests

S2_BASE = "https://api.semanticscholar.org/graph/v1"
USER_AGENT = "geo-top200-verifier/1.0"
MATCH_REVIEW_THRESHOLD = 0.78
DEFAULT_CACHE = ".cache/semantic_scholar_cache.json"
REQUEST_RETRIES = 3
PEER_REVIEWED_EXACT = {
    "ACL",
    "CVPR",
    "ECCV",
    "EMNLP",
    "ICCV",
    "ICLR",
    "ICML",
    "JMLR",
    "NAACL",
    "Nature",
    "NeurIPS",
    "PNAS",
    "Science",
    "TPAMI",
}
PREPRINT_MARKERS = ("arxiv", "preprint", "technical report", "tech report")
MODEL_TERMS = (
    "model",
    "transformer",
    "bert",
    "gpt",
    "llama",
    "resnet",
    "alphafold",
    "yolo",
    "clip",
    "vit",
)
SUMMARY_STARTERS = ("this paper", "we introduce", "we propose", "the paper introduces", "the paper proposes")


def safe_str(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and math.isnan(value):
        return ""
    return str(value).strip()


def normalize_text(value: Any) -> str:
    text = safe_str(value).lower()
    text = re.sub(r"[^a-z0-9\s]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def title_similarity(left: str, right: str) -> float:
    return SequenceMatcher(None, normalize_text(left), normalize_text(right)).ratio()


def cache_key(url: str, params: Dict[str, Any]) -> str:
    return json.dumps({"url": url, "params": params}, sort_keys=True, ensure_ascii=True)


def load_cache(path: Path) -> Dict[str, Any]:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text())
    except Exception:
        return {}


def save_cache(path: Path, cache: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(cache, ensure_ascii=False, indent=2))


def req_json(
    url: str,
    params: Dict[str, Any],
    timeout: int = 30,
    retries: int = REQUEST_RETRIES,
    cache: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    key = cache_key(url, params)
    if cache is not None and key in cache:
        return cache[key]

    last_error: Optional[Exception] = None
    for attempt in range(retries):
        try:
            response = requests.get(
                url,
                params=params,
                timeout=timeout,
                headers={"User-Agent": USER_AGENT},
            )
            response.raise_for_status()
            data = response.json()
            if cache is not None:
                cache[key] = data
            return data
        except Exception as exc:
            last_error = exc
            if attempt < retries - 1:
                time.sleep(min(2 ** attempt, 4))

    raise last_error if last_error else RuntimeError("Unknown request error")


def fetch_semantic_scholar_by_paper_id(
    paper_id: str,
    sleep_s: float,
    cache: Optional[Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    paper_id = safe_str(paper_id)
    if not paper_id:
        return None
    params = {
        "fields": "paperId,title,year,citationCount,venue,publicationDate,url,abstract,tldr,externalIds",
    }
    data = req_json(f"{S2_BASE}/paper/{paper_id}", params=params, cache=cache)
    time.sleep(sleep_s)
    data["_match_score"] = 1.0
    return data


def search_semantic_scholar(
    title: str,
    year: Optional[int],
    sleep_s: float,
    cache: Optional[Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    query = safe_str(title)
    if not query:
        return None

    params = {
        "query": query,
        "limit": 5,
        "fields": "paperId,title,year,citationCount,venue,publicationDate,url,abstract,tldr,externalIds",
    }
    data = req_json(f"{S2_BASE}/paper/search", params=params, cache=cache)
    time.sleep(sleep_s)
    papers = data.get("data") or []
    if not papers:
        return None

    best = None
    best_score = -1.0
    for paper in papers:
        remote_title = safe_str(paper.get("title"))
        score = title_similarity(query, remote_title)
        remote_year = paper.get("year")
        if year and remote_year:
          # Prefer close publication years but do not require exact match.
            score -= min(abs(int(remote_year) - year), 3) * 0.03
        if score > best_score:
            best = paper
            best_score = score

    if not best:
        return None

    best["_match_score"] = round(best_score, 4)
    return best


def search_semantic_scholar_with_fallback(
    title: str,
    year: Optional[int],
    doi: str,
    semantic_scholar_url_value: str,
    sleep_s: float,
    cache: Optional[Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    existing_url = safe_str(semantic_scholar_url_value)
    paper_id_match = re.search(r"/paper/([A-Za-z0-9]+)", existing_url)
    if paper_id_match:
        try:
            return fetch_semantic_scholar_by_paper_id(paper_id_match.group(1), sleep_s, cache)
        except Exception:
            pass

    doi = safe_str(doi)
    if doi:
        try:
            data = fetch_semantic_scholar_by_paper_id(f"DOI:{doi}", sleep_s, cache)
            if data:
                return data
        except Exception:
            pass

    return search_semantic_scholar(title, year, sleep_s, cache)


def semantic_scholar_url(record: Dict[str, Any]) -> str:
    url = safe_str(record.get("url"))
    if url:
        return url
    paper_id = safe_str(record.get("paperId"))
    if not paper_id:
        return ""
    return f"https://www.semanticscholar.org/paper/{paper_id}"


def derive_peer_reviewed_by(venue: str) -> str:
    text = safe_str(venue)
    if not text:
        return ""
    norm = normalize_text(text)
    if any(marker in norm for marker in PREPRINT_MARKERS):
        return ""
    if text in PEER_REVIEWED_EXACT:
        return text
    if "conference" in norm or "journal" in norm or "transactions" in norm or "proceedings" in norm:
        return text
    return ""


def first_sentence(text: str) -> str:
    text = safe_str(text)
    if not text:
        return ""
    parts = re.split(r"(?<=[.!?])\s+", text)
    return safe_str(parts[0])


def suggest_key_contribution(row: pd.Series, s2_record: Optional[Dict[str, Any]]) -> str:
    if s2_record:
        tldr = s2_record.get("tldr") or {}
        tldr_text = safe_str(tldr.get("text"))
        if tldr_text:
            return tldr_text

        abstract = safe_str(s2_record.get("abstract"))
        first = first_sentence(abstract)
        if first:
            lower = first.lower()
            if any(lower.startswith(starter) for starter in SUMMARY_STARTERS):
                return first
            return f"This paper {first[:1].lower()}{first[1:]}" if first else ""

    description = safe_str(row.get("Description"))
    first = first_sentence(description)
    if first:
        return first
    return ""


def qa_key_contribution(row: pd.Series, suggestion: str) -> str:
    current = safe_str(row.get("Key contribution"))
    if not current:
        return "missing"
    if len(current.split()) < 5:
        return "too_short"
    if len(current.split()) > 45:
        return "too_long"
    title_score = title_similarity(current, safe_str(row.get("Name")))
    abstract_score = title_similarity(current, safe_str(row.get("Abstract")))
    if suggestion and title_score < 0.08 and abstract_score < 0.12:
        return "low_support"
    return "ok"


def detect_introduced_model_candidate(row: pd.Series, s2_record: Optional[Dict[str, Any]]) -> tuple[str, str]:
    corpus = " ".join(
        filter(
            None,
            [
                safe_str(row.get("Name")),
                safe_str(row.get("Abstract")),
                safe_str((s2_record or {}).get("abstract")),
                safe_str(row.get("Key contribution")),
            ],
        )
    )
    lowered = corpus.lower()
    if not any(term in lowered for term in ("introduce", "introduced", "propose", "proposed", "present")):
        return "", "low"
    for term in MODEL_TERMS:
        if term in lowered:
            return term, "medium"
    return "", "low"


def citation_review_signal(
    current_citations: Any,
    s2_citations: Any,
    year: Optional[int],
    match_score: Any,
) -> tuple[str, bool]:
    if pd.isna(current_citations) or pd.isna(s2_citations):
        return "", False

    current = float(current_citations)
    s2_value = float(s2_citations)
    diff = s2_value - current
    abs_diff = abs(diff)
    diff_ratio = abs_diff / max(abs(current), 1.0)
    score = float(match_score) if match_score not in ("", None) else 0.0

    if year and year < 2000 and score >= 0.95:
        if abs_diff >= 5000:
            return "historical_large_diff", False
        return "", False

    if score < 0.78 and abs_diff >= 1000:
        return "large_diff_low_match", True
    if abs_diff >= 10000 and diff_ratio >= 1.5:
        return "very_large_diff", True
    if year and year >= 2000 and abs_diff >= 5000 and diff_ratio >= 0.75:
        return "large_diff_modern_paper", True
    if abs_diff >= 5000:
        return "large_diff_observed", False

    return "", False


def change_marker(current_value: Any, suggested_value: Any) -> str:
    current = safe_str(current_value)
    suggested = safe_str(suggested_value)
    if not suggested:
        return ""
    if not current:
        return "fill"
    if normalize_text(current) == normalize_text(suggested):
        return "same"
    return "different"


def build_report_row(row: pd.Series, s2_record: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    year = pd.to_numeric(row.get("Year"), errors="coerce")
    year_int = None if pd.isna(year) else int(year)
    current_citations = pd.to_numeric(row.get("Citation count"), errors="coerce")
    s2_citations = pd.to_numeric((s2_record or {}).get("citationCount"), errors="coerce")
    citation_diff = ""
    if not pd.isna(current_citations) and not pd.isna(s2_citations):
        citation_diff = round(float(s2_citations) - float(current_citations), 2)

    venue = safe_str(row.get("Venue")) or safe_str((s2_record or {}).get("venue"))
    peer_reviewed = derive_peer_reviewed_by(venue)
    suggestion = suggest_key_contribution(row, s2_record)
    key_qa = qa_key_contribution(row, suggestion)
    model_candidate, model_confidence = detect_introduced_model_candidate(row, s2_record)
    match_score = (s2_record or {}).get("_match_score", "")
    citation_note, citation_requires_review = citation_review_signal(
        current_citations=current_citations,
        s2_citations=s2_citations,
        year=year_int,
        match_score=match_score,
    )
    semantic_url = semantic_scholar_url(s2_record or {})
    semantic_url_change = change_marker(row.get("Semantic Scholar URL"), semantic_url)
    peer_review_change = change_marker(row.get("Peer-reviewed by"), peer_reviewed)
    key_contribution_change = change_marker(row.get("Key contribution"), suggestion)
    needs_metadata_review = any(
        [
            match_score != "" and match_score < MATCH_REVIEW_THRESHOLD,
            citation_requires_review,
        ]
    )
    editorial_flag = key_qa in {"too_short", "too_long", "low_support"} or bool(model_candidate)
    needs_editorial_review = any(
        [
            editorial_flag,
            bool(model_candidate),
        ]
    )
    needs_manual = needs_metadata_review or needs_editorial_review

    return {
        "Semantic Scholar URL": semantic_url,
        "Semantic Scholar Paper ID": safe_str((s2_record or {}).get("paperId")),
        "Semantic Scholar Match Score": match_score,
        "Semantic Scholar URL change": semantic_url_change,
        "Citation count (Semantic Scholar)": "" if pd.isna(s2_citations) else int(s2_citations),
        "Citation diff vs current": citation_diff,
        "Citation review note": citation_note,
        "Peer-reviewed by (candidate)": peer_reviewed,
        "Peer-reviewed flag": "yes" if peer_reviewed else "no",
        "Peer-reviewed change": peer_review_change,
        "Introduced model (candidate)": model_candidate,
        "Introduced model confidence": model_confidence,
        "Suggested key contribution": suggestion,
        "Key contribution change": key_contribution_change,
        "Key contribution QA": key_qa,
        "Missing key contribution": "yes" if key_qa == "missing" else "no",
        "Needs metadata review": "yes" if needs_metadata_review else "no",
        "Needs editorial review": "yes" if needs_editorial_review else "no",
        "Needs manual review": "yes" if needs_manual else "no",
    }


def ensure_columns(df: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    for column in columns:
        if column not in df.columns:
            df[column] = ""
    return df


def apply_fill_only(row: pd.Series, report: Dict[str, Any]) -> Dict[str, Any]:
    fill_only_columns = {
        "Semantic Scholar URL",
        "Semantic Scholar Paper ID",
        "Semantic Scholar Match Score",
        "Semantic Scholar URL change",
        "Citation count (Semantic Scholar)",
        "Citation diff vs current",
        "Citation review note",
        "Peer-reviewed by (candidate)",
        "Peer-reviewed flag",
        "Peer-reviewed change",
    }
    result = dict(report)
    for key, value in report.items():
        if key in fill_only_columns:
            continue
        result[key] = row.get(key, "")
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--in", dest="infile", default="Geo_papers_schema_v2.xlsx")
    parser.add_argument("--out", dest="outfile", default="Geo_papers_schema_v2_verified.xlsx")
    parser.add_argument("--report", dest="report", default="paper_verification_report.csv")
    parser.add_argument("--json-report", dest="json_report", default="paper_verification_report.json")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--sleep", type=float, default=0.35)
    parser.add_argument("--cache", default=DEFAULT_CACHE)
    parser.add_argument("--fill-only", action="store_true")
    args = parser.parse_args()

    infile = Path(args.infile)
    outfile = Path(args.outfile)
    report_csv = Path(args.report)
    report_json = Path(args.json_report)
    cache_path = Path(args.cache)
    cache = load_cache(cache_path)

    sheets = pd.read_excel(infile, sheet_name=None)
    papers = sheets["Papers"].copy()
    if args.limit > 0:
        papers = papers.head(args.limit).copy()

    qa_columns = [
        "Semantic Scholar URL",
        "Semantic Scholar Paper ID",
        "Semantic Scholar Match Score",
        "Semantic Scholar URL change",
        "Citation count (Semantic Scholar)",
        "Citation diff vs current",
        "Citation review note",
        "Peer-reviewed by (candidate)",
        "Peer-reviewed flag",
        "Peer-reviewed change",
        "Introduced model (candidate)",
        "Introduced model confidence",
        "Suggested key contribution",
        "Key contribution change",
        "Key contribution QA",
        "Missing key contribution",
        "Needs metadata review",
        "Needs editorial review",
        "Needs manual review",
    ]
    papers = ensure_columns(papers, qa_columns)

    report_rows = []
    for idx, row in papers.iterrows():
        title = safe_str(row.get("Name"))
        year = pd.to_numeric(row.get("Year"), errors="coerce")
        year_int = None if pd.isna(year) else int(year)
        try:
            s2_record = search_semantic_scholar_with_fallback(
                title=title,
                year=year_int,
                doi=safe_str(row.get("DOI")),
                semantic_scholar_url_value=safe_str(row.get("Semantic Scholar URL")),
                sleep_s=args.sleep,
                cache=cache,
            )
        except Exception as exc:
            s2_record = {"_error": str(exc), "_match_score": ""}
        report = build_report_row(row, s2_record if "paperId" in (s2_record or {}) else None)
        if args.fill_only:
            report = apply_fill_only(row, report)
        for key, value in report.items():
            papers.at[idx, key] = value
        report_rows.append(
            {
                "Name": title,
                "Year": year_int or "",
                "Venue": safe_str(row.get("Venue")),
                "Current Citation count": safe_str(row.get("Citation count")),
                **report,
                "Semantic Scholar Error": safe_str((s2_record or {}).get("_error")),
            }
        )

    out_sheets = dict(sheets)
    out_sheets["Papers"] = papers
    report_df = pd.DataFrame(report_rows)
    out_sheets["Verification_Report"] = report_df

    with pd.ExcelWriter(outfile, engine="openpyxl") as writer:
      for name, df in out_sheets.items():
            df.to_excel(writer, sheet_name=name[:31], index=False)

    report_df.to_csv(report_csv, index=False)
    report_json.write_text(json.dumps(report_rows, indent=2, ensure_ascii=False))
    save_cache(cache_path, cache)

    print(f"Saved workbook: {outfile}")
    print(f"Saved CSV report: {report_csv}")
    print(f"Saved JSON report: {report_json}")
    print(f"Rows processed: {len(papers)}")


if __name__ == "__main__":
    main()
