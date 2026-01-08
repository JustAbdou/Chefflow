import { getDoc, getDocs, query, where, collection, onSnapshot } from 'firebase/firestore';
import { getRestaurantDoc, getRestaurantCollection } from './firestoreHelpers';

/**
 * Fetch categories with proper archived filtering
 * Categories are stored as: { categories: [{ name: string, archived?: boolean, ... }], names: string[] }
 * 
 * @param {string} restaurantId - Restaurant ID
 * @param {boolean} showArchived - Whether to fetch archived categories (default: false)
 * @returns {Promise<Array>} Array of category objects with {id, name, archived, archivedAt, archivedBy}
 */
export const fetchCategories = async (restaurantId, showArchived = false) => {
  try {
    if (!restaurantId) return [];
    
    const categoryDoc = await getDoc(getRestaurantDoc(restaurantId, "recipes", "categories"));
    
    if (!categoryDoc.exists()) {
      return [];
    }
    
    const data = categoryDoc.data();
    let categories = [];
    
    // Check if categories are stored as array of objects
    if (data?.categories && Array.isArray(data.categories)) {
      categories = data.categories.map((cat, index) => {
        // Handle both object format and string format (backward compatibility)
        if (typeof cat === 'string') {
          return {
            id: cat,
            name: cat,
            archived: false,
            archivedAt: null,
            archivedBy: null
          };
        }
        return {
          id: cat.name || `category_${index}`,
          name: cat.name || cat,
          archived: cat.archived === true, // Explicitly check for true
          archivedAt: cat.archivedAt || null,
          archivedBy: cat.archivedBy || null
        };
      });
    } else if (data?.names && Array.isArray(data.names)) {
      // Fallback: Use names array (backward compatibility)
      categories = data.names.map(name => ({
        id: name,
        name: name,
        archived: false,
        archivedAt: null,
        archivedBy: null
      }));
      
      // Also check for archivedCategories array (old structure)
      if (data?.archivedCategories && Array.isArray(data.archivedCategories)) {
        // Mark archived categories
        categories = categories.map(cat => {
          if (data.archivedCategories.includes(cat.name)) {
            return { ...cat, archived: true };
          }
          return cat;
        });
      }
    }
    
    // Filter based on archived status
    if (showArchived) {
      return categories.filter(cat => cat.archived === true);
    } else {
      return categories.filter(cat => cat.archived !== true);
    }
    
  } catch (error) {
    console.error("Error fetching categories:", error);
    return [];
  }
};

/**
 * Get all categories (both active and archived)
 * @param {string} restaurantId - Restaurant ID
 * @returns {Promise<Array>} Array of all category objects
 */
export const fetchAllCategories = async (restaurantId) => {
  try {
    if (!restaurantId) return [];
    
    const categoryDoc = await getDoc(getRestaurantDoc(restaurantId, "recipes", "categories"));
    
    if (!categoryDoc.exists()) {
      return [];
    }
    
    const data = categoryDoc.data();
    let categories = [];
    
    if (data?.categories && Array.isArray(data.categories)) {
      categories = data.categories.map((cat, index) => {
        if (typeof cat === 'string') {
          return {
            id: cat,
            name: cat,
            archived: false,
            archivedAt: null,
            archivedBy: null
          };
        }
        return {
          id: cat.name || `category_${index}`,
          name: cat.name || cat,
          archived: cat.archived === true,
          archivedAt: cat.archivedAt || null,
          archivedBy: cat.archivedBy || null
        };
      });
    } else if (data?.names && Array.isArray(data.names)) {
      categories = data.names.map(name => ({
        id: name,
        name: name,
        archived: false,
        archivedAt: null,
        archivedBy: null
      }));
    }
    
    return categories;
  } catch (error) {
    console.error("Error fetching all categories:", error);
    return [];
  }
};

/**
 * Fetch only active (non-archived) categories
 * @param {string} restaurantId - Restaurant ID
 * @returns {Promise<Array>} Array of active category objects
 */
export const fetchActiveCategories = async (restaurantId) => {
  return fetchCategories(restaurantId, false);
};

/**
 * Fetch only archived categories
 * @param {string} restaurantId - Restaurant ID
 * @returns {Promise<Array>} Array of archived category objects
 */
export const fetchArchivedCategories = async (restaurantId) => {
  return fetchCategories(restaurantId, true);
};

/**
 * Check if a category is archived
 * @param {string} categoryName - Category name to check
 * @param {Array} categories - Array of category objects
 * @returns {boolean} True if category is archived
 */
export const isCategoryArchived = (categoryName, categories) => {
  const category = categories.find(cat => cat.name === categoryName);
  return category?.archived === true;
};

/**
 * Filter recipes based on recipe and category archive status
 * @param {Array} recipes - Array of recipe objects
 * @param {Array} categories - Array of category objects
 * @param {string} activeTab - 'active' or 'archived'
 * @returns {Array} Filtered recipes
 */
export const filterRecipesByArchiveStatus = (recipes, categories, activeTab) => {
  return recipes.filter(recipe => {
    const recipeArchived = recipe.archived === true;
    const categoryArchived = isCategoryArchived(recipe.category, categories);
    
    if (activeTab === 'archived') {
      // Archived tab: show recipes that are archived OR recipes from archived categories
      return recipeArchived || categoryArchived;
    } else {
      // Active tab: show recipes that are not archived AND not from archived categories
      return !recipeArchived && !categoryArchived;
    }
  });
};

