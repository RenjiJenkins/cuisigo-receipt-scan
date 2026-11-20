"""Receipt image -> ingredient list, using Gemini vision + structured (JSON schema) output."""
import asyncio
import contextvars
import io
import json
import logging
import os
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import httpx
from dotenv import load_dotenv
from google import genai
from google.genai import errors, types
from PIL import Image, ImageOps
from pydantic import ValidationError

from .schemas import Ingredient, ParsedReceipt, ReceiptLine, ReceiptScanResponse

# Secrets come only from a .env file (searched upward from this file, so
# backend/.env here, or the host app's .env once merged into Cuisigo).
# Real environment variables still win, which is what production hosts use.
load_dotenv()

MAX_IMAGE_SIDE = 2000  # px; plenty for receipt text, keeps uploads small
MOCK_FILE = Path(__file__).parent / "mock_receipt.json"
BLOCKED_FINISH = {
    types.FinishReason.SAFETY,
    types.FinishReason.PROHIBITED_CONTENT,
    types.FinishReason.BLOCKLIST,
    types.FinishReason.SPII,
    types.FinishReason.IMAGE_SAFETY,
    types.FinishReason.IMAGE_PROHIBITED_CONTENT,
    types.FinishReason.RECITATION,
}

SYSTEM_PROMPT = """You read photos of grocery receipts and turn them into a clean list of cooking ingredients for a recipe app.

For every purchased line item on the receipt, emit one entry in `lines`:
- Decode store abbreviations into a plain ingredient: "ORG BNLS CHKN BRST" -> "chicken breast", "BANANES" -> "banana", "LAIT 2% 4L" -> "2% milk".
- `ingredient` is the generic thing a recipe would call for: singular, lowercase, no brand, no size. Keep meaningful qualifiers (e.g. "greek yogurt", "brown rice", "smoked paprika").
- Receipts may be in English or French (Canada). Write `ingredient` in {lang_name}.
- Quantity/unit: use weight lines like "0.856 kg @ $4.39/kg" or multipliers like "2 @ 1.99" when present; otherwise leave null.
- Mark non-food items (bags, deposits, cleaning supplies, toiletries, gift cards) with is_food=false, category "non_food", ingredient null.
- Skip subtotal, tax, payment, loyalty points and discount lines entirely.
- If a line is too cut off or blurry to decode, still include it with your best guess and confidence "low".
If the image is not a receipt, set is_receipt=false and return no lines."""

LANG_NAMES = {"en": "English", "fr": "French"}


log = logging.getLogger("uvicorn.error")
served_by: contextvars.ContextVar[str] = contextvars.ContextVar("served_by", default="")


def model_name() -> str:
    return os.getenv("GEMINI_MODEL", "gemini-3.8-flash")


def fallback_model_name() -> str:
    """Used when the main model is overloaded. Set GEMINI_FALLBACK_MODEL= (empty) to disable."""
    return os.getenv("GEMINI_FALLBACK_MODEL", "gemini-3.5-flash-lite").strip()


def mock_enabled() -> bool:
    return os.getenv("RECEIPT_MOCK", "").strip().strip('"') == "1"


class ReceiptParseError(Exception):
    """Raised when the image can't be turned into an ingredient list."""

    def __init__(self, message: str, status_code: int = 422):
        super().__init__(message)
        self.status_code = status_code


_client: Optional[genai.Client] = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        api_key = os.getenv("GEMINI_API_KEY", "").strip()
        if not api_key:
            raise ReceiptParseError(
                "Server is missing GEMINI_API_KEY. Add it to backend/.env (or set RECEIPT_MOCK=1 for demo data).", 500
            )
        _client = genai.Client(api_key=api_key)
    return _client


def prepare_image(data: bytes) -> Tuple[bytes, str]:
    """Normalize orientation, downscale, re-encode as JPEG. Returns (jpeg_bytes, mime_type)."""
    try:
        img = Image.open(io.BytesIO(data))
        img = ImageOps.exif_transpose(img)
    except Exception as exc:  # PIL raises many types for bad input
        raise ReceiptParseError("Could not read the uploaded image.", 400) from exc
    if img.mode != "RGB":
        img = img.convert("RGB")
    img.thumbnail((MAX_IMAGE_SIDE, MAX_IMAGE_SIDE))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return buf.getvalue(), "image/jpeg"


