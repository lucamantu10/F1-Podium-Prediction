import sqlite3
from pathlib import Path
import pandas as pd

BASE_DIR = Path(__file__).resolve().parents[2]
DB_PATH = BASE_DIR / "data" / "database" / "f1.db"

DB_PATH.parent.mkdir(parents=True, exist_ok=True)


def save_to_db(df):
    print("Saving to DB at:", DB_PATH)

    conn = sqlite3.connect(DB_PATH)
    df.to_sql("f1_data", conn, if_exists="replace", index=False)
    conn.close()

    print("Saved successfully")


def load_from_db():
    conn = sqlite3.connect(DB_PATH)
    df = pd.read_sql("SELECT * FROM f1_data", conn)
    conn.close()
    return df