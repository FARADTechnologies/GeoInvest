import requests
import json
import os

def fetch_baku_rayons():
    overpass_url = "http://overpass-api.de/api/interpreter"
    
    # Overpass query to get all admin_level=9 (Rayons) inside Baku (id: 457581?)
    # Actually, Baku is a city. Let's search for "rayon" in "Baku"
    query = """
    [out:json][timeout:25];
    area[name="Bakı"]->.searchArea;
    (
      relation["admin_level"="9"](area.searchArea);
      relation["admin_level"="7"](area.searchArea);
    );
    out body;
    >;
    out skel qt;
    """
    
    # Alternatively, searching by name patterns
    # Baku Rayons: Yasamal, Nasimi, Sabail, Narimanov, Nizami, Khatai, Binagadi, Sabunchu, Surakhani, Garadagh, Khazar, Pirallahi
    rayons = [
        "Yasamal rayonu", "Nəsimi rayonu", "Səbail rayonu", "Nərimanov rayonu", 
        "Nizami rayonu", "Xətai rayonu", "Binəqədi rayonu", "Sabunçu rayonu", 
        "Suraxanı rayonu", "Qaradağ rayonu", "Xəzər rayonu", "Pirallahı rayonu"
    ]
    
    all_features = []
    
    # Let's use a simpler approach: get all relations with boundary=administrative and admin_level=9 in Azerbaijan
    # and filter for those known in Baku.
    
    for rayon_name in rayons:
        print(f"Fetching {rayon_name}...")
        q = f"""
        [out:json];
        relation["name"="{rayon_name}"]["boundary"="administrative"];
        out geom;
        """
        response = requests.get(overpass_url, params={'data': q})
        if response.status_code == 200:
            data = response.json()
            for element in data.get('elements', []):
                if element['type'] == 'relation':
                    # Convert OSM relation to GeoJSON-like feature
                    coords = []
                    # This is complex because relations have members. 
                    # But Overpass 'out geom' provides geometry.
                    
                    # We'll use a library if possible or just parse the simple case.
                    # Actually, I'll try to find a pre-compiled GeoJSON for Baku Rayons to be safe and accurate.
                    pass

    # Better way: Search for a public GeoJSON file
    # I'll try one more query to get all of them at once
    full_query = """
    [out:json];
    (
      relation["admin_level"="9"]["boundary"="administrative"](40.3,49.7,40.6,50.4);
    );
    out geom;
    """
    print("Fetching all potential rayons in Baku area...")
    response = requests.get(overpass_url, params={'data': full_query})
    if response.status_code == 200:
        data = response.json()
        with open('scratch/osm_rayons.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print("Raw OSM data saved to scratch/osm_rayons.json")

fetch_baku_rayons()
