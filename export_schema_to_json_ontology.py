"""
export_schema_to_json_ontology.py

Reads Geo_papers_schema_v2_metrics.xlsx and exports an ontology-aligned JSON set
without requiring a manual workbook migration first.

This exporter is intended as the bridge step between:

- current source workbook v2
- future ontology-aligned publication rewrite

Output structure:
- geo_publish_v2_ontology/
  - papers.json
  - persons.json
  - organizations.json
  - datasets.json
  - topics.json
  - tags.json
  - venues_conference.json
  - venues_journal.json
  - rel_paper_person.json
  - rel_paper_org.json
  - rel_person_org.json
  - rel_paper_dataset.json
  - rel_paper_topic.json
  - rel_paper_tag.json
  - rel_paper_venue.json
"""

from __future__ import annotations

import json
import os
import re
from collections import OrderedDict
from pathlib import Path
from typing import Callable

import pandas as pd


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_XLSX = "/Users/max/Documents/GitHub/geo/geo_tech_demo/Geo_papers_schema_v2_metrics.xlsx"
XLSX = os.environ.get("XLSX_PATH", DEFAULT_XLSX)
OUT = os.environ.get("OUT_DIR", os.path.join(SCRIPT_DIR, "geo_publish_v2_ontology"))
os.makedirs(OUT, exist_ok=True)


def safe(v):
    if v is None:
        return None
    s = str(v).strip()
    return None if s in ("nan", "None", "") else s


def load(sheet):
    return pd.read_excel(XLSX, sheet_name=sheet)


def write_json(name: str, payload) -> None:
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
    print(f"{name}:{' ' * max(1, 24 - len(name))}{len(payload)}")


def fmt_date(v):
    s = safe(v)
    if not s:
        return None
    if len(s) == 4:
        return s + "-01-01"
    return s[:10]


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", str(name).lower()).strip("-")[:80]


SAFE_VENUE_RENAMES = {
    "Advances in Neural Information Processing Systems (NeurIPS)": "NeurIPS",
    "International Conference on Machine Learning (ICML)": "ICML",
    "International Conference on Learning Representations (ICLR)": "ICLR",
    "IEEE Conference on Computer Vision and Pattern Recognition (CVPR)": "CVPR",
    "European Conference on Computer Vision (ECCV)": "ECCV",
    "International Conference on Computer Vision (ICCV)": "ICCV",
    "Annual Meeting of the Association for Computational Linguistics (ACL)": "ACL",
    "North American Chapter of the ACL (NAACL)": "NAACL",
    "Empirical Methods in Natural Language Processing (EMNLP)": "EMNLP",
    "Journal of Machine Learning Research (JMLR)": "JMLR",
    "IEEE Transactions on Pattern Analysis and Machine Intelligence (TPAMI)": "TPAMI",
    "Proceedings of the National Academy of Sciences (PNAS)": "PNAS",
    "arXiv (Cornell University)": "arXiv",
}


def canonicalize_venue_name(name):
    value = safe(name)
    if not value:
        return None
    return SAFE_VENUE_RENAMES.get(value, value)


def anchor_tag_id(name: str) -> str:
    return f"anchor:{slugify(name)}"


def era_tag_id(name: str) -> str:
    return f"era:{slugify(name)}"


def export_rel(sheet: str, out_name: str, row_fn: Callable[[pd.Series], dict | None]) -> None:
    df = load(sheet)
    rows = []
    for _, row in df.iterrows():
        mapped = row_fn(row)
        if mapped:
            rows.append(mapped)
    write_json(out_name, rows)


papers_df = load("Papers")
domains_df = load("Domains")
concepts_df = load("Concepts")
eras_df = load("Eras")
venues_df = load("Venues")
datasets_df = load("Datasets")
persons_df = load("Persons")
orgs_df = load("Organizations")

# Persons
persons = []
for _, r in persons_df.iterrows():
    persons.append(
        {
            "id": safe(r["Person ID"]),
            "name": safe(r["Full Name"]),
            "description": safe(r["Description"]) or "Researcher in machine learning and AI.",
            "affiliation": safe(r["Affiliation"]),
            "web_url": safe(r.get("Web URL")),
            "author_class": safe(r.get("author_class")),
        }
    )
write_json("persons.json", persons)

# Organizations
organizations = []
for _, r in orgs_df.iterrows():
    organizations.append(
        {
            "id": safe(r["Org ID"]),
            "name": safe(r["Name"]),
            "type": safe(r["Type"]),
            "country": safe(r["Country"]),
            "web_url": safe(r["Web URL"]),
            "description": safe(r["Description"]),
        }
    )
write_json("organizations.json", organizations)

# Datasets
datasets = []
for _, r in datasets_df.iterrows():
    datasets.append(
        {
            "id": safe(r["Dataset ID"]),
            "name": safe(r["Name"]),
            "description": safe(r["Description"]),
            "domain": safe(r["Domain"]),
            "year": int(r["Year"]) if safe(r["Year"]) else None,
            "size": safe(r["Size"]),
            "web_url": safe(r["Web URL"]),
        }
    )
