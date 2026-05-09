import psycopg2
import sys

# Ensure UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

def export_raw_data():
    """
    Exports the entire item_app_items table to a CSV file.
    Uses PostgreSQL COPY command for fast and exact extraction.
    """
    db_config = {
        "host": os.environ["SOURCE_DB_HOST"],
        "port": os.environ.get("SOURCE_DB_PORT", "5432"),
        "user": os.environ["SOURCE_DB_USER"],
        "password": os.environ["SOURCE_DB_PASSWORD"],
        "dbname": os.environ.get("SOURCE_DB_NAME", "source_dev_db"),
    }

    try:
        print("Veritabanına bağlanılıyor...")
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor()
        
        output_file = "data/raw_data_template.csv"
        print(f"Ham veriler (raw data) {output_file} dosyasına kopyalanıyor...")
        
        # PostgreSQL COPY TO STDOUT is the safest and fastest way to export raw data exactly as it is to a CSV
        sql_copy_query = "COPY item_app_items TO STDOUT WITH CSV HEADER"
        
        with open(output_file, 'w', encoding='utf-8') as f:
            cur.copy_expert(sql_copy_query, f)
            
        print(f"İşlem başarılı! Tüm ilan verileri {output_file} dosyasına kaydedildi.")
        
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"Hata oluştu: {e}")

if __name__ == "__main__":
    export_raw_data()
