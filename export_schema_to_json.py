"""
export_schema_to_json.py
Exports Geo_papers_schema_v2.xlsx → geo_publish_v2/ JSON files
ready to be consumed by 04_publish_ml_papers_full.ts
"""
import pandas as pd
import json
import os
import re

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
XLSX = os.environ.get("XLSX_PATH", os.path.join(SCRIPT_DIR, "Geo_papers_schema_v2.xlsx"))
OUT  = os.environ.get("OUT_DIR",   os.path.join(SCRIPT_DIR, "geo_publish_v2"))
os.makedirs(OUT, exist_ok=True)

def safe(v):
    s = str(v).strip()
    return None if s in ("nan", "None", "") else s

def load(sheet):
    return pd.read_excel(XLSX, sheet_name=sheet)

# ── helpers ───────────────────────────────────────────────────────────────────
def fmt_date(v):
    s = safe(v)
    if not s: return None
    try:
        if len(s) == 4: return s + "-01-01"
        return s[:10]
    except:
        return None

def slugify(name):
    return re.sub(r"[^a-z0-9]+", "-", str(name).lower()).strip("-")[:60]

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
    v = safe(name)
    if not v:
        return None
    return SAFE_VENUE_RENAMES.get(v, v)

# ── 1. eras ───────────────────────────────────────────────────────────────────
eras_df = load("Eras")
eras = []
for _, r in eras_df.iterrows():
    eras.append({
        "id":          safe(r["Era ID"]),
        "name":        safe(r["Name"]),
        "description": safe(r["Description"]),
        "years":       safe(r["Years"]),
    })
json.dump(eras, open(f"{OUT}/eras.json", "w"), indent=2, ensure_ascii=False)
print(f"eras.json:         {len(eras)}")

# ── 2. domains ────────────────────────────────────────────────────────────────
domains_df = load("Domains")
domains = []
for _, r in domains_df.iterrows():
    domains.append({
        "id":          safe(r["Domain ID"]),
        "name":        safe(r["Name"]),
        "description": safe(r["Description"]),
        "paper_count": int(r["Paper Count"]) if safe(r["Paper Count"]) else 0,
    })
json.dump(domains, open(f"{OUT}/domains.json", "w"), indent=2, ensure_ascii=False)
print(f"domains.json:      {len(domains)}")

# ── 3. venues ─────────────────────────────────────────────────────────────────
venues_df = load("Venues")
venues = []
for _, r in venues_df.iterrows():
    venues.append({
        "id":          safe(r["Venue ID"]),
        "name":        canonicalize_venue_name(r["Name"]),
        "short_name":  safe(r["Short Name"]),
        "type":        safe(r["Type"]),
        "description": safe(r["Description"]),
        "since":       int(r["Since"]) if safe(r["Since"]) else None,
        "web_url":     safe(r["Web URL"]),
    })
json.dump(venues, open(f"{OUT}/venues.json", "w"), indent=2, ensure_ascii=False)
print(f"venues.json:       {len(venues)}")

# ── 4. datasets ───────────────────────────────────────────────────────────────
datasets_df = load("Datasets")
datasets = []
for _, r in datasets_df.iterrows():
    datasets.append({
        "id":          safe(r["Dataset ID"]),
        "name":        safe(r["Name"]),
        "description": safe(r["Description"]),
        "domain":      safe(r["Domain"]),
        "year":        int(r["Year"]) if safe(r["Year"]) else None,
        "size":        safe(r["Size"]),
        "web_url":     safe(r["Web URL"]),
    })
json.dump(datasets, open(f"{OUT}/datasets.json", "w"), indent=2, ensure_ascii=False)
print(f"datasets.json:     {len(datasets)}")

# ── 5. concepts ───────────────────────────────────────────────────────────────
concepts_df = load("Concepts")
concepts = []
for _, r in concepts_df.iterrows():
    concepts.append({
        "id":          safe(r["Concept ID"]),
        "name":        safe(r["Name"]),
        "description": safe(r["Description"]),
        "domain":      safe(r["Domain"]),
    })
json.dump(concepts, open(f"{OUT}/concepts.json", "w"), indent=2, ensure_ascii=False)
print(f"concepts.json:     {len(concepts)}")

