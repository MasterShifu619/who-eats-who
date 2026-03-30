import pandas as pd
import sqlite3
import re
import json
from pathlib import Path


def parse_r(r_str):
    """Parse relationship column — extracts edge properties."""
    if not isinstance(r_str, str):
        return {}

    image_url = ""
    m = re.search(r"image_url:\s*(https?://\S+?)(?=,\s*\w)", r_str)
    if m:
        image_url = m.group(1).strip().rstrip(",")

    obs_url = ""
    m = re.search(r"\burl:\s*(https?://\S+?)(?=,\s*\w)", r_str)
    if m:
        obs_url = m.group(1).strip().rstrip(",")

    lat     = re.search(r"latitude:\s*([-\d.]+)", r_str)
    lon     = re.search(r"longitude:\s*([-\d.]+)", r_str)
    obs     = re.search(r"observed_on:\s*([^\s,}]+)", r_str)
    cap     = re.search(r"captive_cultivated:\s*(\w+)", r_str)
    p_state  = re.search(r"place_state:\s*([^,}]+)", r_str)
    p_county = re.search(r"place_county:\s*([^,}]+)", r_str)
    p_country= re.search(r"place_country:\s*([^,}]+)", r_str)
    prey_agr = re.search(r"prey_agreements:\s*([\d.]+)", r_str)
    pred_agr = re.search(r"predator_agreements:\s*([\d.]+)", r_str)
    tof      = re.search(r"type_of_feeding:\s*(.+?)(?=,\s*place_country:|,\s*latitude:|,\s*longitude:)", r_str)

    return {
        "image_url":           image_url,
        "observation_url":     obs_url,
        "type_of_feeding":     tof.group(1).strip() if tof else "",
        "latitude":            lat.group(1) if lat else "",
        "longitude":           lon.group(1) if lon else "",
        "observed_on":         obs.group(1) if obs else "",
        "place_state":         p_state.group(1).strip() if p_state else "",
        "place_county":        p_county.group(1).strip() if p_county else "",
        "place_country":       p_country.group(1).strip() if p_country else "",
        "captive_cultivated":  cap.group(1) if cap else "false",
        "prey_agreements":     prey_agr.group(1) if prey_agr else "",
        "predator_agreements": pred_agr.group(1) if pred_agr else "",
    }


def parse_n(n_str):
    """Parse node column — extracts species properties."""
    if not isinstance(n_str, str):
        return {}

    def g(pattern):
        m = re.search(pattern, n_str)
        return m.group(1).strip() if m else ""

    return {
        "common_name":       g(r"common_name:\s*([^,}]+)"),
        "scientific_name":   g(r"scientific_name:\s*([^,}]+)"),
        "iconic_taxon_name": g(r"iconic_taxon_name:\s*([^,}]+)"),
        "taxon_kingdom":     g(r"taxon_kingdom:\s*([^,}]+)"),
        "taxon_phylum":      g(r"taxon_phylum:\s*([^,}]+)"),
        "taxon_class":       g(r"taxon_class:\s*([^,}]+)"),
        "taxon_order":       g(r"taxon_order:\s*([^,}]+)"),
        "taxon_family":      g(r"taxon_family:\s*([^,}]+)"),
        "taxon_genus":       g(r"taxon_genus:\s*([^,}]+)"),
        "trophic_pos":       g(r"trophic_pos:\s*([^,}]+)"),
        "totaldegree":       g(r"totaldegree:\s*([\d.]+)"),
        "inDegree":          g(r"inDegree:\s*([\d.]+)"),
        "outDegree":         g(r"outDegree:\s*([\d.]+)"),
        "preyPageRank":      g(r"preyPageRank:\s*([\d.Ee+-]+)"),
        "predPageRank":      g(r"predPageRank:\s*([\d.Ee+-]+)"),
        "betweenness_und":   g(r"betweenness_und:\s*([\d.Ee+-]+)"),
        "community":         g(r"community:\s*([\d]+)"),
        "community_size":    g(r"community_size:\s*([\d]+)"),
        "selfeating":        g(r"selfeating:\s*(\w+)"),
        "in_giant_foodweb":  str(":GiantFoodweb" in n_str),
    }


