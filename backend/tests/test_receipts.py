import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.main import app
from app.receipts.schemas import ReceiptLine
from app.receipts.service import merge_ingredients


def _png_bytes() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (400, 1200), "white").save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("RECEIPT_MOCK", "1")
    return TestClient(app)


def _line(raw, name, qty=None, unit=None, conf="high", food=True):
    return ReceiptLine(
        raw_text=raw, is_food=food, ingredient=name if food else None,
        category="produce" if food else "non_food", quantity=qty, unit=unit, price=None, confidence=conf,
    )


def test_merge_sums_same_unit_and_keeps_lowest_confidence():
    ings, non_food = merge_ingredients([
        _line("LAIT 2%", "2% Milk", 1, "each"),
        _line("LAIT 2%", "2% milk", 1, "each", conf="low"),
        _line("SAC", None, food=False),
    ])
    assert len(ings) == 1
    assert ings[0].name == "2% milk" and ings[0].quantity == 2 and ings[0].confidence == "low"
    assert non_food == ["SAC"]


def test_merge_counts_unitless_repeats():
    ings, _ = merge_ingredients([_line("BANANA", "banana"), _line("BANANA", "banana")])
    assert ings[0].quantity == 2


def test_merge_keeps_different_units_separate():
    ings, _ = merge_ingredients([_line("A", "rice", 2, "kg"), _line("B", "rice", 1, "each")])
    assert len(ings) == 2


def test_scan_endpoint_mock(client):
    r = client.post("/receipts/scan", files={"image": ("r.png", _png_bytes(), "image/png")})
    assert r.status_code == 200, r.text
    body = r.json()
    names = [i["name"] for i in body["ingredients"]]
    assert "chicken breast" in names
    milk = next(i for i in body["ingredients"] if i["name"] == "2% milk")
    assert milk["quantity"] == 2
    assert "SAC REUTIL" in body["non_food_lines"]


def test_scan_rejects_non_image(client):
    r = client.post("/receipts/scan", files={"image": ("r.txt", b"hello", "text/plain")})
    assert r.status_code == 400


def test_scan_rejects_bad_lang(client):
    r = client.post("/receipts/scan?lang=de", files={"image": ("r.png", _png_bytes(), "image/png")})
    assert r.status_code == 422


def test_missing_api_key_gives_clear_error(monkeypatch):
    import app.receipts.service as svc
    monkeypatch.setenv("RECEIPT_MOCK", "0")
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setattr(svc, "_client", None)
    r = TestClient(app).post("/receipts/scan", files={"image": ("r.png", _png_bytes(), "image/png")})
    assert r.status_code == 500
    assert "GEMINI_API_KEY" in r.json()["detail"]


def _fake_gemini(monkeypatch, body):
    """Route the SDK's HTTP call to a canned Gemini response; returns captured request info."""
    import json as _json

    import httpx

    import app.receipts.service as svc
    captured = {}

    async def fake_send(self, request, **kw):
        captured["url"] = str(request.url)
        captured["headers"] = dict(request.headers)
        captured["body"] = _json.loads(request.content)
        return httpx.Response(200, json=body, request=request)

    monkeypatch.setenv("RECEIPT_MOCK", "0")
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(svc, "_client", None)
    monkeypatch.setattr(httpx.AsyncClient, "send", fake_send)
    return captured


def test_gemini_request_and_parse(monkeypatch):
    import json as _json

    import app.receipts.service as svc
    receipt = _json.loads(svc.MOCK_FILE.read_text(encoding="utf-8"))
    cap = _fake_gemini(monkeypatch, {"candidates": [
        {"content": {"role": "model", "parts": [{"text": _json.dumps(receipt)}]}, "finishReason": "STOP"}]})
    r = TestClient(app).post("/receipts/scan?lang=fr", files={"image": ("r.png", _png_bytes(), "image/png")})
    assert r.status_code == 200, r.text
    assert "test-key" not in cap["url"] and cap["headers"]["x-goog-api-key"] == "test-key"
    assert cap["body"]["generationConfig"]["responseMimeType"] == "application/json"
    assert "French" in _json.dumps(cap["body"]["systemInstruction"])
    assert len(r.json()["ingredients"]) == 8


def test_gemini_safety_block_is_422(monkeypatch):
    _fake_gemini(monkeypatch, {"candidates": [{"content": {"role": "model", "parts": []}, "finishReason": "SAFETY"}]})
    r = TestClient(app).post("/receipts/scan", files={"image": ("r.png", _png_bytes(), "image/png")})
    assert r.status_code == 422
