import asyncio
import base64
import logging
from concurrent.futures import ThreadPoolExecutor

import httpx

from ..config import settings

_log = logging.getLogger(__name__)
_executor = ThreadPoolExecutor(max_workers=2)

_local_model = None


def load_local_nsfw_model() -> None:
    global _local_model
    try:
        from nsfw_detector import predict
        _local_model = predict
        _log.info("Local NSFW model loaded")
    except ImportError:
        _log.warning("nsfw_detector not installed; local NSFW will return 0.0")


async def download_image(media_url: str) -> bytes | None:
    """Downloads image bytes with a 3s timeout. Returns None on failure."""
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(media_url)
            resp.raise_for_status()
            return resp.content
    except Exception as exc:
        _log.warning("Image download failed for %s: %s", media_url, exc)
        return None


async def classify_image_nsfw(img_bytes: bytes) -> float:
    """Returns NSFW score 0.0–1.0. Fails open (returns 0.0) on any error."""
    if not img_bytes:
        return 0.0
    try:
        if settings.nsfw_backend == "openai":
            return await _openai_moderate(img_bytes)
        else:
            return await _local_nsfw(img_bytes)
    except Exception as exc:
        _log.warning("NSFW classification error: %s", exc)
        return 0.0


async def _openai_moderate(img_bytes: bytes) -> float:
    b64 = base64.b64encode(img_bytes).decode()
    payload = {
        "model": "omni-moderation-latest",
        "input": [{"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}}],
    }
    async with httpx.AsyncClient(timeout=3.0) as client:
        resp = await client.post(
            "https://api.openai.com/v1/moderations",
            headers={"Authorization": f"Bearer {settings.openai_api_key}"},
            json=payload,
        )
        resp.raise_for_status()
        scores = resp.json()["results"][0]["category_scores"]
        return float(scores.get("sexual", 0.0))


def _sync_local_nsfw(img_bytes: bytes) -> float:
    if _local_model is None:
        return 0.0
    import io
    from PIL import Image
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    result = _local_model.classify_nd(img)
    return float(result.get("porn", 0.0) + result.get("hentai", 0.0) + result.get("sexy", 0.0))


async def _local_nsfw(img_bytes: bytes) -> float:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(_executor, _sync_local_nsfw, img_bytes)