write_json("datasets.json", datasets)

# Topics = domains + concepts
topics = []
for _, r in domains_df.iterrows():
    topics.append(
        {
            "id": safe(r["Domain ID"]),
            "name": safe(r["Name"]),
            "topic_kind": "Domain",
            "description": safe(r["Description"]),
            "parent_topic": None,
            "paper_count": int(r["Paper Count"]) if safe(r["Paper Count"]) else 0,
        }
    )
for _, r in concepts_df.iterrows():
    topics.append(
        {
            "id": safe(r["Concept ID"]),
            "name": safe(r["Name"]),
            "topic_kind": "Concept",
            "description": safe(r["Description"]),
            "parent_topic": safe(r["Domain"]),
            "paper_count": int(r["paper_count"]) if safe(r["paper_count"]) else None,
            "cross_domain_reach": safe(r.get("cross_domain_reach")),
            "era_span": safe(r.get("era_span")),
            "importance_score": safe(r.get("importance_score")),
        }
    )
write_json("topics.json", topics)

# Tags = eras + anchor types
tags_map = OrderedDict()
for _, r in eras_df.iterrows():
    name = safe(r["Name"])
    if not name:
        continue
    tags_map[era_tag_id(name)] = {
        "id": era_tag_id(name),
        "name": name,
        "tag_kind": "Era",
        "description": safe(r["Description"]),
        "years": safe(r["Years"]),
    }
for _, r in papers_df.iterrows():
    anchor = safe(r["Anchor Type"])
    if not anchor:
        continue
    key = anchor_tag_id(anchor)
    if key not in tags_map:
        tags_map[key] = {
            "id": key,
            "name": anchor,
            "tag_kind": "Anchor Type",
            "description": None,
        }
write_json("tags.json", list(tags_map.values()))

# Venues split
venues_conference = []
venues_journal = []
venue_type_by_name = {}
for _, r in venues_df.iterrows():
    name = canonicalize_venue_name(r["Name"])
    vtype = safe(r["Type"])
    if not name or not vtype:
        continue
    venue_type_by_name[name] = vtype
    payload = {
        "id": safe(r["Venue ID"]),
        "name": name,
        "short_name": safe(r["Short Name"]),
        "type": vtype,
        "description": safe(r["Description"]),
        "since": int(r["Since"]) if safe(r["Since"]) else None,
        "web_url": safe(r["Web URL"]),
    }
    if vtype == "Conference":
        venues_conference.append(payload)
    elif vtype == "Journal":
        venues_journal.append(payload)
write_json("venues_conference.json", venues_conference)
write_json("venues_journal.json", venues_journal)

# Papers
papers = []
for _, r in papers_df.iterrows():
    name = safe(r["Name"])
    if not name:
        continue

    doi = safe(r["DOI"])
    arxiv_url = safe(r["arXiv URL"])
    web_url = safe(r["Web URL"])
    if not web_url and doi:
        web_url = f"https://doi.org/{doi}"
    if not web_url and arxiv_url:
        web_url = arxiv_url

    citation_raw = safe(r["Citation count"])
    citation_count = int(float(citation_raw)) if citation_raw else None
    venue_name = canonicalize_venue_name(r["Venue"])
    venue_type = venue_type_by_name.get(venue_name)

    papers.append(
        {
            "id": safe(r.get("Paper ID")) or slugify(name),
            "name": name,
            "description": safe(r["Description"]) or "",
            "publication_date": fmt_date(r.get("Publication date")) or fmt_date(r.get("Year")),
            "year": safe(r.get("Year")),
            "doi": doi,
            "web_url": web_url,
            "arxiv_url": arxiv_url,
            "code_url": safe(r["Code URL"]),
            "semantic_scholar_url": safe(r.get("Semantic Scholar URL")),
            "abstract": safe(r["Abstract"]),
            "key_contribution": safe(r.get("Key contribution")),
            "citation_count": citation_count,
            "peer_reviewed_by": safe(r.get("Peer-reviewed by")),
            "primary_venue_name": venue_name if venue_type in {"Conference", "Journal"} else None,
            "primary_venue_type": venue_type if venue_type in {"Conference", "Journal"} else None,
            "is_preprint_only": venue_type == "Preprint" if venue_type else False,
            "image_avatar": safe(r.get("Image avatar")),
            "image_cover": safe(r.get("Image cover")),
            "year_normalized_citations": safe(r.get("year_normalized_citations")),
            "composite_score": safe(r.get("composite_score")),
            "graph_degree": safe(r.get("graph_degree")),
        }
    )
write_json("papers.json", papers)

# Relation exports
export_rel(
    "Rel_Paper_Person",
    "rel_paper_person.json",
    lambda r: {
        "paper_id": safe(r["Paper ID"]),
        "paper_name": safe(r["Paper Name"]),
        "person_id": safe(r["Person ID"]),
        "person_name": safe(r["Person Name"]),
        "relation": safe(r["Relation"]),
        "role": safe(r["Role"]),
        "order": int(r["Order"]) if safe(r["Order"]) else None,
        "affiliation": safe(r["Affiliation"]),
        "confidence": safe(r.get("Confidence")),
    }
    if safe(r["Paper ID"]) and safe(r["Person ID"])
    else None,
)