async def extract_receipt(image: bytes, mime_type: str, lang: str = "en") -> ParsedReceipt:
    """Ask Gemini to read the receipt. Returns the raw structured extraction."""
    if mock_enabled():
        return ParsedReceipt.model_validate(json.loads(MOCK_FILE.read_text(encoding="utf-8")))

    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT.format(lang_name=LANG_NAMES.get(lang, "English")),
        response_mime_type="application/json",
        response_schema=ParsedReceipt,
    )
    contents = [
        types.Part.from_bytes(data=image, mime_type=mime_type),
        "Extract the ingredients from this receipt.",
    ]
    response = None
    # Try the main model (twice: Gemini 503s are usually brief), then the fallback model.
    attempts = [model_name(), model_name()]
    if fallback_model_name() and fallback_model_name() != model_name():
        attempts.append(fallback_model_name())
    for i, model in enumerate(attempts):
        last = i == len(attempts) - 1
        try:
            response = await _get_client().aio.models.generate_content(model=model, contents=contents, config=config)
            break
        except errors.ClientError as exc:
            log.warning("Gemini %s rejected the request: %s %s", model, exc.code, exc.message)
            if exc.code == 429:
                if not last:
                    continue
                raise ReceiptParseError("Too many scans right now, try again in a moment.", 429) from exc
            if exc.code in (401, 403) or "API_KEY" in str(exc):
                raise ReceiptParseError("GEMINI_API_KEY is invalid or lacks access to this model.", 500) from exc
            if exc.code == 404:
                raise ReceiptParseError(f"Gemini model '{model}' was not found. Check GEMINI_MODEL.", 500) from exc
            raise ReceiptParseError(f"Request rejected: {exc.message}", 400) from exc
        except errors.ServerError as exc:
            log.warning("Gemini %s unavailable: %s %s", model, exc.code, exc.message)
            if last:
                raise ReceiptParseError("The receipt reader is busy right now, try again in a moment.", 503) from exc
            if model == attempts[i + 1]:
                await asyncio.sleep(1.5)
        except httpx.HTTPError as exc:
            log.warning("Could not reach Gemini: %r", exc)
            raise ReceiptParseError("Could not reach the receipt reader.", 502) from exc
    assert response is not None
    served_by.set(model)

    if response.prompt_feedback and response.prompt_feedback.block_reason:
        raise ReceiptParseError("This image couldn't be processed.", 422)
    finish = response.candidates[0].finish_reason if response.candidates else None
    if finish in BLOCKED_FINISH:
        raise ReceiptParseError("This image couldn't be processed.", 422)
    if finish == types.FinishReason.MAX_TOKENS:
        raise ReceiptParseError("Receipt was too long to read in one pass.", 422)

    if isinstance(response.parsed, ParsedReceipt):
        return response.parsed
    try:
        return ParsedReceipt.model_validate_json(response.text or "")
    except ValidationError as exc:
        raise ReceiptParseError("Couldn't make sense of this receipt. Try a clearer photo.", 422) from exc


def _key(name: str, unit: Optional[str]) -> Tuple[str, str]:
    return name.strip().lower(), (unit or "").strip().lower()


_CONF_RANK = {"low": 0, "medium": 1, "high": 2}


def merge_ingredients(lines: List[ReceiptLine]) -> Tuple[List[Ingredient], List[str]]:
    """Collapse duplicate food lines (e.g. two cartons of milk) into one ingredient each."""
    merged: Dict[Tuple[str, str], Ingredient] = {}
    non_food: List[str] = []
    for line in lines:
        if not line.is_food or not line.ingredient:
            non_food.append(line.raw_text)
            continue
        k = _key(line.ingredient, line.unit)
        existing = merged.get(k)
        if existing is None:
            merged[k] = Ingredient(
                name=line.ingredient.strip().lower(),
                category=line.category,
                quantity=line.quantity,
                unit=line.unit,
                confidence=line.confidence,
                source_lines=[line.raw_text],
            )
            continue
        existing.source_lines.append(line.raw_text)
        if existing.quantity is not None and line.quantity is not None:
            existing.quantity = round(existing.quantity + line.quantity, 3)
        elif existing.quantity is None and line.unit is None:
            # Unitless repeats ("BANANA", "BANANA") count as items.
            existing.quantity = float(len(existing.source_lines))
        if _CONF_RANK[line.confidence] < _CONF_RANK[existing.confidence]:
            existing.confidence = line.confidence
    return list(merged.values()), non_food


async def scan_receipt(data: bytes, lang: str = "en") -> ReceiptScanResponse:
    image, mime_type = prepare_image(data)
    receipt = await extract_receipt(image, mime_type, lang)
    if not receipt.is_receipt:
        raise ReceiptParseError("That doesn't look like a receipt. Try another photo.", 422)
    ingredients, non_food = merge_ingredients(receipt.lines)
    return ReceiptScanResponse(
        store_name=receipt.store_name,
        purchase_date=receipt.purchase_date,
        currency=receipt.currency,
        total=receipt.total,
        ingredients=ingredients,
        non_food_lines=non_food,
        model="mock" if mock_enabled() else (served_by.get() or model_name()),
    )
