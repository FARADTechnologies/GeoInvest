import json
import sys

def convert_to_geojson(input_path, output_path):
    with open(input_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    features = []
    
    for result in data:
        for element in result.get('elements', []):
            if element['type'] == 'relation':
                name = element.get('tags', {}).get('name', 'Bilinmir')
                
                # Group members by role
                members = element.get('members', [])
                outer_ways = [m for m in members if m['role'] == 'outer' and 'geometry' in m]
                
                if not outer_ways:
                    continue
                
                # Stitch ways into a list of coordinates
                # This is a simplified stitching: assuming they are in order or can be connected.
                # Since Overpass geom provides geometry per way, we can just concat them 
                # if we assume they form a single outer ring for simplicity in this case.
                # Accurate stitching would involve checking start/end coords.
                
                # Let's do a basic connection for now.
                all_coords = []
                for way in outer_ways:
                    way_coords = [[pt['lon'], pt['lat']] for pt in way['geometry']]
                    if not all_coords:
                        all_coords.extend(way_coords)
                    else:
                        # Check if we need to reverse or if it connects
                        if abs(all_coords[-1][0] - way_coords[0][0]) < 1e-6 and abs(all_coords[-1][1] - way_coords[0][1]) < 1e-6:
                            all_coords.extend(way_coords[1:])
                        elif abs(all_coords[-1][0] - way_coords[-1][0]) < 1e-6 and abs(all_coords[-1][1] - way_coords[-1][1]) < 1e-6:
                            all_coords.extend(way_coords[:-1][::-1])
                        else:
                            # If it doesn't connect directly, we might have multiple rings or gap
                            # For simplicity, we just add it.
                            all_coords.extend(way_coords)
                
                # Ensure it's closed
                if all_coords[0] != all_coords[-1]:
                    all_coords.append(all_coords[0])
                
                features.append({
                    "type": "Feature",
                    "properties": {
                        "name": name,
                        "id": element['id']
                    },
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [all_coords]
                    }
                })
    
    feature_collection = {
        "type": "FeatureCollection",
        "features": features
    }
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(feature_collection, f, ensure_ascii=False, indent=2)
    print(f"Successfully converted to {output_path}")

convert_to_geojson('scratch/baku_rayons_final.json', 'data/baku_rayons.geojson')
