import os
import psycopg2

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
    cur.execute("SELECT DISTINCT type_id FROM index_app_object")
    type_ids = cur.fetchall()
    print(f"Distinct type_ids: {type_ids}")
    
    for tid in type_ids:
        cur.execute(f"SELECT name FROM index_app_object WHERE type_id = {tid[0]} LIMIT 3")
        names = cur.fetchall()
        print(f"Type {tid[0]} examples: {names}")
        
    cur.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