def load_csvs_to_sqlite(csv_paths, db_path):
    frames = []
    for path in csv_paths:
        df = pd.read_csv(path)
        df["source_file"] = Path(path).name
        frames.append(df)

    raw = pd.concat(frames, ignore_index=True)
    raw = raw.drop_duplicates(subset=["Predator", "Prey", "URI"])
    print(f"Processing {len(raw)} unique relationships...")

    # Build thumbnail map — first available image for each species
    # CSV Predator col = actual prey, CSV Prey col = actual predator
    thumbnail_map = {}
    for _, row in raw.iterrows():
        r_props = parse_r(row.get("r", ""))
        img = r_props.get("image_url", "")
        if not img:
            continue
        prey_sci = row["Predator"].strip()
        pred_sci = row["Prey"].strip()
        if prey_sci not in thumbnail_map:
            thumbnail_map[prey_sci] = img
        if pred_sci not in thumbnail_map:
            thumbnail_map[pred_sci] = img

    # Build relationships table
    rows = []
    for _, row in raw.iterrows():
        r_props = parse_r(row.get("r", ""))
        n_props = parse_n(row.get("n", ""))
        rows.append({
            "predator_scientific": row["Prey"].strip(),
            "prey_scientific":     row["Predator"].strip(),
            "country":             str(row.get("Country", "")),
            "state":               str(row.get("State", "")),
            "observation_uri":     str(row.get("URI", "")),
            "source_file":         str(row.get("source_file", "")),
            "image_url":           r_props.get("image_url", ""),
            "type_of_feeding":     r_props.get("type_of_feeding", ""),
            "latitude":            r_props.get("latitude", ""),
            "longitude":           r_props.get("longitude", ""),
            "observed_on":         r_props.get("observed_on", ""),
            "place_state":         r_props.get("place_state", ""),
            "place_county":        r_props.get("place_county", ""),
            "place_country":       r_props.get("place_country", ""),
            "captive_cultivated":  r_props.get("captive_cultivated", "false"),
            "prey_agreements":     r_props.get("prey_agreements", ""),
            "predator_agreements": r_props.get("predator_agreements", ""),
            "prey_common_name":    n_props.get("common_name", ""),
            "prey_taxon_class":    n_props.get("iconic_taxon_name", ""),
            "prey_taxon_order":    n_props.get("taxon_order", ""),
            "prey_taxon_family":   n_props.get("taxon_family", ""),
            "prey_trophic_pos":    n_props.get("trophic_pos", ""),
            "prey_totaldegree":    n_props.get("totaldegree", ""),
            "prey_pagerank":       n_props.get("preyPageRank", ""),
            "prey_betweenness":    n_props.get("betweenness_und", ""),
            "prey_community":      n_props.get("community", ""),
            "prey_in_giant_foodweb": n_props.get("in_giant_foodweb", "False"),
        })

    df_clean = pd.DataFrame(rows)
    conn = sqlite3.connect(db_path)
    df_clean.to_sql("feeding_relationships", conn, if_exists="replace", index=False)

    # Build species table — prey species have full node data from n column
    # predator-only species get minimal data + thumbnail from relationship photos
    species_rows = {}
    for _, row in raw.iterrows():
        n_props = parse_n(row.get("n", ""))
        sci = row["Predator"].strip()   # actual prey species
        if sci not in species_rows:
            species_rows[sci] = {
                "scientific_name":  sci,
                "common_name":      n_props.get("common_name", ""),
                "taxon_class":      n_props.get("iconic_taxon_name", ""),
                "taxon_order":      n_props.get("taxon_order", ""),
                "taxon_family":     n_props.get("taxon_family", ""),
                "taxon_kingdom":    n_props.get("taxon_kingdom", ""),
                "trophic_pos":      n_props.get("trophic_pos", ""),
                "totaldegree":      n_props.get("totaldegree", ""),
                "pagerank":         n_props.get("preyPageRank", ""),
                "betweenness":      n_props.get("betweenness_und", ""),
                "community":        n_props.get("community", ""),
                "in_giant_foodweb": n_props.get("in_giant_foodweb", "False"),
                "thumbnail_url":    thumbnail_map.get(sci, ""),
            }

    for sci in raw["Prey"].unique():   # actual predator species
        sci = sci.strip()
        if sci not in species_rows:
            species_rows[sci] = {
                "scientific_name": sci, "common_name": "", "taxon_class": "",
                "taxon_order": "", "taxon_family": "", "taxon_kingdom": "",
                "trophic_pos": "", "totaldegree": "", "pagerank": "",
                "betweenness": "", "community": "", "in_giant_foodweb": "False",
                "thumbnail_url": thumbnail_map.get(sci, ""),
            }

    df_species = pd.DataFrame(list(species_rows.values()))
    df_species.to_sql("species", conn, if_exists="replace", index=False)
    conn.close()

    print(f"✓ Loaded {len(df_clean)} relationships")
    print(f"✓ Built species table with {len(df_species)} entries")
    print(f"✓ Species with thumbnails: {sum(1 for v in species_rows.values() if v['thumbnail_url'])}/{len(species_rows)}")
    return df_clean, df_species


def export_static_json(db_path, output_dir):
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    df_rel = pd.read_sql("SELECT * FROM feeding_relationships", conn)
    df_sp  = pd.read_sql("SELECT * FROM species", conn)

    with open(f"{output_dir}/relationships.json", "w") as f:
        json.dump(df_rel.to_dict(orient="records"), f)

    with open(f"{output_dir}/species.json", "w") as f:
        json.dump(df_sp.to_dict(orient="records"), f)

    # Top 200 by betweenness for Game 4 — include image_url on links
    df_sp["betweenness_float"] = pd.to_numeric(df_sp["betweenness"], errors="coerce").fillna(0)
    top_species = set(df_sp.nlargest(200, "betweenness_float")["scientific_name"])
    filtered = df_rel[
        df_rel["predator_scientific"].isin(top_species) &
        df_rel["prey_scientific"].isin(top_species)
    ]
    network = {
        "nodes": df_sp[df_sp["scientific_name"].isin(top_species)].to_dict(orient="records"),
        "links": filtered[["predator_scientific", "prey_scientific", "type_of_feeding", "image_url"]].to_dict(orient="records"),
    }
    with open(f"{output_dir}/network.json", "w") as f:
        json.dump(network, f)

    conn.close()
    print(f"✓ Static JSON exported to {output_dir}/")
    print(f"  relationships.json: {len(df_rel)} records")
    print(f"  species.json: {len(df_sp)} species")
    print(f"  network.json: {len(network['nodes'])} nodes, {len(network['links'])} links")


if __name__ == "__main__":
    CSV_FILES = [
        "data/nc_species.csv",
        "data/us_species.csv",
    ]
    DB = "who_eats_whom.db"
    load_csvs_to_sqlite(CSV_FILES, DB)
    export_static_json(DB, "static_json")