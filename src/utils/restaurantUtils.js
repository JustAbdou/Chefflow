// Restaurant ID utilities
// Firestore document IDs have certain restrictions, so we need to ensure valid names

/**
 * Converts a restaurant name to a valid Firestore document ID
 * @param {string} restaurantName - The restaurant name
 * @returns {string} - Valid Firestore document ID
 */
export const normalizeRestaurantName = (restaurantName) => {
  if (!restaurantName) return 'default-restaurant';
  
  return restaurantName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s\-_]/g, '') // Remove special characters except spaces, hyphens, underscores
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
};

/**
 * Predefined restaurant names for easy selection
 */
export const RESTAURANT_NAMES = {
  MARIOS_PIZZERIA: 'marios-pizzeria',
  JOES_CAFE: 'joes-cafe',
  DOWNTOWN_BISTRO: 'downtown-bistro',
  GOLDEN_DRAGON: 'golden-dragon',
  BURGER_PALACE: 'burger-palace',
  FINE_DINING: 'fine-dining-restaurant',
  FAMILY_KITCHEN: 'family-kitchen',
  STREET_FOOD: 'street-food-corner',
};

/**
 * Gets restaurant display name from ID
 * @param {string} restaurantId - The restaurant document ID
 * @returns {string} - Human readable name
 */
export const getRestaurantDisplayName = (restaurantId) => {
  const displayNames = {
    'marios-pizzeria': "Mario's Pizzeria",
    'joes-cafe': "Joe's Cafe", 
    'downtown-bistro': 'Downtown Bistro',
    'golden-dragon': 'Golden Dragon',
    'burger-palace': 'Burger Palace',
    'fine-dining-restaurant': 'Fine Dining Restaurant',
    'family-kitchen': 'Family Kitchen',
    'street-food-corner': 'Street Food Corner',
    'my-restaurant-name': 'My Restaurant',
  };
  
  return displayNames[restaurantId] || restaurantId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

/**
 * Validates if a restaurant ID is valid for Firestore
 * @param {string} restaurantId - The restaurant ID to validate
 * @returns {boolean} - Whether the ID is valid
 */
export const isValidRestaurantId = (restaurantId) => {
  if (!restaurantId || typeof restaurantId !== 'string') return false;
  if (restaurantId.length === 0 || restaurantId.length > 1500) return false;
  if (restaurantId === '.' || restaurantId === '..') return false;
  if (restaurantId.includes('/')) return false;
  
  return true;
};
