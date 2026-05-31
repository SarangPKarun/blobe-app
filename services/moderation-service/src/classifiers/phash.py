import asyncio
import io
import logging
from concurrent.futures import ThreadPoolExecutor

import imagehash
from PIL import Image
from sqlalchemy import select

from ..config import settings

_log = logging.getLogger(__name__)
_executor = ThreadPoolExecutor(max_workers=1)

# In-memory blocklist cache loaded at startup and refreshed periodically
_blocklist: list[imagehash.ImageHash] = []


async def load_phash_cache() -> None:
    from ..database import SessionLocal
    from ..models import CsamBlocklist

    async with SessionLocal() as db:
        result = await db.execute(select(CsamBlocklist))
        entries = result.scalars().all()
        _blocklist.clear()
        for entry in entries:
            try:
                _blocklist.append(imagehash.hex_to_hash(entry.phash))
            except Exception as exc:
                _log.warning("Invalid pHash entry %s: %s", entry.phash, exc)
    _log.info("pHash blocklist loaded: %d entries", len(_blocklist))


def _sync_check(img_bytes: bytes) -> bool:
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    h = imagehash.phash(img)
    return any(abs(h - bh) < settings.phash_distance_threshold for bh in _blocklist)


async def check_phash(img_bytes: bytes) -> bool:
    """Returns True if image matches a CSAM blocklist entry."""
    if not img_bytes or not _blocklist:
        return False
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(_executor, _sync_check, img_bytes)