# ── 6. organizations ──────────────────────────────────────────────────────────
orgs_df = load("Organizations")
orgs = []
for _, r in orgs_df.iterrows():
    orgs.append({
        "id":          safe(r["Org ID"]),
        "name":        safe(r["Name"]),
        "type":        safe(r["Type"]),
        "country":     safe(r["Country"]),
        "web_url":     safe(r["Web URL"]),
        "description": safe(r["Description"]),
    })
json.dump(orgs, open(f"{OUT}/organizations.json", "w"), indent=2, ensure_ascii=False)
print(f"organizations.json:{len(orgs)}")

# ── 7. persons ────────────────────────────────────────────────────────────────
persons_df = load("Persons")
persons = []
for _, r in persons_df.iterrows():
    persons.append({
        "id":          safe(r["Person ID"]),
        "name":        safe(r["Full Name"]),
        "description": safe(r["Description"]) or "Researcher in machine learning and AI.",
        "affiliation": safe(r["Affiliation"]),
        "web_url":     safe(r.get("Web URL")),
    })
json.dump(persons, open(f"{OUT}/persons.json", "w"), indent=2, ensure_ascii=False)
print(f"persons.json:      {len(persons)}")

# ── 8. papers ─────────────────────────────────────────────────────────────────
papers_df = load("Papers")
papers = []
for _, r in papers_df.iterrows():
    name = safe(r["Name"])
    if not name: continue

    desc        = safe(r["Description"]) or ""
    abstract    = safe(r["Abstract"])
    venue       = canonicalize_venue_name(r["Venue"])
    domain      = safe(r["Domain"])
    era         = safe(r["Era"])
    year        = safe(r["Year"])
    doi         = safe(r["DOI"])
    arxiv_url   = safe(r["arXiv URL"])
    code_url    = safe(r["Code URL"])
    anchor      = safe(r["Anchor Type"])
    cit         = safe(r["Citation count"])
    av_path     = safe(r.get("Image avatar"))
    cv_path     = safe(r.get("Image cover"))
    paper_id    = safe(r.get("Paper ID")) or slugify(name)
    authors_str = safe(r.get("Authors"))

    # Blocks: quick facts + abstract
    meta = []
    if year:   meta.append(f"**Year:** {str(year)[:4]}")
    if venue:  meta.append(f"**Venue:** {venue}")
    if domain: meta.append(f"**Domain:** {domain}")
    if era:    meta.append(f"**Era:** {era}")
    if anchor: meta.append(f"**Type:** {anchor}")
    if cit:
        try: meta.append(f"**Citations:** {int(float(cit)):,}")
        except: pass
    if doi:       meta.append(f"**DOI:** [{doi}](https://doi.org/{doi})")
    if arxiv_url: meta.append(f"**arXiv:** [{arxiv_url}]({arxiv_url})")
    if code_url:  meta.append(f"**Code:** [{code_url}]({code_url})")

    # Each block is a SEPARATE text block entity in Geo.
    # Geo renders markdown per-block — mixing "##" heading and "**bold**" bullets
    # in one block breaks the renderer.  Correct format:
    #   Block 0: "## Quick Facts"    ← heading alone
    #   Block 1: "Year: 2020"        ← plain, no ** markers
    #   Block 2: "Venue: NeurIPS"    ← plain
    #   ...
    #   Block N:   "## Abstract"
    #   Block N+1: <abstract text>
    blocks = []
    if meta:
        blocks.append("## Quick Facts")         # heading block
        for line in meta:
            # Strip **bold:** markers → plain "Key: Value"
            clean = line.replace("**", "")
            blocks.append(clean)                 # one block per fact line
    if abstract:
        blocks.append("## Abstract")             # heading block
        blocks.append(abstract)                  # body block

    web_url = safe(r.get("Web URL"))
    if not web_url and doi:       web_url = f"https://doi.org/{doi}"
    if not web_url and arxiv_url: web_url = arxiv_url

    people_names = (
        [a.strip() for a in authors_str.split(";") if a.strip()]
        if authors_str else []
    )

    paper = {
        "id":               paper_id,
        "name":             name,
        "description":      desc,
        "web_url":          web_url,
        "date_founded":     fmt_date(r.get("Publication date")) or fmt_date(r.get("Year")),
        "domain":           domain,
        "era":              era,
        "venue":            venue,
        "people":           people_names,
        "blocks":           blocks,
        "arxiv_url":        arxiv_url,
        "code_url":         code_url,
        "citation_count":   int(float(cit)) if cit else None,
        "key_contribution": safe(r.get("Key contribution")),
        "doi":              doi,
        "abstract":         abstract,
        "anchor_type":      anchor,
    }
    if av_path: paper["avatar_local"] = av_path
    if cv_path: paper["cover_local"]  = cv_path
    papers.append(paper)

