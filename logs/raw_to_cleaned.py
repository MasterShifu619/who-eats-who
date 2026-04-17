# ─────────────────────────────────────────────────────────────────────────────
# extract_logs.py
#
# Purpose:
#   Takes raw Loki/Grafana log export files (CSV format) from the
#   "Who Eats Whom" museum exhibit and extracts only the log line column (Line),
#   parsing it into named columns and saving as a pipe-delimited (|) CSV
#   for downstream analysis.
#
# Usage:
#   python3 extract_logs.py <input_file> <output_file>
#   Example: python3 extract_logs.py Logs-A-data.csv logs_clean.csv
#
# Notes:
#   - Raw files are read from the `raw/` folder
#   - Cleaned files are saved to the `cleaned/` folder
#   - Output is pipe-delimited (|) to avoid conflicts with commas in browser strings
#   - All extracted rows are printed to console for verification
# ─────────────────────────────────────────────────────────────────────────────

import csv
import os
import sys

# ── File names from command line arguments ────────────────────────────────────
if len(sys.argv) != 3:
    print("Usage: python3 extract_logs.py <input_file> <output_file>")
    print("Example: python3 extract_logs.py Logs-A-data.csv logs_clean.csv")
    sys.exit(1)

input_file  = sys.argv[1]
output_file = sys.argv[2]
# ──────────────────────────────────────────────────────────────────────────────

RAW_DIR     = "raw"
CLEANED_DIR = "cleaned"

os.makedirs(RAW_DIR, exist_ok=True)
os.makedirs(CLEANED_DIR, exist_ok=True)

raw_path     = os.path.join(RAW_DIR, input_file)
cleaned_path = os.path.join(CLEANED_DIR, output_file)

FIELDS = ["timestamp", "game", "ip", "animal", "action", "state", "browser"]

# Parse each log line into named columns
rows = []
with open(raw_path, newline='', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        line = row["Line"].strip()
        parts = [p.strip() for p in line.split("|", maxsplit=6)]
        if len(parts) < 6:
            continue  # skip malformed lines
        rows.append({
            "timestamp": parts[0],
            "game":      parts[1],
            "ip":        parts[2],
            "animal":    parts[3],
            "action":    parts[4],
            "state":     parts[5],
            "browser":   parts[6] if len(parts) > 6 else "",
        })

# Print for verification
print(f"Total rows extracted: {len(rows)}\n")
for r in rows:
    print(" | ".join(r.values()))

# Save as pipe-delimited file
with open(cleaned_path, "w", newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=FIELDS, delimiter="|")
    writer.writeheader()
    writer.writerows(rows)

print(f"\nCleaned file saved to: {cleaned_path}")