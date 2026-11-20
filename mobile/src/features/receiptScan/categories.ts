import type { Category } from './types';

export const CATEGORY_META: Record<Category, { label: string; emoji: string; order: number }> = {
  produce: { label: 'Produce', emoji: '🥬', order: 0 },
  meat_seafood: { label: 'Meat & seafood', emoji: '🍗', order: 1 },
  dairy_eggs: { label: 'Dairy & eggs', emoji: '🥛', order: 2 },
  bakery: { label: 'Bakery', emoji: '🥖', order: 3 },
  pantry: { label: 'Pantry', emoji: '🍚', order: 4 },
  spices_condiments: { label: 'Spices & condiments', emoji: '🧂', order: 5 },
  frozen: { label: 'Frozen', emoji: '🧊', order: 6 },
  beverages: { label: 'Beverages', emoji: '🧃', order: 7 },
  snacks: { label: 'Snacks', emoji: '🍪', order: 8 },
  other_food: { label: 'Other', emoji: '🍽️', order: 9 },
  non_food: { label: 'Non-food', emoji: '🧴', order: 10 },
};

export function formatQuantity(quantity: number | null, unit: string | null): string {
  if (quantity == null) return unit ?? '';
  const q = Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(2).replace(/\.?0+$/, '');
  if (!unit || unit === 'each') return `×${q}`;
  return `${q} ${unit}`;
}
