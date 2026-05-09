import requests
import json

def find_baku_rayon_ids():
    overpass_url = "http://overpass-api.de/api/interpreter"
    
    # Search for relations with name like 'rayonu' in the Baku area
    query = """
    [out:json][timeout:25];
    area[name="Bakı"]->.searchArea;
    (
      relation["boundary"="administrative"]["name"~"rayonu"](area.searchArea);
    );
    out body;
    """
    
    print("Finding Baku Rayon IDs...")
    response = requests.get(overpass_url, params={'data': query})
    if response.status_code == 200:
        data = response.json()
        results = []
        for element in data.get('elements', []):
            name = element.get('tags', {}).get('name')
            results.append({
                "id": element['id'],
                "name": name
            })
        
        print(json.dumps(results, indent=2, ensure_ascii=False))
    else:
        print(f"Error: {response.status_code}")

find_baku_rayon_ids()
