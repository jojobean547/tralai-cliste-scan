// Product categories: the icon shown for an item when there's no product photo.
// Icon names are from MaterialCommunityIcons (@expo/vector-icons), all checked to exist.

export type CategoryId =
  | 'fruit_veg' | 'bakery' | 'dairy_eggs' | 'meat_fish' | 'frozen' | 'cupboard'
  | 'snacks' | 'drinks' | 'household' | 'health_beauty' | 'baby' | 'pet';

export type Category = { id: CategoryId; label: string; icon: string };

export const CATEGORIES: Category[] = [
  { id: 'fruit_veg', label: 'Fruit & veg', icon: 'food-apple-outline' },
  { id: 'bakery', label: 'Bakery', icon: 'bread-slice-outline' },
  { id: 'dairy_eggs', label: 'Dairy & eggs', icon: 'cheese' },
  { id: 'meat_fish', label: 'Meat & fish', icon: 'food-drumstick-outline' },
  { id: 'frozen', label: 'Frozen', icon: 'snowflake' },
  { id: 'cupboard', label: 'Cupboard', icon: 'pasta' },
  { id: 'snacks', label: 'Snacks & sweets', icon: 'cookie-outline' },
  { id: 'drinks', label: 'Drinks', icon: 'bottle-soda-outline' },
  { id: 'household', label: 'Household', icon: 'spray-bottle' },
  { id: 'health_beauty', label: 'Health & beauty', icon: 'lotion-plus-outline' },
  { id: 'baby', label: 'Baby', icon: 'baby-bottle-outline' },
  { id: 'pet', label: 'Pet', icon: 'paw-outline' },
];

// Shown when no category has been picked
export const DEFAULT_ICON = 'basket-outline';

export function categoryIcon(id: CategoryId | null): string {
  return CATEGORIES.find((c) => c.id === id)?.icon ?? DEFAULT_ICON;
}

export function isCategoryId(value: unknown): value is CategoryId {
  return CATEGORIES.some((c) => c.id === value);
}
