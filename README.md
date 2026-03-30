# Who Eats Whom

An interactive ecological exhibit built for the **Marbles Kids Museum Backwards Science Fair 2026** at NC State University. The project turns the *Who Eats Whom* food web research database into a set of gamified, touch-driven experiences for children.

Built by Bipin Gowda in collaboration with Dr. Bradley Allf and Dr. Aditi Mallavarapu at NC State University.

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

- **Frontend:** Next.js (App Router) + Framer Motion + Tailwind CSS
- **Backend:** FastAPI (Python)
- **Database:** SQLite (local exhibition), Neo4j (full dataset)
- **Touch input:** Pointer Events API — unified across IR frame, iPad, and mouse

---

## Project Structure

```
who-eats-whom/
├── README.md
├── .gitignore
├── backend/
│   ├── main.py              # FastAPI app — all game endpoints
│   ├── parse_csv.py         # CSV parser and SQLite loader
│   ├── requirements.txt     # Python dependencies
│   ├── who_eats_whom.db     # SQLite DB (generated — not committed)
│   ├── data/                # Place CSV files here (not committed)
│   │   ├── nc_species.csv
│   │   └── us_species.csv
│   └── static_json/         # Auto-generated fallback JSON (not committed)
│       ├── relationships.json
│       ├── species.json
│       └── network.json
└── frontend/
    ├── app/
    │   ├── globals.css
    │   ├── layout.tsx
    │   ├── page.tsx          # Redirects to /game1
    │   └── game1/
    │       └── page.tsx      # Game 1 main page
    ├── components/
    │   ├── game1/
    │   │   ├── AnimalShelf.tsx
    │   │   ├── DropZone.tsx
    │   │   ├── PhotoModal.tsx
    │   │   └── NetworkCanvas.tsx
    │   └── ui/
    │       └── AnimalBlob.tsx
    ├── lib/
    │   ├── api.ts            # API client with static fallback
    │   └── types.ts          # Shared TypeScript types
    └── .env.local            # Local environment variables (not committed)
```

---

## Backend Setup

### Prerequisites

- Python 3.10+

### 1. Clone the repo

```bash
git clone https://github.com/your-username/who-eats-whom.git
cd who-eats-whom
```

### 2. Add the data files

The CSV files are not committed. Place them manually inside `backend/data/`:

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

```bash
python3 parse_csv.py
```

You should see:
```
Processing 697 unique relationships...
✓ Loaded 697 relationships
✓ Built species table with 808 entries
✓ Species with thumbnails: 808/808
✓ Static JSON exported to static_json/
```

### 6. Start the backend

```bash
uvicorn main:app --reload --port 8000
```

API is running at `http://localhost:8000`.
Interactive docs at `http://localhost:8000/docs`.

---

## Frontend Setup

### Prerequisites

- Node.js 18+

### 1. Install dependencies

```bash
cd frontend
npm install
```

### 2. Create environment file

```bash
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
```

If running the frontend on a different device than the backend (e.g. iPad accessing a laptop server), replace `localhost` with the laptop's local IP address:

```bash
echo "NEXT_PUBLIC_API_URL=http://192.168.x.x:8000" > .env.local
```

### 3. Start the frontend

```bash
npm run dev
```

App is running at `http://localhost:3000`.

---

## Running Both Together

You need two terminals open:

**Terminal 1 — Backend:**
```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8000
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

Then open `http://localhost:3000`.

---

## API Reference

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Check server and DB status |

### Species

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/species` | List species. Params: `taxon_class`, `state`, `limit` |
| GET | `/species/{scientific_name}` | Get a single species |

### Game 1 — Who Eats Whom?

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/game/who-eats-whom` | Check relationship between two species. Params: `species_a`, `species_b` |

Returns `direction`: `a_eats_b`, `b_eats_a`, `both`, or `none`.

### Game 2 — Snapshot Science

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/game/snapshot` | Find photo evidence among placed species. Param: `species` (comma-separated) |

### Game 3 — Who Ate My Fish?

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/game/who-ate-my-fish` | Get all predators and prey of a focal species. Param: `species` |
| GET | `/game/cascade` | Simulate removing one predator. Params: `remove_species`, `focal_species` |

### Game 4 — Planetary Collapse

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/game/network` | Get the full food web network. Param: `top_n` (default 200) |
| GET | `/game/collapse` | Simulate removing a taxon class. Param: `remove_taxon_class` |
| GET | `/game/taxon-classes` | List all taxon classes |

---

## Postman Test Suite

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

## Exhibition Setup (Museum Day)

1. Run backend on the laptop connected to the TV
2. Find the laptop's local IP: `ip addr` (Linux/WSL) or `ipconfig` (Windows)
3. Update `frontend/.env.local` with that IP
4. Run `npm run build && npm run start` for production mode
5. Open `http://localhost:3000` on the TV browser
6. For iPads, open `http://[laptop-ip]:3000` in Safari

---

## Data Notes

- 697 verified US feeding relationships across 808 species
- Every record includes a real iNaturalist observation photograph
- The CSV column headers `Predator` and `Prey` are inverted from their intuitive meaning — corrected in `parse_csv.py`
- The `n` column in the raw CSV contains Neo4j Cypher-style property strings parsed into clean fields on load

---

## License

MIT