# ─────────────────────────────────────────────────────────────────────────────
# split_logs_by_game.py
#
# Purpose:
#   Reads a cleaned pipe-delimited log CSV (produced by extract_logs.py) and
#   splits it into separate pipe-delimited CSV files per game. One output file
#   is created per unique game found in the logs, saved in the same `cleaned/`
#   folder as the input file.
#
# Usage:
#   python3 split_logs_by_game.py <cleaned_input_file>
#   Example: python3 split_logs_by_game.py cleaned/logs_clean.csv
#
# Output:
#   cleaned/<game_name>.csv  — one pipe-delimited file per game found
#
# Log format expected (pipe-delimited):
#   timestamp | game | ip | animal | action | state | browser
# ─────────────────────────────────────────────────────────────────────────────

import csv
import os
import sys

# ── Input from command line ───────────────────────────────────────────────────
if len(sys.argv) != 2:
    print("Usage: python3 split_logs_by_game.py <cleaned_input_file>")
    print("Example: python3 split_logs_by_game.py cleaned/logs_clean.csv")
    sys.exit(1)

input_file = sys.argv[1]
output_dir = os.path.dirname(input_file)
# ──────────────────────────────────────────────────────────────────────────────

FIELDS = ["timestamp", "game", "ip", "animal", "action", "state", "browser"]

# Read pipe-delimited cleaned file
parsed = []
with open(input_file, newline='', encoding='utf-8') as f:
    reader = csv.DictReader(f, delimiter="|")
    for row in reader:
        parsed.append(row)

# Group by game
games: dict = {}
for entry in parsed:
    g = entry["game"].strip()
    if g not in games:
        games[g] = []
    games[g].append(entry)

# Write one pipe-delimited CSV per game
print(f"Found {len(games)} game(s): {list(games.keys())}\n")
for game, rows in games.items():
    safe_name = game.strip().replace(" ", "_").replace("/", "_")
    out_path = os.path.join(output_dir, f"{safe_name}.csv")
    with open(out_path, "w", newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS, delimiter="|")
        writer.writeheader()
        writer.writerows(rows)
    print(f"  {game}: {len(rows)} rows -> {out_path}")

print("\nDone.")