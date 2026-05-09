import requests
import json

def fetch_baku_polygons():
    overpass_url = "https://overpass-api.de/api/interpreter"
    
    query = """
    [out:json][timeout:60];
    area[name="Bakı"]->.b;
    (
      relation["boundary"="administrative"]["admin_level"~"7|9"](area.b);
    );
    out geom;
    """
    
    headers = {
        'User-Agent': 'BakuRayonFetcher/1.0 (contact: info@example.com)',
        'Content-Type': 'application/x-www-form-urlencoded'
    }
    
    print("Fetching Baku district polygons from Overpass with headers...")
    try:
        response = requests.post(overpass_url, data={'data': query}, headers=headers)
        response.raise_for_status()
        data = response.json()
        
        with open('scratch/baku_osm_raw.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print("Raw OSM data saved to scratch/baku_osm_raw.json")
        
    except Exception as e:
        print(f"Error fetching: {e}")

fetch_baku_polygons()
