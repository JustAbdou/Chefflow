import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDocs } from 'firebase/firestore';
import { getRestaurantCollection } from './firestoreHelpers';

const CACHE_KEY = 'recipeCache';
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

let cachedData = {
  categories: [],
  recipesByCategory: {},
  lastUpdated: null,
  stats: { isValid: false, totalRecipes: 0, lastUpdated: null }
};

export const loadRecipeCache = async () => {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached) {
      cachedData = JSON.parse(cached);
      console.log('📱 Recipe cache loaded from storage');
      return true;
    }
  } catch (error) {
    console.warn('Failed to load recipe cache:', error);
  }
  return false;
};

export const saveRecipeCache = async (data) => {
  try {
    cachedData = { ...data, lastUpdated: Date.now() };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cachedData));
    console.log('💾 Recipe cache saved to storage');
  } catch (error) {
    console.warn('Failed to save recipe cache:', error);
  }
};

export const getCachedRecipes = () => {
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

export const getRecipeCacheStats = () => {
  return {
    isValid: cachedData.lastUpdated && (Date.now() - cachedData.lastUpdated) < CACHE_EXPIRY,
    totalRecipes: cachedData.recipesByCategory?.['All Recipes']?.length || 0,
    lastUpdated: cachedData.lastUpdated
  };
};

export const fetchAndCacheRecipes = async (restaurantId, forceRefresh = false) => {
  // Check if we have valid cached data and don't need to refresh
  if (!forceRefresh && cachedData.lastUpdated && (Date.now() - cachedData.lastUpdated) < CACHE_EXPIRY) {
    console.log('🔄 Using cached recipe data (still valid)');
    return {
      categories: cachedData.categories,
      recipesByCategory: cachedData.recipesByCategory,
      fromCache: true
    };
  }

  try {
    console.log('🌐 Fetching fresh recipe data from Firestore...');
    
    // Fetch all recipe categories
    const categoriesSnapshot = await getDocs(getRestaurantCollection(restaurantId, "recipes"));
    const categories = [];
    const recipesByCategory = { "All Recipes": [] };

    // Process each category
    for (const categoryDoc of categoriesSnapshot.docs) {
      const categoryData = categoryDoc.data();
      const categoryInfo = {
        id: categoryDoc.id,
        name: categoryData.name || categoryDoc.id,
        ...categoryData
      };
      
      categories.push(categoryInfo);
      
      // Initialize category in recipes object
      recipesByCategory[categoryDoc.id] = [];
      
      // Fetch recipes for this category
      try {
        const recipesSnapshot = await getDocs(getRestaurantCollection(restaurantId, `recipes/${categoryDoc.id}/items`));
        
        recipesSnapshot.docs.forEach(recipeDoc => {
          const recipeData = recipeDoc.data();
          const recipe = {
            id: recipeDoc.id,
            category: categoryInfo.name,
            categoryId: categoryDoc.id,
            ...recipeData
          };
          
          recipesByCategory[categoryDoc.id].push(recipe);
          recipesByCategory["All Recipes"].push(recipe);
        });
        
        console.log(`📝 Loaded ${recipesSnapshot.docs.length} recipes from category: ${categoryInfo.name}`);
      } catch (error) {
        console.warn(`Failed to fetch recipes for category ${categoryDoc.id}:`, error);
      }
    }

    // Save to cache
    const result = { categories, recipesByCategory };
    await saveRecipeCache(result);
    
    console.log(`✅ Fetched and cached ${categories.length} categories with ${recipesByCategory["All Recipes"].length} total recipes`);
    
    return { ...result, fromCache: false };
  } catch (error) {
    console.error('❌ Error fetching recipes:', error);
    
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

export const searchCachedRecipes = (searchTerm = '', selectedCategory = 'All Recipes') => {
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

export const clearRecipeCache = async () => {
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
    cachedData = {
      categories: [],
      recipesByCategory: {},
      lastUpdated: null,
      stats: { isValid: false, totalRecipes: 0, lastUpdated: null }
    };
    console.log('🗑️ Recipe cache cleared');
  } catch (error) {
    console.warn('Failed to clear recipe cache:', error);
  }
};