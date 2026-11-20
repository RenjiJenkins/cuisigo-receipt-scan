"""Drop-in FastAPI router. In Cuisigo's API:

    from app.receipts.router import router as receipts_router
    app.include_router(receipts_router, dependencies=[Depends(get_current_user)])
"""
from fastapi import APIRouter, File, HTTPException, Query, UploadFile

from .schemas import ReceiptScanResponse
from .service import ReceiptParseError, scan_receipt

MAX_UPLOAD_BYTES = 15 * 1024 * 1024

router = APIRouter(prefix="/receipts", tags=["receipts"])


@router.post("/scan", response_model=ReceiptScanResponse)
async def scan(
    image: UploadFile = File(..., description="Photo of a grocery receipt (JPEG/PNG/WebP/HEIC-converted)."),
    lang: str = Query("en", pattern="^(en|fr)$", description="Language for ingredient names."),
) -> ReceiptScanResponse:
    data = await image.read(MAX_UPLOAD_BYTES + 1)
    if not data:
        raise HTTPException(400, "Empty upload.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Image is too large (max 15 MB).")
    try:
        return await scan_receipt(data, lang)
    except ReceiptParseError as exc:
        raise HTTPException(exc.status_code, str(exc)) from exc
