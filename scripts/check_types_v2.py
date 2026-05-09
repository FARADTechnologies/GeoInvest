import os
import psycopg2
import sys

# Ensure UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

db_config = {
    "host": os.environ["SOURCE_DB_HOST"],
    "port": os.environ.get("SOURCE_DB_PORT", "5432"),
    "user": os.environ["SOURCE_DB_USER"],
    "password": os.environ["SOURCE_DB_PASSWORD"],
    "dbname": os.environ.get("SOURCE_DB_NAME", "source_dev_db"),
}

try:
    conn = psycopg2.connect(**db_config)
    cur = conn.cursor()
    
    cur.execute("SELECT name FROM index_app_object WHERE type_id = 23 LIMIT 5")
    names = cur.fetchall()
    print(f"Type 23 examples: {names}")
    
    cur.execute("SELECT name FROM index_app_object WHERE type_id = 22 LIMIT 5")
    names_22 = cur.fetchall()
    print(f"Type 22 examples: {names_22}")

    cur.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
