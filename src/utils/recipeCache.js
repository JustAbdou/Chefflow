import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDocs } from 'firebase/firestore';
import { getRestaurantSubCollection } from './firestoreHelpers';
import { fetchActiveCategories, fetchArchivedCategories } from './categoryHelpers';

const CACHE_KEY_PREFIX = 'RECIPES_CACHE';
const CACHE_TIMESTAMP_PREFIX = 'RECIPES_CACHE_TIMESTAMP';
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

// In-memory cache per restaurant
const cachedDataByRestaurant = {};

// Helper to get cache key for a restaurant
const getCacheKey = (restaurantId) => `${CACHE_KEY_PREFIX}_${restaurantId}`;
const getTimestampKey = (restaurantId) => `${CACHE_TIMESTAMP_PREFIX}_${restaurantId}`;

// Get cached data for a specific restaurant
const getCachedDataForRestaurant = (restaurantId) => {
  if (!cachedDataByRestaurant[restaurantId]) {
    cachedDataByRestaurant[restaurantId] = {
      categories: [],
      recipesByCategory: {},
      lastUpdated: null,
      stats: { isValid: false, totalRecipes: 0, lastUpdated: null }
    };
  }
  return cachedDataByRestaurant[restaurantId];
};

export const loadRecipeCache = async (restaurantId) => {
  if (!restaurantId) {
    console.warn('loadRecipeCache called without restaurantId');
    return false;
  }

  try {
    const cacheKey = getCacheKey(restaurantId);
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      cachedDataByRestaurant[restaurantId] = parsed;
      console.log(`📱 Recipe cache loaded from storage for restaurant: ${restaurantId}`);
      return true;
    }
  } catch (error) {
    console.warn('Failed to load recipe cache:', error);
  }
  return false;
};

export const saveRecipeCache = async (restaurantId, data) => {
  if (!restaurantId) {
    console.warn('saveRecipeCache called without restaurantId');
    return;
  }

  try {
    const cacheKey = getCacheKey(restaurantId);
    const timestampKey = getTimestampKey(restaurantId);
    const cacheData = { ...data, lastUpdated: Date.now() };
    
    cachedDataByRestaurant[restaurantId] = cacheData;
    await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
    await AsyncStorage.setItem(timestampKey, Date.now().toString());
    console.log(`💾 Recipe cache saved to storage for restaurant: ${restaurantId}`);
  } catch (error) {
    console.warn('Failed to save recipe cache:', error);
  }
};

export const getCachedRecipes = (restaurantId) => {
  if (!restaurantId) {
    console.warn('getCachedRecipes called without restaurantId');
    return {
      categories: [],
      recipesByCategory: {},
      stats: { isValid: false, totalRecipes: 0, lastUpdated: null }
    };
  }

  const cachedData = getCachedDataForRestaurant(restaurantId);
  return {
    categories: cachedData.categories || [],
    recipesByCategory: cachedData.recipesByCategory || {},
    stats: {
      isValid: cachedData.lastUpdated && (Date.now() - cachedData.lastUpdated) < CACHE_EXPIRY,
      totalRecipes: cachedData.recipesByCategory?.['All Recipes']?.length || 0,
      lastUpdated: cachedData.lastUpdated
    }
  };
};

export const getRecipeCacheStats = (restaurantId) => {
  if (!restaurantId) {
    return {
      isValid: false,
      totalRecipes: 0,
      lastUpdated: null
    };
  }

  const cachedData = getCachedDataForRestaurant(restaurantId);
  return {
    isValid: cachedData.lastUpdated && (Date.now() - cachedData.lastUpdated) < CACHE_EXPIRY,
    totalRecipes: cachedData.recipesByCategory?.['All Recipes']?.length || 0,
    lastUpdated: cachedData.lastUpdated
  };
};