json.dump(papers, open(f"{OUT}/papers.json", "w"), indent=2, ensure_ascii=False)
print(f"papers.json:       {len(papers)}")

# ── 9. relation tables ────────────────────────────────────────────────────────
def export_rel(sheet, out_name, row_fn):
    df = load(sheet)
    rows = [row_fn(r) for _, r in df.iterrows() if row_fn(r)]
    json.dump(rows, open(f"{OUT}/{out_name}", "w"), indent=2, ensure_ascii=False)
    print(f"{out_name}:{' '*(25-len(out_name))}{len(rows)}")

export_rel("Rel_Paper_Person", "rel_paper_person.json",
    lambda r: {
        "paper_id":    safe(r["Paper ID"]),
        "paper_name":  safe(r["Paper Name"]),
        "person_id":   safe(r["Person ID"]),
        "person_name": safe(r["Person Name"]),
        "relation":    safe(r["Relation"]),
        "role":        safe(r["Role"]),
        "order":       int(r["Order"]) if safe(r["Order"]) else None,
        "affiliation": safe(r["Affiliation"]),
    } if safe(r["Paper ID"]) else None
)

export_rel("Rel_Paper_Venue", "rel_paper_venue.json",
    lambda r: {
        "paper_id":   safe(r["Paper ID"]),
        "paper_name": safe(r["Paper Name"]),
        "venue_name": canonicalize_venue_name(r["Venue Name"]),
        "relation":   "PUBLISHED_IN",
    } if safe(r["Paper ID"]) and safe(r["Venue Name"]) else None
)

export_rel("Rel_Paper_Dataset", "rel_paper_dataset.json",
    lambda r: {
        "paper_id":    safe(r["Paper ID"]),
        "paper_name":  safe(r["Paper Name"]),
        "dataset_name":safe(r["Dataset Name"]),
        "relation":    safe(r["Relation"]),
    } if safe(r["Paper ID"]) and safe(r["Dataset Name"]) else None
)

export_rel("Rel_Paper_Concept", "rel_paper_concept.json",
    lambda r: {
        "paper_id":    safe(r["Paper ID"]),
        "paper_name":  safe(r["Paper Name"]),
        "concept_name":safe(r["Concept Name"]),
        "relation":    safe(r["Relation"]),
    } if safe(r["Paper ID"]) and safe(r["Concept Name"]) else None
)

export_rel("Rel_Paper_Organization", "rel_paper_org.json",
    lambda r: {
        "paper_id":    safe(r["Paper ID"]),
        "paper_name":  safe(r["Paper Name"]),
        "org_name":    safe(r["Organization"]),
        "relation":    "HAS_AFFILIATION",
        "via_author":  safe(r["Via Author"]),
    } if safe(r["Paper ID"]) and safe(r["Organization"]) else None
)

export_rel("Rel_Person_Organization", "rel_person_org.json",
    lambda r: {
        "person_id":  safe(r["Person ID"]),
        "person_name":safe(r["Person Name"]),
        "org_name":   safe(r["Organization"]),
        "relation":   "AFFILIATED_WITH",
    } if safe(r["Person ID"]) and safe(r["Organization"]) else None
)

export_rel("Rel_Paper_Era", "rel_paper_era.json",
    lambda r: {
        "paper_id":   safe(r["Paper ID"]),
        "paper_name": safe(r["Paper Name"]),
        "era_name":   safe(r["Era"]),
        "relation":   "IN_ERA",
    } if safe(r["Paper ID"]) and safe(r["Era"]) else None
)

export_rel("Rel_Paper_Domain", "rel_paper_domain.json",
    lambda r: {
        "paper_id":    safe(r["Paper ID"]),
        "paper_name":  safe(r["Paper Name"]),
        "domain_name": safe(r["Domain"]),
        "relation":    "IN_DOMAIN",
    } if safe(r["Paper ID"]) and safe(r["Domain"]) else None
)

print(f"\n✅ All JSON files written to {OUT}/")
print(f"   Total files: {len(os.listdir(OUT))}")
