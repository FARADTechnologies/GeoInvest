import requests
import json
import time

def fetch_rayon_by_name(name):
    overpass_url = "https://overpass-api.de/api/interpreter"
    query = f"""
    [out:json][timeout:30];
    relation["name"="{name}"]["boundary"="administrative"];
    out geom;
    """
    headers = {'User-Agent': 'BakuRayonFetcher/1.0'}
    try:
        response = requests.post(overpass_url, data={'data': query}, headers=headers)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Error fetching {name}: {e}")
        return None

rayons = [
    "Yasamal rayonu", "Nəsimi rayonu", "Səbail rayonu", "Nərimanov rayonu", 
    "Nizami rayonu", "Xətai rayonu", "Binəqədi rayonu", "Sabunçu rayonu", 
    "Suraxanı rayonu", "Qaradağ rayonu", "Xəzər rayonu", "Pirallahı rayonu"
]

all_data = []
for r in rayons:
    print(f"Fetching {r}...")
    data = fetch_rayon_by_name(r)
    if data:
        all_data.append(data)
    time.sleep(2) # Avoid rate limits

with open('scratch/baku_rayons_named.json', 'w', encoding='utf-8') as f:
    json.dump(all_data, f, ensure_ascii=False, indent=2)
print("Saved all fetched rayons to scratch/baku_rayons_named.json")
