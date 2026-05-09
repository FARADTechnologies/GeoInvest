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
    
    # Count total valid ads
    cur.execute("""
        SELECT COUNT(*) 
        FROM item_app_items 
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND category_id IN (3, 4)
    """)
    total_ads = cur.fetchone()[0]
    
    # Count ads inside rayons
    cur.execute("""
        SELECT COUNT(DISTINCT i.id)
        FROM item_app_items i
        JOIN index_app_object o ON ST_Contains(o.geom, ST_SetSRID(ST_MakePoint(i.longitude, i.latitude), 4326))
        WHERE i.latitude IS NOT NULL AND i.longitude IS NOT NULL AND i.category_id IN (3, 4)
          AND o.type_id = 23
    """)
    inside_ads = cur.fetchone()[0]
    
    print(f"Total ads: {total_ads}")
    print(f"Ads inside rayons: {inside_ads}")
    print(f"Ads outside rayons: {total_ads - inside_ads}")

    cur.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
