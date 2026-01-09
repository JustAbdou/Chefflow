"use client"
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, RefreshControl } from "react-native"
import { Image } from "expo-image"
import { Colors } from "../../constants/Colors"
import { Typography } from "../../constants/Typography"
import { Spacing } from "../../constants/Spacing"
import { getAndroidTitleMargin } from "../../utils/responsive"
import useNavigationBar from "../../hooks/useNavigationBar"
import { doc, getDoc, getDocs, onSnapshot, updateDoc, serverTimestamp, deleteField, query, where, orderBy, limit, startAfter, Timestamp } from "firebase/firestore";
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
  
  // Store unsubscribe function for current real-time listener
  const currentUnsubscribeRef = useRef(null);
  
  // Store all fetched recipes for "All Recipes" to enable pagination without re-fetching
  const allFetchedRecipesRef = useRef([]);
  
  // Separate state for "All Recipes" - independent of category aggregation
  const [allRecipes, setAllRecipes] = useState([]);
  const [allRecipesLastDoc, setAllRecipesLastDoc] = useState(null);
  const [allRecipesHasMore, setAllRecipesHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [allRecipesLoading, setAllRecipesLoading] = useState(false);

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

      // Process each category - DO NOT aggregate into "All Recipes"
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
            // DO NOT push to allRecipes - "All Recipes" has its own state and query
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

      // DO NOT include "All Recipes" - it has its own state managed separately
      const newRecipesByCategory = { ...recipesObj };
      
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

  // Fetch "All Recipes" with pagination - dedicated query, NOT aggregated from categories
  const fetchAllRecipes = async (reset = true) => {
    if (!restaurantId) return;
    
    const isArchived = activeTab === 'archived';
    const PAGE_SIZE = 30;
    
    // If loading more and we already have all recipes stored, just paginate from stored list
    if (!reset && allFetchedRecipesRef.current.length > 0) {
      const currentCount = allRecipes.length;
      const fetchedRecipes = allFetchedRecipesRef.current;
      
      // Safety check: if current count is already >= total in ref, we're done
      if (currentCount >= fetchedRecipes.length) {
        console.log(`📚 Already showing all recipes: ${currentCount} >= ${fetchedRecipes.length}`);
        setAllRecipesHasMore(false);
        return;
      }
      
      const nextBatch = fetchedRecipes.slice(currentCount, currentCount + PAGE_SIZE);
      const totalAfterLoad = currentCount + nextBatch.length;
      const hasMore = totalAfterLoad < fetchedRecipes.length;
      
      console.log(`📚 Load more: current=${currentCount}, total in ref=${fetchedRecipes.length}, next batch=${nextBatch.length}, will show=${totalAfterLoad}, hasMore=${hasMore}`);
      
      if (nextBatch.length > 0) {
        const recipesToShow = [...allRecipes, ...nextBatch];
        setAllRecipes(recipesToShow);
        setAllRecipesHasMore(hasMore);
        console.log(`📚 Updated: now showing ${recipesToShow.length} recipes, hasMore=${hasMore}`);
      } else {
        console.log(`📚 No more recipes to load (nextBatch is empty)`);
        setAllRecipesHasMore(false);
      }
      return;
    }
    
    setAllRecipesLoading(true);
    
    try {
      // Get categories for state (but don't fetch their recipes)
      const fetchedCategories = isArchived 
        ? await fetchArchivedCategories(restaurantId)
        : await fetchActiveCategories(restaurantId);
      setCategories(fetchedCategories);
      
      // Get all categories to query recipes from
      const allCategories = await fetchAllCategories(restaurantId);
      const categoriesToFetch = isArchived 
        ? allCategories
        : allCategories.filter(cat => cat.archived !== true);
      
      console.log(`📚 Fetching from ${categoriesToFetch.length} categories for "All Recipes"`);
      console.log(`📚 Category names: ${categoriesToFetch.map(c => c.name).join(', ')}`);
      
      let fetchedRecipes = [];
      
      // Query each category - fetch ALL recipes from ALL categories
      // We need all recipes to enable proper pagination
      for (const categoryInfo of categoriesToFetch) {
        const categoryName = categoryInfo.name;
        const isCategoryArchived = categoryInfo.archived === true;
        
        // Skip archived categories for active tab
        if (!isArchived && isCategoryArchived) {
          continue;
        }
        
        try {
          const categoryCollectionRef = getRestaurantSubCollection(restaurantId, "recipes", "categories", categoryName);
          
          // Always fetch ALL recipes from each category (no orderBy, no limit)
          // This ensures we get all recipes, even if some don't have updatedAt
          // We'll sort in memory after fetching
          const categoryRecipesSnapshot = await getDocs(categoryCollectionRef);
          const totalInCategory = categoryRecipesSnapshot.docs.length;
          console.log(`📚 Category "${categoryName}": fetched ${totalInCategory} recipes (total in category, isArchived=${isArchived}, isCategoryArchived=${isCategoryArchived})`);
          
          let addedCount = 0;
          let skippedArchived = 0;
          let skippedOther = 0;
          categoryRecipesSnapshot.forEach(recipeDoc => {
            const recipeData = recipeDoc.data();
            const recipeArchived = recipeData.archived === true;
            
            // Filter based on recipe and category archive status
            if (isArchived) {
              if (!isCategoryArchived && !recipeArchived) {
                skippedOther++;
                return; // Skip non-archived recipes from active categories
              }
            } else {
              if (recipeArchived || isCategoryArchived) {
                skippedArchived++;
                return; // Skip archived recipes and recipes from archived categories
              }
            }
            
            const updatedAt = recipeData.updatedAt || recipeData.createdAt || recipeData.created_at;
            
            const recipe = {
              id: recipeDoc.id,
              ...recipeData,
              category: categoryName,
              updatedAt: updatedAt || Timestamp.now()
            };
            fetchedRecipes.push(recipe);
            addedCount++;
          });
          console.log(`📚 Category "${categoryName}": added ${addedCount} recipes (skipped ${skippedArchived} archived, ${skippedOther} other)`);
        } catch (categoryError) {
          console.error(`❌ Error fetching recipes from category ${categoryName}:`, categoryError);
        }
      }
      
      console.log(`📚 Total recipes fetched from all categories: ${fetchedRecipes.length}`);
      
      // Sort all fetched recipes by updatedAt desc
      fetchedRecipes.sort((a, b) => {
        const aTime = a.updatedAt?.toMillis?.() || (a.updatedAt?.seconds ? a.updatedAt.seconds * 1000 : 0) || 0;
        const bTime = b.updatedAt?.toMillis?.() || (b.updatedAt?.seconds ? b.updatedAt.seconds * 1000 : 0) || 0;
        return bTime - aTime;
      });
      
      // Store all fetched recipes in ref for pagination
      allFetchedRecipesRef.current = fetchedRecipes;
      console.log(`📚 Stored ${fetchedRecipes.length} total recipes in ref for pagination`);
      
      // Handle reset vs load more
      let recipesToShow = [];
      if (reset) {
        // Take first PAGE_SIZE (or all if we have fewer)
        recipesToShow = fetchedRecipes.slice(0, PAGE_SIZE);
        console.log(`📚 After sorting and slicing to ${PAGE_SIZE}: ${recipesToShow.length} recipes to show`);
        
        // If we got fewer than PAGE_SIZE, we might need to fetch more aggressively
        if (recipesToShow.length < PAGE_SIZE && fetchedRecipes.length < PAGE_SIZE) {
          console.warn(`⚠️ Only got ${fetchedRecipes.length} recipes total. May need to fetch without limits or check filtering.`);
        }
        
        setAllRecipes(recipesToShow);
        setAllRecipesLastDoc(null);
        setAllRecipesHasMore(fetchedRecipes.length > PAGE_SIZE);
        console.log(`📚 Initial load: showing ${recipesToShow.length}, total available=${fetchedRecipes.length}, hasMore=${fetchedRecipes.length > PAGE_SIZE}`);
      } else {
        // Load more: take next PAGE_SIZE from already-fetched-and-sorted list
        const currentCount = allRecipes.length;
        const nextBatch = fetchedRecipes.slice(currentCount, currentCount + PAGE_SIZE);
        const totalAfterLoad = currentCount + nextBatch.length;
        const hasMore = totalAfterLoad < fetchedRecipes.length;
        
        console.log(`📚 Load more (in fetchAllRecipes): current=${currentCount}, total in ref=${fetchedRecipes.length}, next batch=${nextBatch.length}, will show=${totalAfterLoad}, hasMore=${hasMore}`);
        
        recipesToShow = [...allRecipes, ...nextBatch];
        setAllRecipes(recipesToShow);
        setAllRecipesHasMore(hasMore);
      }
      
      // Update last document for pagination
      if (recipesToShow.length > 0) {
        const lastRecipe = recipesToShow[recipesToShow.length - 1];
        setAllRecipesLastDoc({
          updatedAt: lastRecipe.updatedAt,
          id: lastRecipe.id
        });
      }
      
      console.log(`📚 Fetched ${recipesToShow.length} recipes for "All Recipes" (${reset ? 'initial' : 'more'})`);
    } catch (error) {
      console.error('Error fetching all recipes:', error);
    } finally {
      setAllRecipesLoading(false);
    }
  };

  // Load more recipes for "All Recipes"
  const loadMoreAllRecipes = async () => {
    if (loadingMore || !allRecipesHasMore || selectedCategory !== "All Recipes") {
      console.log(`📚 Load more blocked: loadingMore=${loadingMore}, hasMore=${allRecipesHasMore}, category=${selectedCategory}`);
      return;
    }
    
    console.log(`📚 Load more triggered: current count=${allRecipes.length}, ref count=${allFetchedRecipesRef.current.length}`);
    setLoadingMore(true);
    try {
      await fetchAllRecipes(false);
    } catch (error) {
      console.error('Error loading more recipes:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  // Setup real-time listener for a specific category
  const setupCategoryListener = (categoryName) => {
    if (!restaurantId || !categoryName || categoryName === "All Recipes") {
      return;
    }
    
    // Cleanup previous listener
    if (currentUnsubscribeRef.current) {
      try {
        currentUnsubscribeRef.current();
      } catch (error) {
        console.warn('Error unsubscribing previous listener:', error);
      }
      currentUnsubscribeRef.current = null;
    }
    
    // Get category info to check archive status
    fetchAllCategories(restaurantId).then(allCategories => {
      const categoryInfo = allCategories.find(cat => cat.name === categoryName);
      if (!categoryInfo) {
        console.warn(`Category ${categoryName} not found`);
        return;
      }
      
      const isCategoryArchived = categoryInfo.archived === true;
      const isArchived = activeTab === 'archived';
      
      // Skip archived categories for active tab
      if (!isArchived && isCategoryArchived) {
        console.log(`Skipping listener for archived category ${categoryName} on active tab`);
        return;
      }
      
      const categoryCollectionRef = getRestaurantSubCollection(restaurantId, "recipes", "categories", categoryName);
      
      console.log(`🔔 Setting up listener for category: ${categoryName}`);
      
      // Set up real-time listener for this specific category
      const unsubscribe = onSnapshot(categoryCollectionRef, (snapshot) => {
        setRecipesByCategory(prev => {
          const updated = prev && typeof prev === 'object' ? { ...prev } : {};
          const categoryRecipes = [];
          
          snapshot.forEach(recipeDoc => {
            const recipeData = recipeDoc.data();
            const recipeArchived = recipeData.archived === true;
            
            // Filter based on recipe and category archive status
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
          
          // DO NOT aggregate into "All Recipes" - it has its own state and query
          // "All Recipes" is managed separately via allRecipes state
          
          return updated;
        });
      }, (error) => {
        console.error(`Error in real-time listener for category ${categoryName}:`, error);
      });
      
      currentUnsubscribeRef.current = unsubscribe;
    }).catch(error => {
      console.error('Error setting up category listener:', error);
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

  // Update recipes when tab changes - fetch initial data
  useEffect(() => {
    if (!restaurantId) return;
    
    // Cleanup any existing listener
    if (currentUnsubscribeRef.current) {
      try {
        currentUnsubscribeRef.current();
      } catch (error) {
        // Ignore errors during cleanup
      }
      currentUnsubscribeRef.current = null;
    }
    
    setLoading(true);
    
    // If "All Recipes" is selected, use fetchAllRecipes (which also updates categories)
    // Otherwise, use fetchCategoriesAndRecipes
    if (selectedCategory === "All Recipes") {
      fetchAllRecipes(true).then(() => {
        setLoading(false);
        setRefreshing(false);
      }).catch(() => {
        setLoading(false);
        setRefreshing(false);
      });
    } else {
      fetchCategoriesAndRecipes(activeTab === 'archived').then(() => {
        setLoading(false);
        setRefreshing(false);
        
        // After fetching initial data, set up listener based on selectedCategory
        if (selectedCategory && selectedCategory !== "All Recipes") {
          setupCategoryListener(selectedCategory);
        }
      }).catch(() => {
        setLoading(false);
        setRefreshing(false);
      });
    }
    
    // Cleanup listener on unmount or tab change
    return () => {
      if (currentUnsubscribeRef.current) {
        try {
          currentUnsubscribeRef.current();
        } catch (error) {
          // Ignore errors during cleanup
        }
        currentUnsubscribeRef.current = null;
      }
    };
  }, [restaurantId, activeTab]);

  // Reset pagination when tab changes
  useEffect(() => {
    if (selectedCategory === "All Recipes") {
      setAllRecipesLastDoc(null);
      setAllRecipesHasMore(true);
      allFetchedRecipesRef.current = []; // Clear stored recipes when tab changes
    }
  }, [activeTab]);

  // Update listener when selectedCategory changes
  useEffect(() => {
    if (!restaurantId) return;
    
    // Cleanup previous listener
    if (currentUnsubscribeRef.current) {
      try {
        currentUnsubscribeRef.current();
      } catch (error) {
        console.warn('Error unsubscribing previous listener:', error);
      }
      currentUnsubscribeRef.current = null;
    }
    
    if (selectedCategory === "All Recipes") {
      // For "All Recipes", do a paginated fetch (no real-time listener)
      console.log('📚 "All Recipes" selected - fetching first 30 recipes');
      // Reset pagination state
      setAllRecipesLastDoc(null);
      setAllRecipesHasMore(true);
      setAllRecipes([]); // Clear previous recipes
      allFetchedRecipesRef.current = []; // Clear stored recipes
      fetchAllRecipes(true); // Reset pagination
      // Ensure no category listener is running
      if (currentUnsubscribeRef.current) {
        try {
          currentUnsubscribeRef.current();
        } catch (error) {
          console.warn('Error unsubscribing category listener:', error);
        }
        currentUnsubscribeRef.current = null;
      }
    } else if (selectedCategory) {
      // For specific category, set up real-time listener
      // Clear allRecipes when switching away from "All Recipes"
      setAllRecipes([]);
      setupCategoryListener(selectedCategory);
    }
    
    // Cleanup on unmount or category change
    return () => {
      if (currentUnsubscribeRef.current) {
        try {
          currentUnsubscribeRef.current();
        } catch (error) {
          // Ignore errors during cleanup
        }
        currentUnsubscribeRef.current = null;
      }
    };
  }, [selectedCategory, restaurantId, activeTab]);

  // Swipe down to refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    
    if (selectedCategory === "All Recipes") {
      // Refresh "All Recipes" with paginated fetch (reset)
      allFetchedRecipesRef.current = []; // Clear stored recipes on refresh
      await fetchAllRecipes(true);
    } else {
      // Refresh specific category
      await fetchCategoriesAndRecipes(activeTab === 'archived');
      // Re-setup listener for current category
      if (selectedCategory && selectedCategory !== "All Recipes") {
        setupCategoryListener(selectedCategory);
      }
    }
    
    setRefreshing(false);
  };

  // Recipes to display (filtered by search)
  // Use allRecipes state when "All Recipes" is selected, otherwise use recipesByCategory
  const recipesToFilter = selectedCategory === "All Recipes" 
    ? allRecipes 
    : (recipesByCategory[selectedCategory] || []);
  
  const recipes = recipesToFilter.filter(recipe => {
    if (!search || search.trim() === "") return true; // Show all if no search
    
    // Get all possible name fields from the recipe
    const recipeName = recipe["recipe name"] || recipe.name || recipe.title || recipe.recipeName || "";
    const ingredients = recipe.ingredients || "";
    const description = recipe.description || "";
    const category = recipe.category || "";
    
    // Debug: Log recipe data for first few recipes when searching
    if (search && recipe === recipesToFilter[0]) {
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
              {selectedCategory === "All Recipes" 
                ? `${allRecipes.length} ${activeTab === 'archived' ? 'Archived' : ''} Recipes`
                : recipesByCategory[selectedCategory] 
                  ? `${recipesByCategory[selectedCategory].length} ${activeTab === 'archived' ? 'Archived' : ''} Recipes`
                  : "Loading..."}
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
          {(loading || (selectedCategory === "All Recipes" && allRecipesLoading)) && !loadingFromCache ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Loading recipes...</Text>
            </View>
          ) : (
            <>
            {recipes.map(recipe => (
              <TouchableOpacity
                key={recipe.id}
                style={styles.recipeCard}
                activeOpacity={0.7}
                onPress={() => navigation.navigate("RecipeDetail", { recipeId: recipe.id, category: recipe.category })}
              >
                <Image 
                  source={{ 
                    uri: (() => {
                      // Prefer thumbnail if available
                      if (recipe.thumbs) {
                        const thumbs = Array.isArray(recipe.thumbs) ? recipe.thumbs : [recipe.thumbs];
                        if (thumbs.length > 0 && thumbs[0]) return thumbs[0];
                      }
                      if (recipe.thumb) return recipe.thumb;
                      // Fallback to full image
                      if (Array.isArray(recipe.image) && recipe.image.length > 0) {
                        return recipe.image[0];
                      }
                      return recipe.image || "https://placehold.co/200x200?text=No+Image";
                    })()
                  }} 
                  style={styles.recipeImage} 
                  contentFit="cover"
                  cachePolicy="disk"
                  placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
                  transition={200}
                />
                <View style={styles.recipeInfo}>
                  <Text style={styles.recipeName}>
                    {recipe["recipe name"] || recipe.name || recipe.title || recipe.recipeName || "Untitled Recipe"}
                  </Text>
                  <Text style={styles.recipeCategory}>{recipe.category}</Text>
                </View>
              </TouchableOpacity>
            ))}
            
            {/* Load More Button for All Recipes */}
            {selectedCategory === "All Recipes" && allRecipesHasMore && (
              <TouchableOpacity
                style={styles.loadMoreButton}
                onPress={loadMoreAllRecipes}
                disabled={loadingMore}
                activeOpacity={0.7}
              >
                {loadingMore ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <Text style={styles.loadMoreText}>Load More Recipes</Text>
                )}
              </TouchableOpacity>
            )}
            </>
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
  recipeImagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 15,
    backgroundColor: Colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
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
  loadMoreButton: {
    backgroundColor: Colors.gray100,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  loadMoreText: {
    fontSize: Typography.base,
    fontFamily: Typography.fontMedium,
    color: Colors.primary,
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
