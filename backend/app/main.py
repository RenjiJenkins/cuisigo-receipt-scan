"""Standalone app for the hackathon. In Cuisigo, only include `receipts.router`."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .receipts.router import router as receipts_router  # also loads backend/.env

app = FastAPI(title="Cuisigo Receipt Scan", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(receipts_router)


@app.get("/health")
def health() -> dict:
    return {"ok": True}
