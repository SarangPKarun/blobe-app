import logging
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI

from .config import settings
from .database import create_tables
from .kafka.consumer import start_consumer, stop_consumer
from .kafka.producer import start_producer, stop_producer
from .routes import appeals, trust, votes

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting trust-service on port %d", settings.port)
    await create_tables()
    await start_producer()
    await start_consumer()
    yield
    await stop_consumer()
    await stop_producer()
    logger.info("trust-service shut down")


app = FastAPI(title="trust-service", lifespan=lifespan)

app.include_router(votes.router)
app.include_router(trust.router)
app.include_router(appeals.router)


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run("src.main:app", host="0.0.0.0", port=settings.port, reload=True)
