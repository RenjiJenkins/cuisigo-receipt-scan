# Devpost submission: Creators AI Winter Challenge

Copy-paste text for each Devpost field, a demo video script, and a final checklist. Edit anything that doesn't sound like you.

---

## Project name

**Cuisigo Scan: from grocery receipt to recipe-ready ingredients**

## Elevator pitch / tagline (short)

Snap a grocery receipt and get back a clean, editable list of ingredients you can cook with, in English or French.

## Project story

### Inspiration

I run [Cuisigo.ca](https://cuisigo.ca), a recipe app. The question that matters most for suggesting a recipe is "what do you have at home?", and the honest answer is that nobody types in 20 groceries after shopping. But everyone leaves the store holding a full list of what they just bought: the receipt.

The catch is that receipts aren't written for people. In Montréal they look like `ORG BNLS CHKN BRST`, `LAIT 2% 2L QUEBON`, `PAIN BLE ENT TRANCHE`: abbreviated, half French and half English, mixed in with taxes, deposits and bags. Plain OCR can read the letters but not what they mean. I wanted to see whether a vision model could read a receipt the way a person does.

### What it does

You take a photo of a grocery receipt, or upload one. A few seconds later you get the ingredients sorted by aisle:

- **Decodes store abbreviations** into the generic ingredient a recipe would call for: `ORG BNLS CHKN BRST` → *chicken breast*, `FROM CHEDDAR FORT` → *sharp cheddar cheese*.
- **English or French:** it reads both, and you choose the language of the ingredient names (*poitrine de poulet*, *lait 2%*…).
- **Quantities:** weights (`0.856 kg @ 16.60/kg`), counts (`OEUFS GROS 12` → 12 eggs) and package sizes.
- **Merges duplicates:** two `LAIT 2% 2L` lines become *2% milk, 4 L*.
- **Filters the noise:** bags, bottle deposits, dish soap, taxes and totals are set aside.
- **You stay in control:** untick anything you don't want, rename items, add what was missed. Items the model wasn't sure about are flagged "check".
- **Store, date and total** are picked up too, ready for future spending insights.

On a realistic, slightly blurry French Super C receipt it found all 12 food items, correctly set aside the 3 non-food lines, and read the $78.06 total.

### How I built it

- **Mobile app:** Expo + React Native + TypeScript. It uses the camera or photo picker, shrinks the photo on the device before uploading, and shows a review screen grouped by category. The same code runs in the browser for demos.
- **API:** FastAPI (Python). It straightens and downsizes the image with Pillow, then calls **Google Gemini** with vision input and a strict **JSON schema** built from Pydantic models. Each receipt line comes back as structured data: `raw_text`, `ingredient`, `category`, `quantity`, `unit`, `is_food`, `confidence`.
- **Model reads, code counts:** merging duplicates, adding up quantities and separating food from non-food happens in ordinary Python, so that part is predictable and tested.
- **Reliability:** if the main Gemini model is overloaded, the API retries and then falls back to a second model automatically. Every error comes back as a plain sentence the app can show.
- **Built to plug into Cuisigo:** the backend is one FastAPI router and the app side is one React Native screen with an `onConfirm` callback. Each can be copied into the existing app as a single folder.
- **Tests:** 10 pytest tests cover the merge logic, the endpoint, the exact request sent to Gemini, the fallback, safety blocks and a missing API key. They run without network access thanks to a mock mode, which also lets anyone try the app without a key.

### Challenges I ran into

- **Abbreviations are a language of their own.** `PAIN BLE ENT TRANCHE` is "whole wheat sliced bread". Getting a recipe-friendly name ("chicken breast", not "Organic Boneless Chicken Breast 856g") took careful prompt rules: singular, lowercase, no brand or size, keep useful qualifiers.
- **Overloaded models during testing.** The first live scans failed with a 503 "high demand" error from the main model. That led to the retry-then-fallback logic, and to logging Gemini's real error so problems are easy to diagnose.
- **Categories:** early runs filed olive oil under spices. Explicit category rules in the prompt fixed it.
- **Keeping secrets out of a public repo:** the API key is only read from a git-ignored `.env` file, and I scanned every commit for keys before pushing.

### Accomplishments I'm proud of

- It handles real Québec receipts: French abbreviations, weighed produce, duplicate lines and deposits.
- A clear split between the model (reading) and code (counting), so the numbers are predictable.
- A review screen that keeps the user in control instead of trusting the AI blindly.
- Anyone can run it in two minutes without an API key thanks to mock mode.

### What I learned

- Structured output (JSON schema) turns a vision model from a chatbot into a dependable part of the app.
- A good prompt is mostly concrete examples and rules, not clever wording.
- Plan for the model being unavailable: retries, fallbacks and clear error messages matter as much as accuracy.

### What's next

- **Recipe matching in Cuisigo:** "You can make 14 recipes with what you just bought."
- **A pantry that builds up over time,** with reminders before food expires, to reduce food waste.
- **Mapping to Cuisigo's ingredient catalogue** for exact recipe matching.
- **Spending insights,** since prices are already extracted.

## Built with

`gemini` · `google-genai` · `python` · `fastapi` · `pydantic` · `pillow` · `pytest` · `react-native` · `expo` · `typescript` · `react-native-web`

## Links

- **Source code:** https://github.com/RenjiJenkins/cuisigo-receipt-scan
- **Demo video:** *(add YouTube/Vimeo link)*
- **Screenshots:** upload the four images in `docs/screenshots/` to the Devpost image gallery

## Originality and ownership (paste into the description or "additional info")

- **Written during the hackathon:** all code in the repository. Cuisigo.ca is my existing recipe app; none of its code is in this repository, and this feature is designed to plug into it later.
- **Third-party tools:** the mobile app started from the official Expo `blank-typescript` template. It uses open-source libraries (FastAPI, Pydantic, Pillow, React Native, Expo) and the Google Gemini API under their licences and terms.
- **AI assistance:** development was assisted by an AI coding assistant (Claude Code).
- **No secrets:** the repository contains no API keys or personal data, and the sample receipt is synthetic.

---

## Demo video script (about 2 minutes)

The rules ask for the real product, not slides. Record the app running (browser at phone width or a real phone), with the API terminal visible for a few seconds.

| Time | On screen | Say |
|---|---|---|
| 0:00–0:15 | Cuisigo.ca, then a real paper receipt | "I run Cuisigo, a recipe app. To suggest recipes it needs to know what's in your kitchen, and nobody types in 20 groceries. But your receipt already lists them." |
| 0:15–0:30 | Close-up of the receipt's abbreviations | "The problem: receipts look like this. 'ORG BNLS CHKN BRST', half French, plus taxes, deposits and bags. OCR reads the letters but not what they mean." |
| 0:30–0:45 | App start screen; pick English | "Cuisigo Scan fixes that. I choose the language for ingredient names and take a photo." |
| 0:45–1:10 | Scan → "Reading your receipt…" → results | "Gemini reads the receipt and returns structured data for each line. Chicken breast with the weight, the two milks merged into 4 litres, a dozen eggs. Soap, the bag and the deposit are set aside." |
| 1:10–1:25 | Untick an item, rename one, add one, confirm | "I stay in control: untick, rename, add what's missing, and confirm." |
| 1:25–1:35 | Rescan with French names | "Same receipt, French names: poitrine de poulet, lait 2%." |
| 1:35–1:50 | Quick look at code: schema, merge function, terminal log | "Under the hood: Expo and React Native, a FastAPI backend, Gemini with a strict JSON schema, and plain Python for merging and counting. If the model is busy it falls back automatically." |
| 1:50–2:00 | README | "Next: recipe matching in Cuisigo. 'You can make 14 recipes tonight.' The code is on GitHub. Thanks!" |

**Recording tips:** set `GEMINI_MODEL=gemini-3.5-flash-lite` in `backend/.env` for about 4-second scans. Use `samples/receipt_superc.jpg` or a crisp photo of a real receipt. Hide the `.env` file.

---

## Final checklist (from the challenge's "Final Submission Checklist")

- [x] Project title
- [x] Comprehensive description (problem, solution, audience, distinctiveness, how it works, technologies): see above
- [x] Features list
- [x] Technologies used ("Built with")
- [x] Working demonstration evidence: screenshots in `docs/screenshots/`
- [x] Public source repository with run instructions, including a no-key mock mode
- [x] No credentials in the repo; `.env` is git-ignored
- [x] External resources and AI assistance acknowledged
- [ ] **You:** record and upload the demo video, then add the link
- [ ] **You:** upload screenshots to the Devpost gallery
- [ ] **You:** check team member details on Devpost
- [ ] **You:** confirm the deadline on the Devpost page (I couldn't read it) and submit before it
