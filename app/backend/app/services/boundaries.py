import json

from app.core.config import settings
from app.schemas.analytics import BoundaryFeature, BoundaryFeatureCollection


class BoundaryService:
    def load_feature_collection(self) -> BoundaryFeatureCollection:
        if not settings.boundaries_json_path.exists():
            return BoundaryFeatureCollection(features=[])

        with settings.boundaries_json_path.open("r", encoding="utf-8") as handle:
            raw_items = json.load(handle)

        features: list[BoundaryFeature] = []
        for item in raw_items:
            geometry = item.get("geojson")
            if not geometry:
                continue
            features.append(
                BoundaryFeature(
                    geometry=geometry,
                    properties={
                        "id": item.get("id"),
                        "name": item.get("name", "Unknown"),
                        "type_id": item.get("type_id"),
                    },
                )
            )

        return BoundaryFeatureCollection(features=features)
