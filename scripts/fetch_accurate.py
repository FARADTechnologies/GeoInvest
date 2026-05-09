import requests
import json
import os

def fetch_accurate_rayons():
    overpass_url = "http://overpass-api.de/api/interpreter"
    
    ids = [
        11825936, 11825933, 11825934, 11825932, 11827003, 
        11825937, 11825935, 11825939, 11825938, 11825931, 
        11825940, 2712953
    ]
    
    id_str = ",".join(map(str, ids))
    
    query = f"""
    [out:json][timeout:25];
    (
      relation(id:{id_str});
    );
    out geom;
    """
    
    print(f"Fetching {len(ids)} rayons from OSM...")
    response = requests.get(overpass_url, params={'data': query})
    
    if response.status_code == 200:
        data = response.json()
        
        features = []
        for element in data.get('elements', []):
            if element['type'] == 'relation':
                name = element.get('tags', {}).get('name', 'Bilinmir')
                # Overpass geom output for relations provides 'members' with 'geometry'
                # We need to stitch these into a Polygon.
                # This is tricky manually. 
                # But wait, Overpass Turbo does this. 
                # I'll try to find a simpler way or use a library that does this.
                
                # Let's save the raw data for now and I'll use a python script to convert it.
                pass
        
        with open('data/raw_osm_rayons.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print("Raw OSM data saved to data/raw_osm_rayons.json")
    else:
        print(f"Error fetching data: {response.status_code}")

fetch_accurate_rayons()
