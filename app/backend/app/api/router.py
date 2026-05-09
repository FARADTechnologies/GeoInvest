from fastapi import APIRouter

from app.api.routes import analytics

api_router = APIRouter()
api_router.include_router(analytics.router, tags=["analytics"])
