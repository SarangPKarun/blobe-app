import asyncio
import logging
from contextlib import asynccontextmanager

import sentry_sdk
import uvicorn
from fastapi import FastAPI
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

from .classifiers.phash import load_phash_cache
from .classifiers.text import load_text_model
from .config import settings
from .database import create_tables
from .kafka.consumer import start_consumer, stop_consumer
from .kafka.producer import start_producer, stop_producer
from .routes import queue

logging.basicConfig(level=logging.INFO)
_log = logging.getLogger(__name__)

if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.sentry_environment,
        server_name="moderation-service",
        traces_sample_rate=0.1,
        integrations=[FastApiIntegration(), SqlalchemyIntegration()],
    )

_phash_refresh_task: asyncio.Task | None = None


async def _phash_refresh_loop() -> None:
    """Refresh CSAM blocklist cache every 5 minutes."""
    while True:
        await asyncio.sleep(300)
        try:
            await load_phash_cache()
        except Exception:
            _log.exception("Failed to refresh pHash blocklist cache")


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _phash_refresh_task
    _log.info("Starting moderation-service on port %d", settings.port)
    await create_tables()
    load_text_model()
    await load_phash_cache()
    await start_producer()
    await start_consumer()
    _phash_refresh_task = asyncio.create_task(_phash_refresh_loop())
    yield
    if _phash_refresh_task:
        _phash_refresh_task.cancel()
    await stop_consumer()
    await stop_producer()
    _log.info("moderation-service shut down")


app = FastAPI(title="moderation-service", lifespan=lifespan)
app.include_router(queue.router)


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run("src.main:app", host="0.0.0.0", port=settings.port, reload=True)
