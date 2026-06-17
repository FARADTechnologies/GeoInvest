from fastapi import APIRouter

from app.api.routes import analytics, model, valuation

api_router = APIRouter()
api_router.include_router(analytics.router, tags=["analytics"])
api_router.include_router(valuation.router, tags=["valuation"])
api_router.include_router(model.router, tags=["model"])
