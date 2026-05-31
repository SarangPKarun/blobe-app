import asyncio
import logging
import re
from concurrent.futures import ThreadPoolExecutor

_log = logging.getLogger(__name__)

_tokenizer = None
_model = None
_executor = ThreadPoolExecutor(max_workers=2)

# Spam heuristic: URL pattern
_URL_RE = re.compile(r"https?://\S+|www\.\S+", re.IGNORECASE)


def load_text_model() -> None:
    global _tokenizer, _model
    # Import here so the module loads even when transformers is absent in tests
    from transformers import AutoModelForSequenceClassification, AutoTokenizer

    from ..config import settings

    _log.info("Loading text classifier: %s", settings.text_model_name)
    _tokenizer = AutoTokenizer.from_pretrained(settings.text_model_name)
    _model = AutoModelForSequenceClassification.from_pretrained(settings.text_model_name)
    _model.eval()
    _log.info("Text classifier loaded")


def _sync_classify(text: str) -> dict[str, float]:
    import torch

    inputs = _tokenizer(text, return_tensors="pt", truncation=True, max_length=128)
    with torch.no_grad():
        logits = _model(**inputs).logits
    probs = torch.softmax(logits, dim=-1).squeeze().tolist()
    if isinstance(probs, float):
        probs = [probs]
    labels = _model.config.id2label
    return {labels[i].upper(): float(probs[i]) for i in range(len(probs))}


def _spam_heuristic(text: str) -> float:
    """Rule-based spam score 0.0-1.0 based on URL density and repetition."""
    if not text:
        return 0.0
    words = text.split()
    if not words:
        return 0.0
    url_ratio = len(_URL_RE.findall(text)) / max(len(words), 1)
    # Repeated character runs (e.g. "aaaaa")
    repeat_penalty = 0.3 if re.search(r"(.)\1{4,}", text) else 0.0
    return min(1.0, url_ratio * 2.0 + repeat_penalty)


async def classify_text(text: str) -> dict[str, float]:
    """Returns {"hate": float, "spam": float}. Safe to call with None model (returns zeros)."""
    if not text or not text.strip():
        return {"hate": 0.0, "spam": 0.0}

    spam = _spam_heuristic(text)

    if _model is None:
        return {"hate": 0.0, "spam": spam}

    loop = asyncio.get_event_loop()
    raw = await loop.run_in_executor(_executor, _sync_classify, text)

    # The model may label classes differently; look for a "HATE" key
    hate = 0.0
    for k, v in raw.items():
        if "HATE" in k and "NOT" not in k:
            hate = v
            break

    return {"hate": hate, "spam": spam}
