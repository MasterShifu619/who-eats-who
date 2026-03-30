# Who Eats Whom

An interactive ecological exhibit built for the **Marbles Kids Museum Backwards Science Fair 2026** at NC State University. The project turns the *Who Eats Whom* food web research database into a set of gamified, touch-driven experiences for children.

Built by Bipin Gowda and Moksh in collaboration with Dr. Bradley Allf and Dr. Aditi Mallavarapu at NC State University.

---

## What It Is

The *Who Eats Whom* database contains ~13,000 verified feeding records (predation, parasitism, pollination, scavenging) crowdsourced from iNaturalist. Every relationship has a real photograph attached to it. This project makes that data tangible through four interactive mini-games designed for a 55" IR multitouch wall display and iPads.

### The Four Mini-Games

1. **Who Eats Whom?** — Pick two animals and find out if one eats the other, and which direction.
2. **Snapshot Science** — Place animals, predict connections, then see real photographic evidence of a feeding interaction.
3. **Who Ate My Fish?** — Place a fish and watch its predators animate in. Remove one and see the cascade effect.
4. **Planetary Collapse** — Remove an entire category of species and watch cascade effects propagate across the full food web.

---

## Tech Stack

- **Frontend:** Next.js + Framer Motion + Tailwind CSS
- **Backend:** FastAPI (Python)
- **Database:** SQLite (local), Neo4j (full dataset)
- **Touch input:** Pointer Events API (IR frame + iPad + mouse unified)

---

## Project Structure

```
who-eats-whom/
├── backend/
│   ├── main.py              # FastAPI app — all game endpoints
│   ├── parse_csv.py         # CSV parser and SQLite loader
│   ├── requirements.txt     # Python dependencies
│   ├── data/                # Place your CSV files here (see below)
│   │   ├── nc_species.csv
│   │   └── us_species.csv
│   └── static_json/         # Auto-generated fallback JSON (after parse_csv.py)
└── frontend/                # Next.js app (coming soon)
```

---

## Backend Setup

### Prerequisites

- Python 3.10+
- pip

### 1. Clone the repo

```bash
git clone https://github.com/your-username/who-eats-whom.git
cd who-eats-whom
```

### 2. Add the data files

The CSV files are not committed to the repo. Place them manually in `backend/data/`:

```
backend/data/nc_species.csv
backend/data/us_species.csv
```

Contact the project team to obtain the data files.

### 3. Create a virtual environment

**Mac / Linux / WSL:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
```

**Windows (PowerShell):**
```powershell
cd backend
python -m venv venv
venv\Scripts\activate
```

### 4. Install dependencies

```bash
pip install -r requirements.txt
```

### 5. Build the database

This parses the CSV files and loads them into a local SQLite database. It also exports static JSON fallback files.

```bash
python3 parse_csv.py
```

You should see:
```
Processing 697 unique relationships...
✓ Loaded 697 relationships
✓ Built species table with 808 entries
✓ Static JSON exported to static_json/
```

### 6. Start the server

```bash
uvicorn main:app --reload --port 8000
```

The API is now running at `http://localhost:8000`.
Interactive API docs are available at `http://localhost:8000/docs`.

---

## API Reference

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Check server and DB status |

### Species

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/species` | List all species. Optional params: `taxon_class`, `state`, `limit` |
| GET | `/species/{scientific_name}` | Get a single species by scientific name |

### Game 1 — Who Eats Whom?

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/game/who-eats-whom` | Check relationship between two species. Params: `species_a`, `species_b` |

Returns `direction`: `a_eats_b`, `b_eats_a`, `both`, or `none`.

### Game 2 — Snapshot Science

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/game/snapshot` | Find a real photo of a feeding interaction among placed species. Param: `species` (comma-separated) |

### Game 3 — Who Ate My Fish?

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/game/who-ate-my-fish` | Get all predators and prey of a focal species. Param: `species` |
| GET | `/game/cascade` | Simulate removing one predator. Params: `remove_species`, `focal_species` |

### Game 4 — Planetary Collapse

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/game/network` | Get the full food web network (top N species by betweenness). Param: `top_n` (default 200) |
| GET | `/game/collapse` | Simulate removing an entire taxon class. Param: `remove_taxon_class` |
| GET | `/game/taxon-classes` | List all taxon classes available for collapse simulation |

---

## Postman Test Suite

Use these to verify your backend is working correctly after setup:

```
GET localhost:8000/health
GET localhost:8000/species?limit=10
GET localhost:8000/species/Ardea alba
GET localhost:8000/game/who-eats-whom?species_a=Ardea alba&species_b=Ameiurus natalis
GET localhost:8000/game/who-eats-whom?species_a=Homo sapiens&species_b=Ardea alba
GET localhost:8000/game/who-ate-my-fish?species=Ameiurus natalis
GET localhost:8000/game/snapshot?species=Ardea alba,Ameiurus natalis
GET localhost:8000/game/taxon-classes
GET localhost:8000/game/network?top_n=50
GET localhost:8000/game/collapse?remove_taxon_class=Insecta
```

---

## Data Notes

- The dataset contains 697 verified US feeding relationships across 808 species
- Every record includes a real iNaturalist observation photograph
- The CSV column headers `Predator` and `Prey` are inverted from their intuitive meaning — this is corrected in `parse_csv.py`
- The `n` column in the raw CSV contains Neo4j Cypher-style property strings which are parsed into clean fields on load

---

## Contributing

This project is part of active research at NC State University. If you'd like to contribute or have questions about the data, reach out to the project team.

---

## License

MIT