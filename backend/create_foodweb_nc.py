"""
Run this once to create the foodweb_nc table in your SQLite database.
Usage: python create_foodweb_nc.py
Run from the backend/ directory.
"""

import sqlite3
import os

DB = os.path.join(os.path.dirname(__file__), "who_eats_whom.db")
conn = sqlite3.connect(DB)

conn.execute("DROP TABLE IF EXISTS foodweb_nc")
conn.execute("""
    CREATE TABLE foodweb_nc (
        prey TEXT NOT NULL,
        predator TEXT NOT NULL,
        PRIMARY KEY (prey, predator)
    )
""")

data = [
    ("Fruit", "Grasshopper"), ("Fruit", "Butterfly"), ("Fruit", "Worm"),
    ("Fruit", "Ant"), ("Fruit", "Rat"),
    ("Worm", "Frog"), ("Worm", "Snake"), ("Worm", "Fish"), ("Worm", "Blue Heron"),
    ("Butterfly", "Dragonfly"), ("Butterfly", "Spider"), ("Butterfly", "Frog"), ("Butterfly", "Lizard"),
    ("Beetle", "Frog"), ("Beetle", "Spider"), ("Beetle", "Rat"),
    ("Grasshopper", "Dragonfly"), ("Grasshopper", "Frog"), ("Grasshopper", "Snake"),
    ("Grasshopper", "Lizard"), ("Grasshopper", "Blue Heron"),
    ("Dragonfly", "Frog"), ("Dragonfly", "Fish"), ("Dragonfly", "Spider"), ("Dragonfly", "Lizard"),
    ("Ant", "Frog"), ("Ant", "Spider"), ("Ant", "Lizard"),
    ("Spider", "Frog"), ("Spider", "Snake"), ("Spider", "Lizard"),
    ("Crab", "Blue Heron"), ("Crab", "Fish"), ("Crab", "Snake"),
    ("Fish", "Blue Heron"), ("Fish", "Snake"), ("Fish", "Lizard"),
    ("Frog", "Snake"), ("Frog", "Blue Heron"), ("Frog", "Lizard"),
    ("Rat", "Snake"), ("Rat", "Blue Heron"), ("Rat", "Lizard"),
    ("Snake", "Blue Heron"),
    ("Lizard", "Blue Heron"), ("Lizard", "Snake"),
]

conn.executemany("INSERT INTO foodweb_nc (prey, predator) VALUES (?, ?)", data)
conn.commit()

count = conn.execute("SELECT COUNT(*) FROM foodweb_nc").fetchone()[0]
print(f"✓ foodweb_nc created with {count} relationships across 15 species")
conn.close()