import requests
import json
import time
import sys

# Fix encoding for Windows console
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

def fetch_rayon_by_name(name):
    # Using a different mirror
    overpass_urls = [
        "https://lz4.overpass-api.de/api/interpreter",
        "https://z.overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter"
    ]
    
    query = f"""
    [out:json][timeout:30];
    relation["name"="{name}"]["boundary"="administrative"];
    out geom;
    """
    
    headers = {'User-Agent': 'BakuRayonFetcher/1.1'}
    
    for url in overpass_urls:
        try:
            print(f"Trying {url} for {name}...")
            response = requests.post(url, data={'data': query}, headers=headers, timeout=40)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"Failed {url}: {e}")
            continue
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
        print(f"Success: {r}")
    else:
        print(f"CRITICAL ERROR: Could not fetch {r}")
    time.sleep(1)

with open('scratch/baku_rayons_final.json', 'w', encoding='utf-8') as f:
    json.dump(all_data, f, ensure_ascii=False, indent=2)
print("Saved all fetched rayons to scratch/baku_rayons_final.json")