export_rel(
    "Rel_Paper_Organization",
    "rel_paper_org.json",
    lambda r: {
        "paper_id": safe(r["Paper ID"]),
        "paper_name": safe(r["Paper Name"]),
        "org_id": safe(r.get("Org ID")),
        "org_name": safe(r.get("Org Name")) or safe(r["Organization"]),
        "relation": safe(r["Relation"]) or "HAS_AFFILIATION",
        "via_author": safe(r["Via Author"]),
    }
    if safe(r["Paper ID"]) and (safe(r.get("Org ID")) or safe(r["Organization"]))
    else None,
)

export_rel(
    "Rel_Person_Organization",
    "rel_person_org.json",
    lambda r: {
        "person_id": safe(r["Person ID"]),
        "person_name": safe(r["Person Name"]),
        "org_name": safe(r["Organization"]),
        "relation": safe(r["Relation"]) or "AFFILIATED_WITH",
    }
    if safe(r["Person ID"]) and safe(r["Organization"])
    else None,
)

export_rel(
    "Rel_Paper_Dataset",
    "rel_paper_dataset.json",
    lambda r: {
        "paper_id": safe(r["Paper ID"]),
        "paper_name": safe(r["Paper Name"]),
        "dataset_name": safe(r["Dataset Name"]),
        "relation": safe(r["Relation"]),
        "note": safe(r.get("Note")),
    }
    if safe(r["Paper ID"]) and safe(r["Dataset Name"])
    else None,
)

export_rel(
    "Rel_Paper_Domain",
    "rel_paper_topic.json",
    lambda r: {
        "paper_id": safe(r["Paper ID"]),
        "paper_name": safe(r["Paper Name"]),
        "topic_name": safe(r["Domain"]),
        "topic_kind": "Domain",
        "relation": safe(r["Relation"]),
    }
    if safe(r["Paper ID"]) and safe(r["Domain"])
    else None,
)

concept_topic_rows = []
concept_df = load("Rel_Paper_Concept")
for _, r in concept_df.iterrows():
    if not safe(r["Paper ID"]) or not safe(r["Concept Name"]):
        continue
    concept_topic_rows.append(
        {
            "paper_id": safe(r["Paper ID"]),
            "paper_name": safe(r["Paper Name"]),
            "topic_name": safe(r["Concept Name"]),
            "topic_kind": "Concept",
            "relation": safe(r["Relation"]),
            "domain": safe(r.get("Domain")),
        }
    )
with open(os.path.join(OUT, "rel_paper_topic.json"), "r", encoding="utf-8") as f:
    topic_rows = json.load(f)
topic_rows.extend(concept_topic_rows)
write_json("rel_paper_topic.json", topic_rows)

export_rel(
    "Rel_Paper_Era",
    "rel_paper_tag.json",
    lambda r: {
        "paper_id": safe(r["Paper ID"]),
        "paper_name": safe(r["Paper Name"]),
        "tag_name": safe(r["Era"]),
        "tag_kind": "Era",
        "tag_id": era_tag_id(safe(r["Era"])),
        "relation": safe(r["Relation"]) or "IN_ERA",
    }
    if safe(r["Paper ID"]) and safe(r["Era"])
    else None,
)

anchor_tag_rows = []
for _, r in papers_df.iterrows():
    paper_id = safe(r.get("Paper ID"))
    anchor = safe(r.get("Anchor Type"))
    if not paper_id or not anchor:
        continue
    anchor_tag_rows.append(
        {
            "paper_id": paper_id,
            "paper_name": safe(r["Name"]),
            "tag_name": anchor,
            "tag_kind": "Anchor Type",
            "tag_id": anchor_tag_id(anchor),
            "relation": "TAGGED_AS",
        }
    )
with open(os.path.join(OUT, "rel_paper_tag.json"), "r", encoding="utf-8") as f:
    tag_rows = json.load(f)
tag_rows.extend(anchor_tag_rows)
write_json("rel_paper_tag.json", tag_rows)

export_rel(
    "Rel_Paper_Venue",
    "rel_paper_venue.json",
    lambda r: (
        {
            "paper_id": safe(r["Paper ID"]),
            "paper_name": safe(r["Paper Name"]),
            "venue_name": canonicalize_venue_name(r["Venue Name"]),
            "venue_class": venue_type_by_name.get(canonicalize_venue_name(r["Venue Name"])),
            "relation": safe(r["Relation"]) or "PUBLISHED_IN",
            "year": safe(r.get("Year")),
        }
        if venue_type_by_name.get(canonicalize_venue_name(r["Venue Name"])) in {"Conference", "Journal"}
        else None
    )
    if safe(r["Paper ID"]) and safe(r["Venue Name"])
    else None,
)

print(f"\n✅ Ontology-aligned JSON written to {OUT}/")
print(f"   Source workbook: {Path(XLSX).resolve()}")
print(f"   Total files: {len(os.listdir(OUT))}")
