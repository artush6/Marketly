import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from app.integrations import supabase_store
from app.services.market_refresh import RefreshWorker
from app.routes import companies, analysis, assistant, discovery, econ_situation, financials, heatmap, market, news
from rich.traceback import install
from app.core.cache import r as redis_client
from app.core.config import settings

# Make all tracebacks pretty in the console
install(show_locals=False)

@asynccontextmanager
async def lifespan(app):
    worker = None
    if supabase_store.is_configured() and os.getenv("BACKGROUND_REFRESH_ENABLED", "true").lower() == "true":
        worker = RefreshWorker()
        worker.start()
    yield
    if worker:
        worker.stop()


app = FastAPI(title="Marketly Backend 🚀", lifespan=lifespan)

# Include routers
app.include_router(companies.router)
app.include_router(financials.router)
app.include_router(news.router)
app.include_router(analysis.router)
app.include_router(assistant.router)
app.include_router(econ_situation.router)
app.include_router(discovery.router)
app.include_router(market.router)


@app.get("/")
def root():
    return {"message": "Marketly backend is running!"}


@app.head("/")
def root_head():
    return None


@app.get("/healthz")
def healthz():
    return {"status": "ok"}


@app.get("/healthz/dependencies")
def dependency_healthz():
    """Report dependency configuration without exposing credentials."""
    redis_connected = False
    if redis_client is not None:
        try:
            redis_connected = bool(redis_client.ping())
        except Exception:
            redis_connected = False

    return {
        "status": "ok" if redis_connected and settings.OPENAI_API_KEY else "degraded",
        "openai": {
            "configured": bool(settings.OPENAI_API_KEY),
            "model": settings.OPENAI_MODEL,
        },
        "redis": {
            "configured": bool(
                settings.REDIS_URL
                or (
                    settings.UPSTASH_REDIS_REST_URL
                    and settings.UPSTASH_REDIS_REST_TOKEN
                )
            ),
            "connected": redis_connected,
        },
    }

app.include_router(heatmap.router)