export const fetchAndCacheRecipes = async (restaurantId, forceRefresh = false, includeArchived = false) => {
  if (!restaurantId) {
    throw new Error('restaurantId is required for fetchAndCacheRecipes');
  }

  const cachedData = getCachedDataForRestaurant(restaurantId);

  // Check if we have valid cached data and don't need to refresh
  if (!forceRefresh && cachedData.lastUpdated && (Date.now() - cachedData.lastUpdated) < CACHE_EXPIRY) {
    console.log(`🔄 Using cached recipe data (still valid) for restaurant: ${restaurantId}`);
    return {
      categories: cachedData.categories,
      recipesByCategory: cachedData.recipesByCategory,
      fromCache: true
    };
  }

  try {
    console.log(`🌐 Fetching fresh recipe data from Firestore for restaurant: ${restaurantId}...`);

    // Fetch active and archived categories separately
    const activeCategories = await fetchActiveCategories(restaurantId);
    const archivedCategories = includeArchived ? await fetchArchivedCategories(restaurantId) : [];

    // Combine all categories for fetching recipes
    const allCategories = [...activeCategories, ...archivedCategories];
    const recipesByCategory = { "All Recipes": [] };

    // Process each category
    for (const categoryInfo of allCategories) {
      const categoryName = categoryInfo.name;
      const isCategoryArchived = categoryInfo.archived === true;

      try {
        // Fetch recipes from: restaurants/{restaurantId}/recipes/categories/{categoryName}/
        const categoryCollectionRef = getRestaurantSubCollection(
          restaurantId,
          "recipes",
          "categories",
          categoryName
        );
        const categoryRecipesSnapshot = await getDocs(categoryCollectionRef);

        const categoryRecipes = [];
        categoryRecipesSnapshot.forEach(recipeDoc => {
          const recipeData = recipeDoc.data();
          const recipeArchived = recipeData.archived === true;

          // Only include active recipes unless includeArchived is true
          if (!includeArchived && (recipeArchived || isCategoryArchived)) {
            return; // Skip archived recipes/categories
          }

          const recipe = {
            id: recipeDoc.id,
            category: categoryName,
            ...recipeData
          };

          categoryRecipes.push(recipe);

          // Add to "All Recipes" only if not archived (or if we're including archived)
          if (!recipeArchived && !isCategoryArchived) {
            recipesByCategory["All Recipes"].push(recipe);
          }
        });

        // Only add category if it has recipes
        if (categoryRecipes.length > 0) {
          recipesByCategory[categoryName] = categoryRecipes;
        }

        console.log(`📝 Loaded ${categoryRecipes.length} recipes from category: ${categoryName}`);
      } catch (error) {
        console.warn(`Failed to fetch recipes for category ${categoryName}:`, error);
      }
    }

    // Save to cache
    const result = {
      categories: activeCategories, // Only cache active categories
      recipesByCategory
    };
    await saveRecipeCache(restaurantId, result);

    console.log(`✅ Fetched and cached ${activeCategories.length} categories with ${recipesByCategory["All Recipes"].length} total recipes for restaurant: ${restaurantId}`);

    return { ...result, fromCache: false };
  } catch (error) {
    console.error(`❌ Error fetching recipes for restaurant ${restaurantId}:`, error);

    // Return cached data if available
    if (cachedData.categories?.length > 0) {
      console.log('🔄 Returning stale cached data due to fetch error');
      return {
        categories: cachedData.categories,
        recipesByCategory: cachedData.recipesByCategory,
        fromCache: true
      };
    }

    throw error;
  }
};

export const searchCachedRecipes = (restaurantId, searchTerm = '', selectedCategory = 'All Recipes') => {
  if (!restaurantId) {
    console.warn('searchCachedRecipes called without restaurantId');
    return [];
  }

  const cachedData = getCachedDataForRestaurant(restaurantId);
  const recipes = cachedData.recipesByCategory?.[selectedCategory] || [];
  
  if (!searchTerm.trim()) {
    return recipes;
  }
  
  const term = searchTerm.toLowerCase().trim();
  
  return recipes.filter(recipe => {
    const name = recipe["recipe name"] || recipe.name || recipe.title || recipe.recipeName || '';
    const category = recipe.category || '';
    const ingredients = recipe.ingredients || [];
    
    // Search in recipe name
    if (name.toLowerCase().includes(term)) return true;
    
    // Search in category
    if (category.toLowerCase().includes(term)) return true;
    
    // Search in ingredients
    if (Array.isArray(ingredients)) {
      return ingredients.some(ingredient => 
        typeof ingredient === 'string' && ingredient.toLowerCase().includes(term)
      );
    }
    
    return false;
  });
};

export const clearRecipeCache = async (restaurantId = null) => {
  try {
    if (restaurantId) {
      // Clear cache for specific restaurant
      const cacheKey = getCacheKey(restaurantId);
      const timestampKey = getTimestampKey(restaurantId);
      await AsyncStorage.removeItem(cacheKey);
      await AsyncStorage.removeItem(timestampKey);
      delete cachedDataByRestaurant[restaurantId];
      console.log(`🗑️ Recipe cache cleared for restaurant: ${restaurantId}`);
    } else {
      // Clear all restaurant caches
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => 
        key.startsWith(CACHE_KEY_PREFIX) || key.startsWith(CACHE_TIMESTAMP_PREFIX)
      );
      await AsyncStorage.multiRemove(cacheKeys);
      Object.keys(cachedDataByRestaurant).forEach(key => {
        delete cachedDataByRestaurant[key];
      });
      console.log('🗑️ All recipe caches cleared');
    }
  } catch (error) {
    console.warn('Failed to clear recipe cache:', error);
  }
};