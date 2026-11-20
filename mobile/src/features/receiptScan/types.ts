// Mirrors backend/app/receipts/schemas.py

export type Category =
  | 'produce'
  | 'meat_seafood'
  | 'dairy_eggs'
  | 'bakery'
  | 'pantry'
  | 'spices_condiments'
  | 'frozen'
  | 'beverages'
  | 'snacks'
  | 'other_food'
  | 'non_food';

export type Confidence = 'high' | 'medium' | 'low';

export interface Ingredient {
  name: string;
  category: Category;
  quantity: number | null;
  unit: string | null;
  confidence: Confidence;
  source_lines: string[];
}

export interface ReceiptScanResponse {
  store_name: string | null;
  purchase_date: string | null;
  currency: string | null;
  total: number | null;
  ingredients: Ingredient[];
  non_food_lines: string[];
  model: string;
}

/** Ingredient as edited in the review screen. */
export interface EditableIngredient extends Ingredient {
  id: string;
  selected: boolean;
}

export type ScanLanguage = 'en' | 'fr';
