from fastapi import APIRouter

from app.api.routes import admin, analytics, auth, model, valuation

api_router = APIRouter()
api_router.include_router(analytics.router, tags=["analytics"])
api_router.include_router(valuation.router, tags=["valuation"])
api_router.include_router(model.router, tags=["model"])
api_router.include_router(auth.router, tags=["auth"])
api_router.include_router(admin.router, tags=["admin"])
