from fastapi import FastAPI
from app.routes import financials, news, analysis, econ_situation
from rich.traceback import install

# Make all tracebacks pretty in the console
install(show_locals=True)

app = FastAPI(title="Marketly Backend 🚀")

# Include routers
app.include_router(financials.router)
app.include_router(news.router)
app.include_router(analysis.router)
app.include_router(econ_situation.router)


@app.get("/")
def root():
    return {"message": "Marketly backend is running!"}


@app.get("/healthz")
def healthz():
    return {"status": "ok"}

