"""Pydantic models for receipt scanning.

`ParsedReceipt` / `ReceiptLine` are what Gemini fills in (structured output).
`ReceiptScanResponse` / `Ingredient` are what the API returns to the app.
"""
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

Category = Literal[
    "produce",
    "meat_seafood",
    "dairy_eggs",
    "bakery",
    "pantry",
    "spices_condiments",
    "frozen",
    "beverages",
    "snacks",
    "other_food",
    "non_food",
]

Confidence = Literal["high", "medium", "low"]


# --- Model output (what Gemini extracts) ------------------------------------


class ReceiptLine(BaseModel):
    raw_text: str = Field(description="The line exactly as printed on the receipt.")
    is_food: bool = Field(description="True if this line is something you can cook or eat with.")
    ingredient: Optional[str] = Field(
        description=(
            "Generic, singular, lowercase ingredient name a recipe would use, "
            "e.g. 'chicken breast', 'whole milk', 'roma tomato'. No brands. Null when not food."
        )
    )
    category: Category
    quantity: Optional[float] = Field(description="Amount bought, if printed (count or weight).")
    unit: Optional[str] = Field(description="Unit for quantity: 'each', 'kg', 'g', 'lb', 'L', 'mL', 'pack'...")
    price: Optional[float] = Field(description="Line total price, if printed.")
    confidence: Confidence = Field(description="How sure you are about the ingredient name.")


class ParsedReceipt(BaseModel):
    is_receipt: bool = Field(description="False if the image is not a grocery/store receipt.")
    store_name: Optional[str]
    purchase_date: Optional[str] = Field(description="ISO 8601 date (YYYY-MM-DD) if printed.")
    currency: Optional[str] = Field(description="ISO 4217 code, e.g. 'CAD'.")
    total: Optional[float]
    lines: List[ReceiptLine]


# --- API response ------------------------------------------------------------


class Ingredient(BaseModel):
    name: str
    category: Category
    quantity: Optional[float] = None
    unit: Optional[str] = None
    confidence: Confidence
    source_lines: List[str] = Field(default_factory=list, description="Receipt lines merged into this ingredient.")


class ReceiptScanResponse(BaseModel):
    store_name: Optional[str] = None
    purchase_date: Optional[str] = None
    currency: Optional[str] = None
    total: Optional[float] = None
    ingredients: List[Ingredient]
    non_food_lines: List[str] = Field(default_factory=list)
    model: str
