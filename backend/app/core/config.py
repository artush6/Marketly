from dotenv import load_dotenv
import os

load_dotenv()


class Settings:
    # Optional. If unset, the app runs without Redis-backed caching.
    REDIS_URL = os.getenv("REDIS_URL")


settings = Settings()
