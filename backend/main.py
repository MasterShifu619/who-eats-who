"""
Who Eats Whom — FastAPI Backend
Serves all four mini-games from a local SQLite database.
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import sqlite3
import pandas as pd
import random
from pathlib import Path
from typing import Optional

app = FastAPI(title="Who Eats Whom API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten this in production
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = Path(__file__).parent / "who_eats_whom.db"


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def rows_to_list(rows):
    return [dict(r) for r in rows]


# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "db": str(DB_PATH)}


# ── Species endpoints ─────────────────────────────────────────────────────────

@app.get("/species")
def list_species(
    taxon_class: Optional[str] = None,
    state: Optional[str] = None,
    limit: int = Query(default=100, le=500),
):
    """
    List all species. Optionally filter by taxon class or state.
    Used to populate the species shelf in all four games.
    """
    conn = get_conn()

    if state:
        # Species that appear in relationships from a specific state
        query = """
            SELECT DISTINCT s.*
            FROM species s
            JOIN feeding_relationships f
              ON s.scientific_name = f.predator_scientific
              OR s.scientific_name = f.prey_scientific
            WHERE f.place_state = ?
            LIMIT ?
        """
        rows = conn.execute(query, (state, limit)).fetchall()
    elif taxon_class:
        rows = conn.execute(
            "SELECT scientific_name, common_name, taxon_class, taxon_order, taxon_family, taxon_kingdom, trophic_pos, totaldegree, pagerank, betweenness, community, in_giant_foodweb, thumbnail_url FROM species WHERE taxon_class = ? LIMIT ?",
            (taxon_class, limit)
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT scientific_name, common_name, taxon_class, taxon_order, taxon_family, taxon_kingdom, trophic_pos, totaldegree, pagerank, betweenness, community, in_giant_foodweb, thumbnail_url FROM species ORDER BY common_name LIMIT ?",
            (limit,)
        ).fetchall()

    conn.close()
    return rows_to_list(rows)


@app.get("/species/{scientific_name}")
def get_species(scientific_name: str):
    """Get a single species by scientific name."""
    conn = get_conn()
    row = conn.execute(
        "SELECT scientific_name, common_name, taxon_class, taxon_order, taxon_family, taxon_kingdom, trophic_pos, totaldegree, pagerank, betweenness, community, in_giant_foodweb, thumbnail_url FROM species WHERE scientific_name = ?",
        (scientific_name,)
    ).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Species not found")
    return dict(row)


# ── Game 1: "Who Eats Whom?" ──────────────────────────────────────────────────

@app.get("/game/who-eats-whom")
def who_eats_whom(species_a: str, species_b: str):
    """
    Check if a feeding relationship exists between two species.
    Returns direction: a_eats_b, b_eats_a, both, or none.
    Also returns the photo evidence if a relationship exists.
    """
    conn = get_conn()

    a_eats_b = conn.execute("""
        SELECT predator_scientific, prey_scientific,
               image_url, type_of_feeding, observation_url,
               observed_on, place_state, prey_common_name
        FROM feeding_relationships
        WHERE predator_scientific = ? AND prey_scientific = ?
        LIMIT 1
    """, (species_a, species_b)).fetchone()

    b_eats_a = conn.execute("""
        SELECT predator_scientific, prey_scientific,
               image_url, type_of_feeding, observation_url,
               observed_on, place_state, prey_common_name
        FROM feeding_relationships
        WHERE predator_scientific = ? AND prey_scientific = ?
        LIMIT 1
    """, (species_b, species_a)).fetchone()

    conn.close()

    if a_eats_b and b_eats_a:
        direction = "both"
    elif a_eats_b:
        direction = "a_eats_b"
    elif b_eats_a:
        direction = "b_eats_a"
    else:
        direction = "none"

    return {
        "species_a": species_a,
        "species_b": species_b,
        "direction": direction,
        "relationship_a_eats_b": dict(a_eats_b) if a_eats_b else None,
        "relationship_b_eats_a": dict(b_eats_a) if b_eats_a else None,
    }


# ── Game 2: "Snapshot Science" ────────────────────────────────────────────────

@app.get("/game/snapshot")
def snapshot_science(species: str = Query(..., description="Comma-separated scientific names, up to 5")):
    """
    Given a list of species on the canvas, find real photograph evidence
    of a feeding interaction between any pair of them.
    Returns the photo, the relationship, and the two species involved.
    """
    species_list = [s.strip() for s in species.split(",") if s.strip()]
    if len(species_list) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 species")

    conn = get_conn()

    # Find any verified relationship between the provided species that has a photo
    placeholders = ",".join("?" * len(species_list))
    rows = conn.execute(f"""
        SELECT predator_scientific, prey_scientific,
               image_url, type_of_feeding, observation_url,
               observed_on, place_state, place_county,
               prey_common_name, prey_taxon_class
        FROM feeding_relationships
        WHERE predator_scientific IN ({placeholders})
          AND prey_scientific IN ({placeholders})
          AND image_url != ''
        ORDER BY RANDOM()
        LIMIT 5
    """, species_list + species_list).fetchall()

    conn.close()

    if not rows:
        return {
            "found": False,
            "message": "No documented relationship found between these species",
            "snapshot": None,
        }

    # Return one at random for variety
    chosen = dict(random.choice(rows))
    return {
        "found": True,
        "snapshot": chosen,
        "question": f"Did you expect {chosen['predator_scientific']} to eat {chosen['prey_scientific']}?",
    }


# ── Game 3: "Who Ate My Fish?" ────────────────────────────────────────────────

@app.get("/game/who-ate-my-fish")
def who_ate_my_fish(species: str):
    """
    Given a focal species, return all its predators and prey (1st degree).
    Used to animate the 'echo' of connections lighting up around the species.
    """
    conn = get_conn()

    predators = conn.execute("""
        SELECT f.predator_scientific,
               s.common_name        AS predator_common_name,
               s.taxon_class        AS predator_taxon_class,
               s.trophic_pos        AS predator_trophic_pos,
               f.image_url,
               f.type_of_feeding,
               f.observation_url,
               f.observed_on,
               f.place_state
        FROM feeding_relationships f
        LEFT JOIN species s ON s.scientific_name = f.predator_scientific
        WHERE f.prey_scientific = ?
          AND f.image_url != ''
    """, (species,)).fetchall()

    prey = conn.execute("""
        SELECT f.prey_scientific,
               f.prey_common_name,
               f.prey_taxon_class,
               f.prey_trophic_pos,
               f.image_url,
               f.type_of_feeding,
               f.observation_url,
               f.observed_on,
               f.place_state
        FROM feeding_relationships f
        WHERE f.predator_scientific = ?
          AND f.image_url != ''
    """, (species,)).fetchall()

    # Get species info for the focal species
    focal = conn.execute(
        "SELECT scientific_name, common_name, taxon_class, taxon_order, taxon_family, taxon_kingdom, trophic_pos, totaldegree, pagerank, betweenness, community, in_giant_foodweb, thumbnail_url FROM species WHERE scientific_name = ?", (species,)
    ).fetchone()

    conn.close()

    if not focal:
        raise HTTPException(status_code=404, detail="Species not found")

    predator_list = rows_to_list(predators)
    prey_list = rows_to_list(prey)

    # Cascade hint: what happens if all predators disappear?
    cascade_question = None
    if predator_list:
        predator_names = ", ".join(
            p.get("predator_common_name") or p["predator_scientific"]
            for p in predator_list[:3]
        )
        focal_name = dict(focal).get("common_name") or species
        cascade_question = (
            f"What would happen to the {focal_name} population "
            f"if {predator_names} disappeared?"
        )

    return {
        "focal_species": dict(focal),
        "predators": predator_list,
        "prey": prey_list,
        "predator_count": len(predator_list),
        "prey_count": len(prey_list),
        "cascade_question": cascade_question,
    }


@app.get("/game/cascade")
def cascade_removal(remove_species: str, focal_species: str):
    """
    Simulate removing one predator and show what connections remain for the focal species.
    Returns the updated predator list after removal for real-time cascade animation.
    """
    conn = get_conn()

    remaining_predators = conn.execute("""
        SELECT f.predator_scientific,
               s.common_name AS predator_common_name,
               s.taxon_class AS predator_taxon_class,
               f.image_url
        FROM feeding_relationships f
        LEFT JOIN species s ON s.scientific_name = f.predator_scientific
        WHERE f.prey_scientific = ?
          AND f.predator_scientific != ?
    """, (focal_species, remove_species)).fetchall()

    conn.close()

    return {
        "focal_species": focal_species,
        "removed_predator": remove_species,
        "remaining_predators": rows_to_list(remaining_predators),
        "remaining_count": len(remaining_predators),
        "population_effect": "increasing" if remaining_predators else "uncontrolled",
    }


# ── Game 4: "Planetary Collapse" ──────────────────────────────────────────────

@app.get("/game/network")
def get_network(top_n: int = Query(default=200, le=300)):
    """
    Return the full food web network for the Planetary Collapse game.
    Returns nodes (species) and links (feeding relationships) for the top N
    most-connected species by betweenness centrality.
    """
    conn = get_conn()

    nodes = conn.execute(f"""
        SELECT scientific_name, common_name, taxon_class, taxon_kingdom,
               trophic_pos, totaldegree, betweenness, pagerank, community, thumbnail_url
        FROM species
        WHERE betweenness != '' AND betweenness IS NOT NULL
        ORDER BY CAST(betweenness AS REAL) DESC
        LIMIT ?
    """, (top_n,)).fetchall()

    node_names = {r["scientific_name"] for r in nodes}
    placeholders = ",".join("?" * len(node_names))
    node_list = list(node_names)

    links = conn.execute(f"""
        SELECT predator_scientific, prey_scientific,
               type_of_feeding, image_url
        FROM feeding_relationships
        WHERE predator_scientific IN ({placeholders})
          AND prey_scientific IN ({placeholders})
    """, node_list + node_list).fetchall()

    conn.close()

    return {
        "nodes": rows_to_list(nodes),
        "links": rows_to_list(links),
        "node_count": len(nodes),
        "link_count": len(links),
    }


@app.get("/game/collapse")
def collapse_category(remove_taxon_class: str):
    """
    Simulate removing an entire taxon class (e.g. all Insecta, all Plantae).
    Returns which species lose all their predators or prey as a result —
    the cascade effect.
    """
    conn = get_conn()

    # Species in the removed category
    removed = conn.execute(
        "SELECT scientific_name FROM species WHERE taxon_class = ?",
        (remove_taxon_class,)
    ).fetchall()
    removed_names = {r["scientific_name"] for r in removed}

    if not removed_names:
        raise HTTPException(status_code=404, detail=f"No species found for taxon class: {remove_taxon_class}")

    placeholders = ",".join("?" * len(removed_names))
    removed_list = list(removed_names)

    # Which prey species lose ALL their predators?
    all_prey = conn.execute(f"""
        SELECT DISTINCT prey_scientific FROM feeding_relationships
        WHERE predator_scientific IN ({placeholders})
    """, removed_list).fetchall()

    cascade_affected = []
    for prey_row in all_prey:
        prey = prey_row["prey_scientific"]
        if prey in removed_names:
            continue
        # Does this prey have any remaining predator outside the removed class?
        remaining = conn.execute(f"""
            SELECT COUNT(*) as cnt FROM feeding_relationships
            WHERE prey_scientific = ?
              AND predator_scientific NOT IN ({placeholders})
        """, [prey] + removed_list).fetchone()
        if remaining["cnt"] == 0:
            cascade_affected.append(prey)

    conn.close()

    return {
        "removed_taxon_class": remove_taxon_class,
        "removed_species_count": len(removed_names),
        "cascade_affected_species": cascade_affected,
        "cascade_count": len(cascade_affected),
        "message": (
            f"Removing all {remove_taxon_class} causes "
            f"{len(cascade_affected)} other species to lose all their predators."
        ),
    }


@app.get("/game/taxon-classes")
def list_taxon_classes():
    """List all taxon classes available for Game 4 collapse simulation."""
    conn = get_conn()
    rows = conn.execute("""
        SELECT taxon_class, COUNT(*) as species_count
        FROM species
        WHERE taxon_class != ''
        GROUP BY taxon_class
        ORDER BY species_count DESC
    """).fetchall()
    conn.close()
    return rows_to_list(rows)


# ── Game 3: Who Eats Whom ───────────────────────────────────────────────────────

@app.get("/game/foodweb/nc")
def get_nc_foodweb():
    """
    Returns the NC food web as nodes + edges for the collapse game.
    Edges represent: prey → predator (energy flow direction).
    """
    conn = get_conn()

    rows = conn.execute("SELECT prey, predator FROM foodweb_nc").fetchall()
    conn.close()

    # Build node list
    species_set = set()
    edges = []
    for r in rows:
        d = dict(r)
        species_set.add(d["prey"])
        species_set.add(d["predator"])
        edges.append({"prey": d["prey"], "predator": d["predator"]})

    # Trophic level assignment
    TROPHIC = {
        "Fruit":      "producer",
        "Worm":       "primary",
        "Butterfly":  "primary",
        "Beetle":     "primary",
        "Grasshopper":"primary",
        "Ant":        "primary",
        "Crab":       "primary",
        "Dragonfly":  "secondary",
        "Spider":     "secondary",
        "Fish":       "secondary",
        "Frog":       "secondary",
        "Rat":        "secondary",
        "Snake":      "tertiary",
        "Lizard":     "tertiary",
        "Blue Heron": "apex",
    }

    EMOJI = {
        "Fruit": "🍊", "Worm": "🪱", "Butterfly": "🦋",
        "Beetle": "🪲", "Grasshopper": "🦗", "Ant": "🐜",
        "Crab": "🦀", "Dragonfly": "🪰", "Spider": "🕷️",
        "Fish": "🐟", "Frog": "🐸", "Rat": "🐀",
        "Snake": "🐍", "Lizard": "🦎", "Blue Heron": "🦤",
    }

    nodes = [
        {
            "id": sp,
            "label": sp,
            "emoji": EMOJI.get(sp, "❓"),
            "trophic": TROPHIC.get(sp, "unknown"),
        }
        for sp in sorted(species_set)
    ]

    return {"nodes": nodes, "edges": edges}


@app.get("/game/foodweb/nc/cascade")
def get_cascade(removed: str):
    """
    Given a removed species, return what cascades.
    Returns species that lose ALL predators (population explodes)
    and species that lose ALL prey (may starve).
    """
    removed_set = set(removed.split(","))
    conn = get_conn()
    rows = conn.execute("SELECT prey, predator FROM foodweb_nc").fetchall()
    conn.close()

    edges = [dict(r) for r in rows]

    # Remove all edges involving the deleted species
    remaining = [e for e in edges if e["prey"] not in removed_set and e["predator"] not in removed_set]

    # Which prey species had ALL their predators removed?
    all_predators = {}
    for e in edges:
        all_predators.setdefault(e["prey"], set()).add(e["predator"])

    remaining_predators = {}
    for e in remaining:
        remaining_predators.setdefault(e["prey"], set()).add(e["predator"])

    exploding = []  # lost all predators — population unchecked
    for prey, preds in all_predators.items():
        if prey == removed:
            continue
        if removed_set & preds and not remaining_predators.get(prey):
            exploding.append(prey)

    # Which predator species had ALL their prey removed?
    all_prey = {}
    for e in edges:
        all_prey.setdefault(e["predator"], set()).add(e["prey"])

    remaining_prey = {}
    for e in remaining:
        remaining_prey.setdefault(e["predator"], set()).add(e["prey"])

    starving = []
    for pred, preys in all_prey.items():
        if pred == removed:
            continue
        if not remaining_prey.get(pred):
            starving.append(pred)

    return {
        "removed": removed,
        "exploding": exploding,   # population boom
        "starving": starving,     # may go extinct
        "edges_remaining": len(remaining),
        "edges_removed": len(edges) - len(remaining),
    }


def init_db():
    conn = get_conn()
    conn.execute('''CREATE TABLE IF NOT EXISTS foodweb_nc (
        prey TEXT NOT NULL, predator TEXT NOT NULL, PRIMARY KEY (prey, predator))''')
    data = [
        ('Fruit','Grasshopper'),('Fruit','Butterfly'),('Fruit','Worm'),('Fruit','Ant'),('Fruit','Rat'),
        ('Worm','Frog'),('Worm','Snake'),('Worm','Fish'),('Worm','Blue Heron'),
        ('Butterfly','Dragonfly'),('Butterfly','Spider'),('Butterfly','Frog'),('Butterfly','Lizard'),
        ('Beetle','Frog'),('Beetle','Spider'),('Beetle','Rat'),
        ('Grasshopper','Dragonfly'),('Grasshopper','Frog'),('Grasshopper','Snake'),
        ('Grasshopper','Lizard'),('Grasshopper','Blue Heron'),
        ('Dragonfly','Frog'),('Dragonfly','Fish'),('Dragonfly','Spider'),('Dragonfly','Lizard'),
        ('Ant','Frog'),('Ant','Spider'),('Ant','Lizard'),
        ('Spider','Frog'),('Spider','Snake'),('Spider','Lizard'),
        ('Crab','Blue Heron'),('Crab','Fish'),('Crab','Snake'),
        ('Fish','Blue Heron'),('Fish','Snake'),('Fish','Lizard'),
        ('Frog','Snake'),('Frog','Blue Heron'),('Frog','Lizard'),
        ('Rat','Snake'),('Rat','Blue Heron'),('Rat','Lizard'),
        ('Fruit', 'Beetle'),('Worm', 'Crab'),('Fish', 'Crab'),
        ('Snake','Blue Heron'),('Lizard','Blue Heron'),('Lizard','Snake'),
    ]
    conn.executemany('INSERT OR IGNORE INTO foodweb_nc (prey, predator) VALUES (?, ?)', data)
    conn.commit()
    conn.close()

init_db()
