"""Application configuration loading and typed settings access."""

import os
from dataclasses import dataclass
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    """Immutable runtime settings read from environment variables."""

    REDIS_URL: str | None
    FINNHUB_API_KEY: str | None
    FMPSDK_API_KEY: str | None
    RAPIDAPI_KEY: str | None
    FRED_API_KEY: str | None
    OPENAI_API_KEY: str | None
    OPENAI_MODEL: str


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a process-wide cached settings instance."""

    return Settings(
        REDIS_URL=os.getenv("REDIS_URL"),
        FINNHUB_API_KEY=os.getenv("FINNHUB_API_KEY"),
        FMPSDK_API_KEY=os.getenv("FMPSDK_API_KEY"),
        RAPIDAPI_KEY=os.getenv("RAPIDAPI_KEY"),
        FRED_API_KEY=os.getenv("FRED_API_KEY"),
        OPENAI_API_KEY=os.getenv("OPENAI_API_KEY"),
        OPENAI_MODEL=os.getenv("OPENAI_MODEL", "gpt-5-nano-2025-08-07"),
    )


settings = get_settings()
