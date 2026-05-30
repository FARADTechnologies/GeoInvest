import psycopg2
import csv
import sys
import os

sys.stdout.reconfigure(encoding='utf-8')

TARGET_CATEGORIES = (3, 4)
OUTPUT_FILE = "data/market_stats.csv"


def get_connection():
    return psycopg2.connect(
        host=os.environ["SOURCE_DB_HOST"],
        port=os.environ.get("SOURCE_DB_PORT", "5432"),
        user=os.environ["SOURCE_DB_USER"],
        password=os.environ["SOURCE_DB_PASSWORD"],
        dbname=os.environ.get("SOURCE_DB_NAME", "source_dev_db"),
    )


def fetch_market_stats(cur) -> list[tuple]:
    """
    Per (period, category): true median of owner_price/size from raw listings.
    'ALL' row = both categories combined.
    """
    cur.execute(f"""
        WITH base AS (
            SELECT
                c.name                                  AS cat,
                TO_CHAR(i.created_date, 'YYYY-MM')     AS period,
                i.owner_price / NULLIF(i.size, 0)      AS price_kvm
            FROM item_app_items_excel i
            LEFT JOIN item_app_itemcategory c ON i.category_id = c.id
            WHERE i.owner_price IS NOT NULL
              AND i.size > 0
              AND i.latitude  IS NOT NULL
              AND i.longitude IS NOT NULL
              AND i.category_id IN {TARGET_CATEGORIES}
        )
        SELECT cat, period,
               PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_kvm) AS true_median_price_kvm,
               COUNT(*) AS total_ad_count
        FROM base
        GROUP BY 1, 2

        UNION ALL

        SELECT 'ALL', period,
               PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_kvm),
               COUNT(*)
        FROM base
        GROUP BY 2

        ORDER BY period DESC, cat;
    """)
    return cur.fetchall()


def save_csv(data: list[tuple]):
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    headers = ['category', 'period', 'true_median_price_kvm', 'total_ad_count']
    with open(OUTPUT_FILE, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        writer.writerows(data)
    print(f"Saved {len(data)} rows to {OUTPUT_FILE}")


if __name__ == "__main__":
    print("--- Market Stats Export Starting ---")
    conn = get_connection()
    cur = conn.cursor()
    data = fetch_market_stats(cur)
    cur.close()
    conn.close()
    save_csv(data)
    print("--- Done ---")
