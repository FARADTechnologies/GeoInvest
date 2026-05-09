import psycopg2
import csv
import sys
import os
from typing import List, Dict, Any

# Ensure UTF-8 output for console
sys.stdout.reconfigure(encoding='utf-8')

class H3Analyzer:
    """
    Handles dual-path H3 spatial analysis for real estate data.
    Path 1: GEOM-Based (Categorized by administrative boundaries/rayons)
    Path 2: H3-Pure (Global H3 grid aggregation)
    """

    def __init__(self):
        self.db_config = {
            "host": os.environ["SOURCE_DB_HOST"],
            "port": os.environ.get("SOURCE_DB_PORT", "5432"),
            "user": os.environ["SOURCE_DB_USER"],
            "password": os.environ["SOURCE_DB_PASSWORD"],
            "dbname": os.environ.get("SOURCE_DB_NAME", "source_dev_db"),
        }
        self.output_file = "data/h3_analysis.csv"
        self.resolutions = [6, 7, 8]
        self.target_categories = (3, 4) # Yeni Tikili, Köhne Tikili
        
    def _get_connection(self):
        return psycopg2.connect(**self.db_config)

    def run_analysis(self):
        """Executes both GEOM and H3-Pure analysis paths."""
        try:
            print("--- H3 Spatial Analysis Starting ---")
            conn = self._get_connection()
            cur = conn.cursor()
            
            all_results = []
            
            for res in self.resolutions:
                print(f"Processing Resolution H{res}...")
                
                # Path 1: GEOM-Based (Rayon focused)
                print(f"  Executing Path 1: GEOM-Based (H{res})...")
                geom_results = self._fetch_geom_path_data(cur, res)
                all_results.extend(geom_results)
                
                # Path 2: H3-Pure (Global focused)
                print(f"  Executing Path 2: H3-Pure (H{res})...")
                pure_results = self._fetch_pure_h3_path_data(cur, res)
                all_results.extend(pure_results)
            
            self._save_to_csv(all_results)
            
            cur.close()
            conn.close()
            print("--- Analysis Completed Successfully ---")
            
        except Exception as e:
            print(f"CRITICAL ERROR in analysis: {e}")
            raise

    def _fetch_geom_path_data(self, cur, res: int) -> List[tuple]:
        """
        Path 1 Query: Spatial join with index_app_object (type_id 23).
        Result contains 'rayon_name' and is flagged as 'geom'.
        """
        query = f"""
            SELECT 
                'geom' AS analysis_type,
                o.name AS rayon_name,
                h3_lat_lng_to_cell(point(i.longitude, i.latitude), {res})::text AS h3_index,
                c.name AS category_name,
                COUNT(*) AS ad_count,
                AVG(i.owner_price / NULLIF(i.size, 0)) AS avg_price_kvm,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (i.owner_price / NULLIF(i.size, 0))) AS median_price_kvm,
                {res} AS resolution,
                TO_CHAR(i.created_date, 'YYYY-MM') AS period
            FROM item_app_items i
            LEFT JOIN item_app_itemcategory c ON i.category_id = c.id
            JOIN index_app_object o ON ST_Contains(o.geom, ST_SetSRID(ST_MakePoint(i.longitude, i.latitude), 4326))
            WHERE i.latitude IS NOT NULL 
              AND i.longitude IS NOT NULL 
              AND i.owner_price IS NOT NULL
              AND o.type_id = 23
              AND i.category_id IN {self.target_categories}
            GROUP BY 1, 2, 3, 4, 8, 9
            ORDER BY period DESC, rayon_name;
        """
        cur.execute(query)
        return cur.fetchall()

    def _fetch_pure_h3_path_data(self, cur, res: int) -> List[tuple]:
        """
        Path 2 Query: Global H3 aggregation ignoring administrative boundaries.
        Result has rayon_name as 'GLOBAL' and is flagged as 'pure_h3'.
        """
        query = f"""
            SELECT 
                'pure_h3' AS analysis_type,
                'GLOBAL' AS rayon_name,
                h3_lat_lng_to_cell(point(i.longitude, i.latitude), {res})::text AS h3_index,
                c.name AS category_name,
                COUNT(*) AS ad_count,
                AVG(i.owner_price / NULLIF(i.size, 0)) AS avg_price_kvm,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (i.owner_price / NULLIF(i.size, 0))) AS median_price_kvm,
                {res} AS resolution,
                TO_CHAR(i.created_date, 'YYYY-MM') AS period
            FROM item_app_items i
            LEFT JOIN item_app_itemcategory c ON i.category_id = c.id
            WHERE i.latitude IS NOT NULL 
              AND i.longitude IS NOT NULL 
              AND i.owner_price IS NOT NULL
              AND i.category_id IN {self.target_categories}
            GROUP BY 1, 2, 3, 4, 8, 9
            ORDER BY period DESC, ad_count DESC;
        """
        cur.execute(query)
        return cur.fetchall()

    def _save_to_csv(self, data: List[tuple]):
        """Writes the combined analysis results to CSV."""
        os.makedirs(os.path.dirname(self.output_file), exist_ok=True)
        headers = [
            'analysis_type', 'rayon_name', 'h3_index', 'category', 
            'ad_count', 'avg_price_kvm', 'median_price_kvm', 
            'resolution', 'period'
        ]
        
        print(f"Saving {len(data)} rows to {self.output_file}...")
        with open(self.output_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(headers)
            writer.writerows(data)
        print("CSV storage successful.")

if __name__ == "__main__":
    analyzer = H3Analyzer()
    analyzer.run_analysis()
