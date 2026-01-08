"use client"
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Image, ActivityIndicator, TextInput, RefreshControl } from "react-native"
import { Colors } from "../../constants/Colors"
import { Typography } from "../../constants/Typography"
import { Spacing } from "../../constants/Spacing"
import { getAndroidTitleMargin } from "../../utils/responsive"
import useNavigationBar from "../../hooks/useNavigationBar"
import { doc, getDoc, getDocs, onSnapshot, updateDoc, serverTimestamp, deleteField } from "firebase/firestore";
import React, { useEffect, useState, useRef } from "react";
import { useRestaurant } from "../../contexts/RestaurantContext";
import { getRestaurantDoc, getRestaurantSubCollection, getRestaurantNestedCollection, getRestaurantSubDoc } from "../../utils/firestoreHelpers";
import { fetchActiveCategories, fetchArchivedCategories, fetchAllCategories, isCategoryArchived } from "../../utils/categoryHelpers";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { 
  cacheRecipesOffline, 
  getCachedRecipes, 
  isRecipesCacheValid, 
  updateRecipesCacheTimestamp 
} from '../../utils/offlineSync';
import { getNetworkStatus } from '../../utils/networkMonitor';

function RecipesScreen() {
  const restaurantContext = useRestaurant();
  // Safely destructure restaurantId with fallback
  const restaurantId = restaurantContext?.restaurantId || null;
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("All Recipes");
  const [recipesByCategory, setRecipesByCategory] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingFromCache, setLoadingFromCache] = useState(false);
  const [activeTab, setActiveTab] = useState('active'); // Active/Archived tab state

  // Hide Android navigation bar
  const navigationBar = useNavigationBar();
  navigationBar.useHidden(); // Use hidden mode for complete immersion
  const [search, setSearch] = useState(""); // <-- Add search state
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation();
  
  // Store unsubscribe functions for real-time listeners
  const unsubscribeRefs = useRef([]);
  const isSettingUpListeners = useRef(false);

  // Load from cache first, then fetch fresh data if needed
  const loadRecipesWithCaching = async (forceRefresh = false) => {
    if (!restaurantId) {
      console.log('No restaurantId available, skipping fetch');
      return;
    }

    // Check if we should use cache
    const cacheValid = await isRecipesCacheValid();
    const isOnline = getNetworkStatus();
    
    // Always try to load from cache first for instant display
    console.log('📚 Loading recipes from cache...');
    setLoadingFromCache(true);
    
    const { recipesByCategory: cachedRecipes, categories: cachedCategories } = await getCachedRecipes();
    
    if (Object.keys(cachedRecipes).length > 0) {
      setCategories(cachedCategories);
      setRecipesByCategory(cachedRecipes);
      setLoadingFromCache(false);
      
      if (!selectedCategory && cachedCategories.length > 0) {
        setSelectedCategory("All Recipes");
      }
      
      console.log(`📚 Loaded ${cachedRecipes["All Recipes"]?.length || 0} recipes from cache`);
      
      // If cache is valid and not forcing refresh, we're done
      if (cacheValid && !forceRefresh) {
        setLoading(false);
        setRefreshing(false);
        return;
      }
    } else {
      setLoadingFromCache(false);
    }

    // Fetch fresh data from server if needed
    if ((isOnline && (!cacheValid || forceRefresh)) || Object.keys(cachedRecipes).length === 0) {
      if (!loadingFromCache) setLoading(true);
      
      try {
        console.log('🌐 Fetching fresh recipes from server...');
        await fetchCategoriesAndRecipes();
        
      } catch (error) {
        console.error('❌ Error fetching fresh recipes:', error);
        // If we have cached data and fetch fails, keep using cache
        if (Object.keys(recipesByCategory).length === 0 && Object.keys(cachedRecipes).length > 0) {
          setCategories(cachedCategories);
          setRecipesByCategory(cachedRecipes);
          console.log('📚 Fallback to cached recipes after fetch error');
        }
      }
    }
    
    setLoading(false);
    setLoadingFromCache(false);
    setRefreshing(false);
  };

  // Fetch categories and all recipes from category documents with proper archived filtering
  const fetchCategoriesAndRecipes = async (showArchived = false) => {
    try {
      console.log(`Fetching ${showArchived ? 'archived' : 'active'} recipes for restaurantId:`, restaurantId);
      
      // Fetch categories based on tab (active or archived)
      const fetchedCategories = showArchived 
        ? await fetchArchivedCategories(restaurantId)
        : await fetchActiveCategories(restaurantId);
      
      // Ensure fetchedCategories is an array
      if (!Array.isArray(fetchedCategories)) {
        console.warn('fetchCategories did not return an array:', fetchedCategories);
        return;
      }
      
      console.log(`Found ${fetchedCategories.length} ${showArchived ? 'archived' : 'active'} categories`);
      
      const recipesObj = {};
      let allRecipes = [];

      // Get all categories to check archive status when filtering recipes
      const allCategories = await fetchAllCategories(restaurantId);
      
      // For archived tab: we need to fetch from ALL categories to find all archived recipes
      // For active tab: only fetch from active categories
      let categoriesToProcess = [];
      
      if (showArchived) {
        // For archived tab: get ALL categories (both active and archived) to find all archived recipes
        // This ensures we find archived recipes even if they're in active categories
        categoriesToProcess = allCategories;
        console.log(`📦 Processing ${categoriesToProcess.length} total categories to find archived recipes`);
        const archivedCats = allCategories.filter(c => c.archived === true);
        console.log(`📦 Archived categories: ${archivedCats.map(c => c.name).join(', ') || 'none'}`);
      } else {
        // For active tab: only process active categories
        categoriesToProcess = fetchedCategories;
      }

      // Process each category
      for (const categoryInfo of categoriesToProcess) {
        const categoryName = categoryInfo.name;
        const isCategoryArchived = categoryInfo.archived === true;
        
        // For active tab: skip archived categories
        if (!showArchived && isCategoryArchived) {
          continue;
        }

        try {
          // Fetch recipe documents - get all recipes, filter in memory based on archive status
          // Path: restaurants/{restaurantId}/recipes/categories/{categoryName}/
          const categoryCollectionRef = getRestaurantSubCollection(restaurantId, "recipes", "categories", categoryName);
          const categoryRecipesSnapshot = await getDocs(categoryCollectionRef);
          
          const categoryRecipes = [];
          categoryRecipesSnapshot.forEach(recipeDoc => {
            const recipeData = recipeDoc.data();
            const recipeArchived = recipeData.archived === true;
            
            // Filter based on recipe and category archive status
            if (showArchived) {
              // Archived tab: show recipe if category is archived OR recipe is archived
              if (!isCategoryArchived && !recipeArchived) {
                return; // Skip non-archived recipes from active categories
              }
            } else {
              // Active tab: skip if recipe is archived OR category is archived
              if (recipeArchived || isCategoryArchived) {
                return; // Skip archived recipes and recipes from archived categories
              }
            }
            
            const recipe = { 
              id: recipeDoc.id, 
              ...recipeData, 
              category: categoryName
            };
            categoryRecipes.push(recipe);
            allRecipes.push(recipe);
          });
          
          // For archived tab: include category even if empty (to show archived categories)
          // For active tab: only include if has recipes
          if (showArchived) {
            recipesObj[categoryName] = categoryRecipes;
          } else if (categoryRecipes.length > 0) {
            recipesObj[categoryName] = categoryRecipes;
          }
        } catch (categoryError) {
          console.error(`Error fetching recipes for category ${categoryName}:`, categoryError);
          // Still add empty array for archived categories in archived tab
          if (showArchived && isCategoryArchived) {
            recipesObj[categoryName] = [];
          }
        }
      }

      const newRecipesByCategory = { "All Recipes": allRecipes, ...recipesObj };
      
      // Set categories based on current tab (fetchedCategories already filtered)
      setCategories(fetchedCategories);
      
      setRecipesByCategory(newRecipesByCategory);
      
      // Cache only active recipes and categories
      if (!showArchived) {
        await cacheRecipesOffline(newRecipesByCategory, fetchedCategories);
        await updateRecipesCacheTimestamp();
      }
      
      if (!selectedCategory && fetchedCategories.length > 0) setSelectedCategory("All Recipes");
    } catch (error) {
      console.error("Error fetching categories/recipes:", error);
      throw error;
    }
  };

  // Setup real-time listeners for recipes
  const setupRealtimeListeners = () => {
    // Prevent concurrent listener setups
    if (isSettingUpListeners.current) {
      console.log('Listener setup already in progress, skipping...');
      return;
    }
    
    isSettingUpListeners.current = true;
    
    // Cleanup previous listeners FIRST - this must complete before setting up new ones
    if (Array.isArray(unsubscribeRefs.current)) {
      unsubscribeRefs.current.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') {
          try {
            unsubscribe();
          } catch (error) {
            console.warn('Error unsubscribing listener:', error);
          }
        }
      });
    }
    unsubscribeRefs.current = [];

    if (!restaurantId) {
      isSettingUpListeners.current = false;
      return;
    }

    // Fetch categories based on current tab
    // For archived tab, we need to listen to ALL categories to catch archived recipes
    const isArchived = activeTab === 'archived';
    
    // Get all categories to check archive status
    fetchAllCategories(restaurantId).then(allCategories => {
      // For archived tab: listen to all categories to catch all archived recipes
      // For active tab: only listen to active categories
      const categoriesToListen = isArchived 
        ? allCategories // Listen to all for archived tab
        : allCategories.filter(cat => cat.archived !== true); // Only active for active tab
      
      console.log(`🔔 Setting up listeners for ${categoriesToListen.length} categories (archived tab: ${isArchived})`);
      
      // Track which categories we've already set up listeners for to prevent duplicates
      const categoriesWithListeners = new Set();
      
      // For each category, set up a listener
      categoriesToListen.forEach(categoryInfo => {
        const categoryName = categoryInfo.name;
        const isCategoryArchived = categoryInfo.archived === true;
        
        // Skip archived categories for active tab
        if (!isArchived && isCategoryArchived) {
          return;
        }
        
        // Skip if we've already set up a listener for this category
        if (categoriesWithListeners.has(categoryName)) {
          return;
        }
        categoriesWithListeners.add(categoryName);
        
        const categoryCollectionRef = getRestaurantSubCollection(restaurantId, "recipes", "categories", categoryName);
        
        // Set up real-time listener - always listen to all recipes, filter in memory
        const unsubscribe = onSnapshot(categoryCollectionRef, (snapshot) => {
          setRecipesByCategory(prev => {
            // Ensure prev is an object
            const updated = prev && typeof prev === 'object' ? { ...prev } : {};
            const categoryRecipes = [];
            
            snapshot.forEach(recipeDoc => {
              const recipeData = recipeDoc.data();
              
              // Filter based on recipe and category archive status
              const recipeArchived = recipeData.archived === true;
              
              if (isArchived) {
                // Archived tab: show recipe if category is archived OR recipe is archived
                if (!isCategoryArchived && !recipeArchived) {
                  return; // Skip non-archived recipes from active categories
                }
              } else {
                // Active tab: skip if recipe is archived OR category is archived
                if (recipeArchived || isCategoryArchived) {
                  return; // Skip archived recipes and recipes from archived categories
                }
              }
              
              const recipe = {
                id: recipeDoc.id,
                ...recipeData,
                category: categoryName
              };
              categoryRecipes.push(recipe);
            });
            
            updated[categoryName] = categoryRecipes;
            
            // Recalculate "All Recipes" - need to filter based on category archive status
            let allRecipes = [];
            Object.keys(updated).forEach(key => {
              if (key !== "All Recipes" && Array.isArray(updated[key])) {
                const filteredRecipes = updated[key].filter(recipe => {
                  const recipeArchived = recipe.archived === true;
                  const categoryArchived = isCategoryArchived;
                  
                  if (isArchived) {
                    return categoryArchived || recipeArchived;
                  } else {
                    return !recipeArchived && !categoryArchived;
                  }
                });
                allRecipes = allRecipes.concat(filteredRecipes);
              }
            });
            updated["All Recipes"] = allRecipes;
            
            return updated;
          });
        }, (error) => {
          console.error(`Error in real-time listener for category ${categoryName}:`, error);
        });
        
        unsubscribeRefs.current.push(unsubscribe);
      });
      
      // Mark setup as complete
      isSettingUpListeners.current = false;
    }).catch(error => {
      console.error('Error setting up real-time listeners:', error);
      isSettingUpListeners.current = false;
    });
  };

  // Set up real-time listener for categories document
  useEffect(() => {
    if (!restaurantId) return;
    
    const categoriesDocRef = getRestaurantDoc(restaurantId, "recipes", "categories");
    
    // Listen to categories document changes
    const unsubscribeCategories = onSnapshot(categoriesDocRef, (doc) => {
      if (doc.exists()) {
        // When categories change, refresh the categories and recipes
        fetchCategoriesAndRecipes(activeTab === 'archived').catch(error => {
          console.error('Error refreshing after category change:', error);
        });
      }
    }, (error) => {
      console.error('Error in categories document listener:', error);
    });
    
    return () => {
      unsubscribeCategories();
    };
  }, [restaurantId, activeTab]);

  // Update recipes when tab changes
  useEffect(() => {
    if (!restaurantId) return;
    
    // Cleanup any existing listeners first
    if (Array.isArray(unsubscribeRefs.current)) {
      unsubscribeRefs.current.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') {
          try {
            unsubscribe();
          } catch (error) {
            // Ignore errors during cleanup
          }
        }
      });
      unsubscribeRefs.current = [];
    }
    
    setLoading(true);
    fetchCategoriesAndRecipes(activeTab === 'archived').then(() => {
      setLoading(false);
      setRefreshing(false);
      
      // Setup real-time listeners AFTER fetching initial data
      setupRealtimeListeners();
    }).catch(() => {
      setLoading(false);
      setRefreshing(false);
    });
    
    // Cleanup listeners on unmount or tab change
    return () => {
      if (Array.isArray(unsubscribeRefs.current)) {
        unsubscribeRefs.current.forEach(unsubscribe => {
          if (typeof unsubscribe === 'function') {
            try {
              unsubscribe();
            } catch (error) {
              // Ignore errors during cleanup
            }
          }
        });
        unsubscribeRefs.current = [];
      }
    };
  }, [restaurantId, activeTab]);

  // Swipe down to refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCategoriesAndRecipes(activeTab === 'archived');
    setRefreshing(false);
  };

  // Recipes to display (filtered by search)
  const recipes = (recipesByCategory[selectedCategory] || []).filter(recipe => {
    if (!search || search.trim() === "") return true; // Show all if no search
    
    // Get all possible name fields from the recipe
    const recipeName = recipe["recipe name"] || recipe.name || recipe.title || recipe.recipeName || "";
    const ingredients = recipe.ingredients || "";
    const description = recipe.description || "";
    const category = recipe.category || "";
    
    // Debug: Log recipe data for first few recipes when searching
    if (search && recipe === (recipesByCategory[selectedCategory] || [])[0]) {
      console.log('🔍 Search Debug - Recipe fields:', {
        'recipe name': recipe["recipe name"],
        name: recipe.name,
        title: recipe.title,
        recipeName: recipe.recipeName,
        searchTerm: search,
        allFields: Object.keys(recipe)
      });
    }
    
    // Create a searchable string with all relevant fields
    const searchableText = `${recipeName} ${ingredients} ${description} ${category}`.toLowerCase();
    const searchTerm = search.toLowerCase().trim();
    
    // Return true if any part matches
    return searchableText.includes(searchTerm);
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >

        <View style={styles.header}>
          <Text style={styles.title}>Recipe Library</Text>
          <View style={styles.subtitleContainer}>
            <Text style={styles.subtitle}>
              {recipesByCategory["All Recipes"] ? `${recipesByCategory["All Recipes"].length} ${activeTab === 'archived' ? 'Archived' : ''} Recipes` : "Loading..."}
            </Text>
            {loadingFromCache && (
              <Text style={styles.cacheIndicator}>📚 Loading from cache...</Text>
            )}
          </View>
        </View>
        
        {/* Active/Archived Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'active' && styles.activeTab]}
            onPress={() => setActiveTab('active')}
            activeOpacity={0.7}
          >
            <Ionicons 
              name="restaurant-outline" 
              size={18} 
              color={activeTab === 'active' ? Colors.background : Colors.textSecondary} 
              style={styles.tabIcon}
            />
            <Text style={[styles.tabText, activeTab === 'active' && styles.activeTabText]}>
              Active
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tab, activeTab === 'archived' && styles.activeTab]}
            onPress={() => setActiveTab('archived')}
            activeOpacity={0.7}
          >
            <Ionicons 
              name="archive-outline" 
              size={18} 
              color={activeTab === 'archived' ? Colors.background : Colors.textSecondary} 
              style={styles.tabIcon}
            />
            <Text style={[styles.tabText, activeTab === 'archived' && styles.activeTabText]}>
              Archived
            </Text>
          </TouchableOpacity>
        </View>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color={Colors.gray400} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search recipes..."
              placeholderTextColor={Colors.gray400}
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} style={styles.clearButton}>
                <Ionicons name="close-circle" size={20} color={Colors.gray400} />
              </TouchableOpacity>
            )}
          </View>
        </View>
        {/* Categories */}
        <View style={styles.categoriesContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
            <TouchableOpacity
              key="all"
              style={[
                styles.categoryChip,
                selectedCategory === "All Recipes" && styles.activeCategoryChip,
              ]}
              activeOpacity={0.7}
              onPress={() => setSelectedCategory("All Recipes")}
            >
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === "All Recipes" && styles.activeCategoryText,
                ]}
                >
                  All {activeTab === 'archived' ? 'Archived ' : ''}Recipes
                </Text>
            </TouchableOpacity>
            {categories.map(category => (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryChip,
                  selectedCategory === category.id && styles.activeCategoryChip,
                ]}
                activeOpacity={0.7}
                onPress={() => setSelectedCategory(category.id)}
              >
                <Text
                  style={[
                    styles.categoryText,
                    selectedCategory === category.id && styles.activeCategoryText,
                  ]}
                >
                  {category.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        {/* Recipes List */}
        <View style={styles.recipesContainer}>
          {loading && !loadingFromCache ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Loading recipes...</Text>
            </View>
          ) : (
            recipes.map(recipe => (
              <TouchableOpacity
                key={recipe.id}
                style={styles.recipeCard}
                activeOpacity={0.7}
                onPress={() => navigation.navigate("RecipeDetail", { recipeId: recipe.id, category: recipe.category })}
              >
                <Image 
                  source={{ 
                    uri: Array.isArray(recipe.image) && recipe.image.length > 0 
                      ? recipe.image[0] 
                      : recipe.image || "https://placehold.co/200x200?text=No+Image"
                  }} 
                  style={styles.recipeImage} 
                  resizeMode="cover" 
                />
                <View style={styles.recipeInfo}>
                  <Text style={styles.recipeName}>
                    {recipe["recipe name"] || recipe.name || recipe.title || recipe.recipeName || "Untitled Recipe"}
                  </Text>
                  <Text style={styles.recipeCategory}>{recipe.category}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg + getAndroidTitleMargin(),
    paddingBottom: Spacing.md,
  },
  appTitle: {
    fontSize: Typography.xxl,
    fontFamily: Typography.fontBold,
    color: Colors.primary,
    textAlign: 'center',
  },
  title: {
    fontSize: 22,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
  },
  date: {
    fontSize: Typography.md,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  subtitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  subtitle: {
    fontFamily: Typography.fontRegular,
    opacity: 0.7,
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
  cacheIndicator: {
    fontSize: Typography.xs,
    color: Colors.primary,
    fontFamily: Typography.fontMedium,
    fontStyle: 'italic',
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontFamily: Typography.fontRegular,
  },
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  searchBar: {
    backgroundColor: Colors.gray50,
    borderRadius: 12,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: Typography.base,
    fontFamily: Typography.fontRegular,
  },
  clearButton: {
    marginLeft: Spacing.sm,
    padding: 2,
  },
  cacheStatus: {
    fontSize: Typography.xs,
    color: Colors.primary,
    fontFamily: Typography.fontMedium,
    textAlign: 'center',
    marginTop: Spacing.xs,
    opacity: 0.7,
  },
  searchPlaceholder: {
    color: Colors.gray400,
    fontSize: Typography.base,
  },
  categoriesContainer: {
    marginBottom: Spacing.lg,
  },
  categoriesScroll: {
    paddingLeft: Spacing.lg,
  },
  sectionTitle: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  categoryChip: {
    backgroundColor: Colors.gray100,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: 50,
    marginRight: Spacing.sm,
  },
  activeCategoryChip: {
    backgroundColor: Colors.primary,
  },
  categoryText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.medium,
  },
  activeCategoryText: {
    color: Colors.background,
  },
  recipesContainer: {
    paddingHorizontal: Spacing.lg,
  },
  recipeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  recipeImage: {
    width: 100,
    height: 100,
    borderRadius: 15,
    backgroundColor: Colors.gray100,
    marginRight: Spacing.md,
  },
  recipeInfo: {
    flex: 1,
  },
  recipeName: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  recipeCategory: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  recipeTime: {
    fontSize: Typography.xs,
    color: Colors.gray400,
  },
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    backgroundColor: Colors.gray100,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: Colors.primary,
  },
  tabIcon: {
    marginRight: 6,
  },
  tabText: {
    fontSize: Typography.base,
    fontFamily: Typography.fontMedium,
    color: Colors.textSecondary,
  },
  activeTabText: {
    color: Colors.background,
    fontFamily: Typography.fontSemibold,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl * 2,
    paddingHorizontal: Spacing.lg,
  },
  emptyText: {
    fontSize: Typography.lg,
    fontFamily: Typography.fontMedium,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: Typography.base,
    fontFamily: Typography.fontRegular,
    color: Colors.gray400,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
})

export default RecipesScreen
