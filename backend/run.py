# run.py
import logging
from rich.logging import RichHandler
import uvicorn

# Configure logging with Rich
logging.basicConfig(
    level="INFO",
    format="%(message)s",
    handlers=[RichHandler()]
)

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",   # path to your FastAPI app
        host="127.0.0.1",
        port=8000,
        reload=True,
        log_config=None   # <== important: disables uvicorn's own log formatting
    )
