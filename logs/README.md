# Who Eats Whom — Log Analysis Pipeline

This folder contains scripts to process raw log exports from the **Who Eats Whom** museum exhibit (Marbles Kids Museum Backwards Science Fair, April 11, 2026) and run analysis on player behavior.

---

## Folder Structure

```
logs/
├── raw/                        # Place raw Grafana/Loki CSV exports here
├── cleaned/                    # Cleaned and split CSVs are saved here
├── extract_logs.py             # Step 1: Extract log lines from raw CSV
├── split_logs_by_game.py       # Step 2: Split cleaned logs by game
├── analyze_lizard_game.py      # Step 3: Run analysis on lizard game logs
└── README.md                   # This file
```

---

## Prerequisites

Make sure you have Python 3 installed. Then install the required library:

```bash
pip install openpyxl
```

---

## Step 1 — Export logs from Grafana/Loki

1. Open Grafana and navigate to the Loki logs explorer
2. Set the time range to cover the event (April 11, 2026)
3. Filter by the `who-eats-whom` job or service label
4. Click **Download** and select **CSV** format
5. Place the downloaded CSV file inside the `raw/` folder

> **Note:** Grafana CSV exports are limited to 1000 rows. If you have more logs, export in multiple time-range chunks and process each file separately.

---

## Step 2 — Extract and clean the raw CSV

The raw Grafana CSV contains many columns. This step extracts only the log line column and parses it into named fields, saving a pipe-delimited (`|`) cleaned file.

```bash
python3 extract_logs.py <raw_filename> <cleaned_filename>
```

**Example:**
```bash
python3 extract_logs.py Logs-A-data-2026-04-11.csv logs_clean.csv
```

- Input is read from `raw/<raw_filename>`
- Output is saved to `cleaned/<cleaned_filename>`
- All extracted rows are printed to console for verification

**Output columns (pipe-delimited):**
```
timestamp | game | ip | animal | action | state | browser
```

---

## Step 3 — Split cleaned logs by game

This step reads the cleaned file and creates one CSV per game found in the logs. Each game's logs are saved as a separate file in the `cleaned/` folder.

```bash
python3 split_logs_by_game.py cleaned/<cleaned_filename>
```

**Example:**
```bash
python3 split_logs_by_game.py cleaned/logs_clean.csv
```

**Output files (in `cleaned/`):**
- `who-eats-whom.csv` — Food web game (Game 3)
- `feed_the_lizard.csv` — Lizard feeding game (Game 2)

---

## Step 4 — Run analysis on a game

Currently analysis is available for the lizard game. Pass the split game file as input.

```bash
python3 analyze_lizard_game.py cleaned/<game_file>
```

**Example:**
```bash
python3 analyze_lizard_game.py cleaned/feed_the_lizard.csv
```

**Output:**
- Console printout of overall and per-session stats
- `cleaned/lizard_analysis.xlsx` — Excel file with Overall and Per Session sheets

---

## Log Format Reference

Each log line follows this pipe-delimited format:

```
TIMESTAMP | GAME | IP | ANIMAL | ACTION | STATE | BROWSER
```

| Field     | Description |
|-----------|-------------|
| timestamp | UTC timestamp of the event |
| game      | `who-eats-whom` or `feed the lizard` |
| ip        | Client IP address |
| animal    | Species name or `SESSION` |
| action    | `STARTED`, `ADDED`, `DELETED`, `DELETED_CASCADE`, `DRAGGED` |
| state     | `0` = game3 event, `1` = correct drag, `2` = incorrect drag |
| browser   | Browser user-agent string |

---

## Key Assumptions

See the top of `analyze_lizard_game.py` for full documentation of all analysis assumptions including session splitting logic, duration calculation, timezone conversion, and device separation handling.

---

## Games

| Game | Log value | Description |
|------|-----------|-------------|
| Who Eats Whom | `who-eats-whom` | Interactive NC food web — drag animals, trigger cascades |
| Feed the Lizard | `feed the lizard` | Drag correct prey into a Green Anole lizard's mouth |