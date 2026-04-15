# Who Eats Whom

An interactive ecological exhibit built for the **Marbles Kids Museum Backwards Science Fair 2026** at NC State University. The project turns the *Who Eats Whom* food web research database into a set of gamified, touch-driven experiences for children.

Built by Bipin Gowda in collaboration with Dr. Bradley Allf and Dr. Aditi Mallavarapu at NC State University.

---

## What It Is

The *Who Eats Whom* database contains ~13,000 verified feeding records (predation, parasitism, pollination, scavenging) crowdsourced from iNaturalist. Every relationship has a real photograph attached to it. This project makes that data tangible through three interactive mini-games designed for a 55" IR multitouch wall display and iPads.

### The Three Mini-Games

1. **Who Eats Whom?** (`/game1`) — Drag two animals into drop zones and find out if one eats the other. Shows real iNaturalist photo evidence and builds a live food web visualization as you explore more pairs.

2. **Feed the Animal** (`/game2`) — Floating animal bubbles drift across the screen. Drag them into the predator's mouth (Blue Heron or Lizard variant at `/game2/lizard`). Correct prey is swallowed with a chomp; wrong choices get spat out. Score by finding all real prey.

3. **Food Web Collapse** (`/game3`) — Build a North Carolina food web by dragging species from a trophic shelf onto the canvas. Then remove a species and watch cascade effects animate in real time: some populations explode (lost all predators), others starve (lost all prey).

---

## Tech Stack

- **Frontend:** Next.js (App Router) + Framer Motion + Tailwind CSS
- **Backend:** FastAPI (Python)
- **Database:** SQLite (local exhibition)
- **Touch input:** Pointer Events API — unified across IR frame, iPad, and mouse

---

## Project Structure

```
who-eats-who/
├── README.md
├── .gitignore
├── docker-compose.yml
├── assets/                  # Source SVG assets
├── backend/
│   ├── main.py              # FastAPI app — all game endpoints
│   ├── create_foodweb_nc.py # NC food web data loader
│   ├── requirements.txt     # Python dependencies
│   ├── Dockerfile
│   └── who_eats_whom.db     # SQLite DB (generated — not committed)
└── frontend/
    ├── app/
    │   ├── globals.css
    │   ├── layout.tsx
    │   ├── page.tsx          # Redirects to /game1
    │   ├── api/log/          # Server-side event logging
    │   ├── game1/
    │   │   └── page.tsx      # Who Eats Whom?
    │   ├── game2/
    │   │   ├── page.tsx      # Feed the Heron
    │   │   └── lizard/
    │   │       └── page.tsx  # Feed the Lizard (variant)
    │   └── game3/
    │       └── page.tsx      # Food Web Collapse
    ├── components/
    │   ├── game1/
    │   │   ├── AnimalShelf.tsx
    │   │   ├── DropZone.tsx
    │   │   ├── PhotoModal.tsx
    │   │   └── NetworkCanvas.tsx
    │   ├── game2/
    │   │   ├── FloatingBubble.tsx
    │   │   ├── HeronFace.tsx
    │   │   ├── LizardFace.tsx
    │   │   └── RoomBubble.tsx
    │   ├── game3/
    │   │   └── Tutorial.tsx
    │   └── ui/
    │       └── AnimalBlob.tsx
    ├── lib/
    │   ├── api.ts            # API client
    │   ├── sounds.ts         # Sound effects and background music
    │   └── types.ts          # Shared TypeScript types
    ├── public/               # SVG animal images
    ├── Dockerfile
    └── .env.local            # Local environment variables (not committed)
```

---

## Backend Setup

### Prerequisites

- Python 3.10+

### 1. Clone the repo

```bash
git clone https://github.com/your-username/who-eats-who.git
cd who-eats-who
```

### 2. Create a virtual environment

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

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Build the database

```bash
python3 create_foodweb_nc.py
```

### 5. Start the backend

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

## Docker (Alternative)

```bash
docker-compose up --build
```

Frontend at `http://localhost:3000`, backend at `http://localhost:8000`.

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

### Game 2 — Feed the Animal

Game 2 is fully client-side — it uses a hardcoded NC species list and plays back local SVG assets. No backend calls are made during gameplay.

### Game 3 — Food Web Collapse

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/game/foodweb/nc` | Get NC food web nodes and edges |
| GET | `/game/foodweb/nc/cascade` | Simulate removing one or more species. Param: `removed` (comma-separated) |

---

## Exhibition Setup (Museum Day)

1. Run backend on the laptop connected to the TV
2. Find the laptop's local IP: `ip addr` (Linux/WSL) or `ipconfig` (Windows)
3. Update `frontend/.env.local` with that IP
4. Run `npm run build && npm run start` for production mode
5. Open `http://localhost:3000` on the TV browser
6. For iPads, open `http://[laptop-ip]:3000` in Safari

---

## License

MIT
