# Cuisigo Receipt Scan

Take a photo of a grocery receipt and get back a clean ingredient list you can cook from. For example, `ORG BNLS CHKN BRST` becomes **chicken breast** and `LAIT 2% 2L` becomes **2% milk**.

- **backend/**: a FastAPI router (`POST /receipts/scan`) that sends the photo to Gemini (`gemini-3.8-flash`, vision + JSON-schema output), then merges duplicate lines and separates out non-food items.
- **mobile/**: an Expo (React Native + TypeScript) app. You take or pick a photo, then review the ingredients by category: tick or untick, rename, or add missing ones. Then you confirm.

Receipts can be in English or French, and you can choose which language the ingredient names come back in.

## Run it

### 1. API

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env          # skip if backend/.env already exists
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**API key:** put it in `backend/.env` as `GEMINI_API_KEY=...` (get one at aistudio.google.com/apikey). That file is the only place the key lives: it's git-ignored, the code never contains it, and `.env.example` is the template you commit. In production, set `GEMINI_API_KEY` as a real environment variable on the host instead; real variables take precedence over `.env`.

No API key yet, or demoing offline? Set `RECEIPT_MOCK=1` in `.env` and every scan returns a sample Metro receipt.

Tests: `pip install -r requirements-dev.txt && pytest`

### 2. App

```bash
cd mobile
npm install
npx expo start
```

- **Phone (Expo Go):** scan the QR code. Your phone must be on the same Wi-Fi as your PC. In dev the app automatically calls `http://<your-PC-IP>:8000`. If Windows Firewall prompts, allow Python on private networks.
- **Browser:** press `w`. This is handy for demos: use "Choose from files" with a receipt photo.
- **Other API host:** set `EXPO_PUBLIC_API_URL` (see `mobile/.env.example`).

## API

`POST /receipts/scan?lang=en|fr` with multipart field `image`.

```json
{
  "store_name": "Metro",
  "purchase_date": "2026-11-18",
  "currency": "CAD",
  "total": 48.62,
  "ingredients": [
    { "name": "2% milk", "category": "dairy_eggs", "quantity": 2, "unit": "each",
      "confidence": "high", "source_lines": ["LAIT 2% 2L", "LAIT 2% 2L"] }
  ],
  "non_food_lines": ["SAC REUTIL", "DEPOT CONSIGNE"],
  "model": "gemini-3.8-flash"
}
```

Errors return `{"detail": "<human-readable message>"}` with status 400, 413, 422, 429, 500 or 502. The app shows that message to the user as is.

Settings (`backend/.env`):

- `GEMINI_API_KEY` (required): your Gemini key.
- `GEMINI_MODEL` (default `gemini-3.8-flash`): any Gemini model that accepts images and structured output. `gemini-3.5-flash-lite` is cheaper and faster.
- `GEMINI_FALLBACK_MODEL` (default `gemini-3.5-flash-lite`): if the main model is overloaded (503) or rate-limited, the API retries once and then uses this model. The response's `model` field says which model answered.
- `RECEIPT_MOCK`: set to `1` to return the canned receipt.

If Gemini's safety filter blocks a photo, the API returns a 422 with "This image couldn't be processed."

## Moving it into Cuisigo

Both halves are self-contained, so you copy one folder on each side.

**FastAPI:** copy `backend/app/receipts/` into your API package, add `google-genai`, `pillow` and `python-dotenv` to your dependencies, and add `GEMINI_API_KEY` to Cuisigo's `.env`. Then:

```python
from app.receipts.router import router as receipts_router
app.include_router(receipts_router, dependencies=[Depends(get_current_user)])  # reuse your auth
```

**React Native:** copy `mobile/src/features/receiptScan/` and run `npx expo install expo-image-picker expo-image-manipulator react-native-safe-area-context expo-constants`. Then add the `expo-image-picker` plugin block from `mobile/app.json` (it holds the camera permission text). Mount the screen in your navigator:

```tsx
<ReceiptScanScreen
  scanOptions={{ apiUrl: API_URL, headers: { Authorization: `Bearer ${token}` } }}
  onConfirm={(ingredients) => {
    // e.g. save to pantry, then navigate to recipe search filtered by ingredients.map(i => i.name)
  }}
/>
```

Swap the colours in `receiptScan/theme.ts` for Cuisigo's design tokens.

**Ideas for after the hackathon:**

- Map `name` to Cuisigo's own ingredient IDs so it plugs straight into recipe matching.
- Save scans so users build up a pantry over time.
- Rank recipes by how many scanned ingredients they use.
