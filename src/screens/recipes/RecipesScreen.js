"use client"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, RefreshControl } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Image } from "expo-image"
import { Colors } from "../../constants/Colors"
import { Typography } from "../../constants/Typography"
import { Spacing } from "../../constants/Spacing"
import { getAndroidTitleMargin } from "../../utils/responsive"
import useNavigationBar from "../../hooks/useNavigationBar"
import { doc, getDoc, getDocs, onSnapshot, updateDoc, serverTimestamp, deleteField, query, where, orderBy, limit, startAfter, Timestamp } from "firebase/firestore";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRestaurant } from "../../contexts/RestaurantContext";
import { getRestaurantDoc, getRestaurantSubCollection, getRestaurantNestedCollection, getRestaurantSubDoc } from "../../utils/firestoreHelpers";
import { fetchActiveCategories, fetchArchivedCategories, fetchAllCategories, isCategoryArchived } from "../../utils/categoryHelpers";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import {
  getCachedRecipes,
  saveRecipeCache,
  fetchAndCacheRecipes,
  getRecipeCacheStats,
  loadRecipeCache
} from '../../utils/recipeCache';
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
  const [totalRecipesCount, setTotalRecipesCount] = useState(0); // Total count of all recipes
  const [searchResults, setSearchResults] = useState([]); // Store search results from database
  const [searching, setSearching] = useState(false); // Track if we're searching the database

  // Load from cache first, then fetch fresh data if needed
  const loadRecipesWithCaching = async (forceRefresh = false) => {
    if (!restaurantId) {
      return;
    }

    try {
      // First, load cache from AsyncStorage into memory if not already loaded
      await loadRecipeCache(restaurantId);

      // Check cache validity
      const cacheStats = getRecipeCacheStats(restaurantId);
      const isOnline = getNetworkStatus();

      // Get cached data (from in-memory cache)
      const { recipesByCategory: cachedRecipes, categories: cachedCategories } = getCachedRecipes(restaurantId);

      // Display cached data immediately if available
      if (Object.keys(cachedRecipes).length > 0) {
        setLoadingFromCache(true);
        setCategories(cachedCategories);
        setRecipesByCategory(cachedRecipes);
        setLoadingFromCache(false);

        if (!selectedCategory && cachedCategories.length > 0) {
          setSelectedCategory("All Recipes");
        }

        // If cache is valid and not forcing refresh, we're done
        if (cacheStats.isValid && !forceRefresh) {
          console.log(`✅ Using valid cache (${cacheStats.totalRecipes} recipes)`);
          setLoading(false);
          setRefreshing(false);
          return;
        }
      }

      // Fetch fresh data if needed (cache invalid, forced refresh, or no cache)
      if ((isOnline && (!cacheStats.isValid || forceRefresh)) || Object.keys(cachedRecipes).length === 0) {
        if (Object.keys(cachedRecipes).length === 0) {
          setLoading(true); // Show loading only if no cached data
        }

        try {
          const result = await fetchAndCacheRecipes(restaurantId, forceRefresh);
          setCategories(result.categories);
          setRecipesByCategory(result.recipesByCategory);

          if (!selectedCategory && result.categories.length > 0) {
            setSelectedCategory("All Recipes");
          }
        } catch (error) {
          console.error('❌ Error fetching fresh recipes:', error);
          // Keep using cached data if fetch fails
        }
      }
    } catch (error) {
      console.error('❌ Error in loadRecipesWithCaching:', error);
    } finally {
      setLoading(false);
      setLoadingFromCache(false);
      setRefreshing(false);
    }
  };

  // Fetch categories and all recipes from category documents with proper archived filtering
  const fetchCategoriesAndRecipes = async (showArchived = false) => {
    try {
      // Fetch categories based on tab (active or archived)
      const fetchedCategories = showArchived 
        ? await fetchArchivedCategories(restaurantId)
        : await fetchActiveCategories(restaurantId);
      
      // Ensure fetchedCategories is an array
      if (!Array.isArray(fetchedCategories)) {
        console.warn('fetchCategories did not return an array');
        return;
      }
      
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
      // For archived tab, we skip caching entirely - just read fresh from DB
      if (!showArchived) {
        const { recipesByCategory: existingCache } = getCachedRecipes(restaurantId);
        await saveRecipeCache(restaurantId, {
          categories: fetchedCategories,
          recipesByCategory: {
            ...existingCache, // Keep existing cached data (like "All Recipes")
            ...newRecipesByCategory // Update with new category data
          }
        });
      }
      // Note: If showArchived === true, we don't touch cache at all

      if (!selectedCategory && fetchedCategories.length > 0) setSelectedCategory("All Recipes");
    } catch (error) {
      console.error("Error fetching categories/recipes:", error);
      throw error;
    }
  };

  // Fetch "All Recipes" with true Firestore pagination
  // Since category subcollections have different names, we query each category separately
  // with proper Firestore pagination and combine results
  // 
  // REQUIRED FIRESTORE INDEXES:
  // For each category subcollection (e.g., "Main", "Desserts", "Starters"):
  // - Collection: restaurants/{restaurantId}/recipes/categories/{categoryName}
  // - Fields: restaurantId (Ascending), archived (Ascending), updatedAt (Descending)
  // Firestore will prompt to create these indexes automatically if missing
  const fetchAllRecipes = async (reset = true) => {
    if (!restaurantId) return;
    
    const isArchived = activeTab === 'archived';
    const PAGE_SIZE = 30;
    
    setAllRecipesLoading(true);
    
    try {
      // Get categories for state
      const fetchedCategories = isArchived 
        ? await fetchArchivedCategories(restaurantId)
        : await fetchActiveCategories(restaurantId);
      setCategories(fetchedCategories);
      
      // Get all categories to query recipes from
      const allCategories = await fetchAllCategories(restaurantId);
      const categoriesToFetch = isArchived 
        ? allCategories
        : allCategories.filter(cat => cat.archived !== true);
      
      let allFetchedRecipes = [];
      let indexWarningsShown = new Set(); // Track which categories we've warned about
      
      // Query each category with proper Firestore pagination
      // Since subcollections have different names, we query each separately
      for (const categoryInfo of categoriesToFetch) {
        const categoryName = categoryInfo.name;
        const isCategoryArchived = categoryInfo.archived === true;
        
        // Skip archived categories for active tab
        if (!isArchived && isCategoryArchived) {
          continue;
        }
        
        try {
          const categoryCollectionRef = getRestaurantSubCollection(
            restaurantId, 
            "recipes", 
            "categories", 
            categoryName
          );
          
          // Try to build query with proper filters and ordering
          // First check if restaurantId field exists on recipes (many may not have it yet)
          // Fetch more per category to ensure we have enough after combining
          let categoryQuery;
          try {
            categoryQuery = query(
              categoryCollectionRef,
              where("restaurantId", "==", restaurantId),
              where("archived", "==", isArchived),
              orderBy("updatedAt", "desc"),
              limit(PAGE_SIZE * 3) // Fetch more to account for combining across categories
            );
          } catch (queryError) {
            // If query building fails, throw to trigger fallback
            throw queryError;
          }
          
          const categorySnapshot = await getDocs(categoryQuery);
          
          categorySnapshot.docs.forEach(recipeDoc => {
            const recipeData = recipeDoc.data();
            const recipe = {
              id: recipeDoc.id,
              ...recipeData,
              category: categoryName,
              updatedAt: recipeData.updatedAt || recipeData.createdAt || Timestamp.now()
            };
            allFetchedRecipes.push(recipe);
          });
          
        } catch (categoryError) {
          // If query fails (e.g., missing index or restaurantId field), try fallback
          // Track which categories we've warned about (no logging to avoid performance impact)
          if (!indexWarningsShown.has(categoryName)) {
            const isIndexError = categoryError.message?.includes('index');
            if (isIndexError) {
              indexWarningsShown.add(categoryName);
            }
          }
          try {
            const categoryCollectionRef = getRestaurantSubCollection(
              restaurantId, 
              "recipes", 
              "categories", 
              categoryName
            );
            // Fallback: query recipes without filters/ordering that require indexes
            // Fetch more to account for in-memory filtering (will filter out many)
            // Use a reasonable limit to avoid fetching everything
            const fallbackLimit = Math.max(PAGE_SIZE * 10, 100); // Fetch at least 100 or 10x page size
            const fallbackSnapshot = await getDocs(query(categoryCollectionRef, limit(fallbackLimit)));
            let addedFromFallback = 0;
            fallbackSnapshot.docs.forEach(recipeDoc => {
              const recipeData = recipeDoc.data();
              const recipeArchived = recipeData.archived === true;
              
              // Filter in memory: only include matching recipes
              if (isArchived) {
                // Archived tab: show if recipe is archived
                if (!recipeArchived) return;
              } else {
                // Active tab: skip archived recipes
                if (recipeArchived) return;
              }
              
              // Only include if restaurantId matches or is missing (legacy recipes)
              if (recipeData.restaurantId && recipeData.restaurantId !== restaurantId) {
                return;
              }
              
              const recipe = {
                id: recipeDoc.id,
                ...recipeData,
                category: categoryName,
                updatedAt: recipeData.updatedAt || recipeData.createdAt || Timestamp.now()
              };
              allFetchedRecipes.push(recipe);
              addedFromFallback++;
            });
          } catch (fallbackError) {
            // Only log fallback errors if they're not index-related
            if (!fallbackError.message?.includes('index')) {
              console.error(`❌ Error fetching recipes from category ${categoryName}:`, fallbackError.message);
            }
          }
        }
      }
      
      // Sort all fetched recipes by updatedAt desc
      allFetchedRecipes.sort((a, b) => {
        const aTime = a.updatedAt?.toMillis?.() || (a.updatedAt?.seconds ? a.updatedAt.seconds * 1000 : 0) || 0;
        const bTime = b.updatedAt?.toMillis?.() || (b.updatedAt?.seconds ? b.updatedAt.seconds * 1000 : 0) || 0;
        return bTime - aTime;
      });
      
      // Dedupe by recipe id
      const uniqueRecipes = [];
      const seenIds = new Set();
      for (const recipe of allFetchedRecipes) {
        if (!seenIds.has(recipe.id)) {
          seenIds.add(recipe.id);
          uniqueRecipes.push(recipe);
        }
      }
      
      // Handle reset vs load more with proper pagination
      let recipesToShow = [];
      if (reset) {
        // Reset: take first PAGE_SIZE
        recipesToShow = uniqueRecipes.slice(0, PAGE_SIZE);
        setAllRecipes(recipesToShow);
        setAllRecipesLastDoc(null);
        setAllRecipesHasMore(uniqueRecipes.length > PAGE_SIZE);
        
        // Store remaining recipes for load more (in-memory pagination)
        allFetchedRecipesRef.current = uniqueRecipes.slice(PAGE_SIZE);

        // Update cache with "All Recipes" data ONLY for active recipes, not archived
        if (!isArchived) {
          const { recipesByCategory: existingCache, categories: existingCategories } = getCachedRecipes(restaurantId);
          await saveRecipeCache(restaurantId, {
            categories: existingCategories || fetchedCategories,
            recipesByCategory: {
              ...existingCache,
              "All Recipes": uniqueRecipes // Cache all fetched recipes, not just page 1
            }
          });
        }
        // Note: If isArchived === true, we skip caching entirely

        // For total count, we'll need to estimate or do a count query
        // For now, estimate based on fetched results
        setTotalRecipesCount(uniqueRecipes.length > PAGE_SIZE ? uniqueRecipes.length : uniqueRecipes.length);
      } else {
        // Load more: use stored recipes from ref first
        if (allFetchedRecipesRef.current.length > 0) {
          const nextBatch = allFetchedRecipesRef.current.slice(0, PAGE_SIZE);
          recipesToShow = [...allRecipes, ...nextBatch];
          allFetchedRecipesRef.current = allFetchedRecipesRef.current.slice(PAGE_SIZE);
          setAllRecipesHasMore(allFetchedRecipesRef.current.length > 0 || uniqueRecipes.length > PAGE_SIZE);
        } else {
          // No more in ref, append from new fetch
          const nextBatch = uniqueRecipes.slice(0, PAGE_SIZE);
          recipesToShow = [...allRecipes, ...nextBatch];
          allFetchedRecipesRef.current = uniqueRecipes.slice(PAGE_SIZE);
          setAllRecipesHasMore(uniqueRecipes.length > PAGE_SIZE);
        }
        setAllRecipes(recipesToShow);
      }
      
      // Update last document for pagination tracking
      if (recipesToShow.length > 0) {
        const lastRecipe = recipesToShow[recipesToShow.length - 1];
        setAllRecipesLastDoc({
          updatedAt: lastRecipe.updatedAt,
          id: lastRecipe.id
        });
      }
      
    } catch (error) {
      console.error('❌ Error fetching all recipes:', error);
    } finally {
      setAllRecipesLoading(false);
    }
  };

  // Search recipes across the entire database
  const searchRecipesInDatabase = useCallback(async (searchTerm) => {
    if (!restaurantId || !searchTerm || !searchTerm.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    try {
      const isArchived = activeTab === 'archived';
      const searchLower = searchTerm.toLowerCase().trim();
      
      // Get all categories to search through
      const allCategories = await fetchAllCategories(restaurantId);
      const categoriesToSearch = isArchived 
        ? allCategories
        : allCategories.filter(cat => cat.archived !== true);
      
      const matchingRecipes = [];
      
      // Search through each category
      for (const categoryInfo of categoriesToSearch) {
        const categoryName = categoryInfo.name;
        const isCategoryArchived = categoryInfo.archived === true;
        
        // Skip archived categories for active tab
        if (!isArchived && isCategoryArchived) {
          continue;
        }
        
        try {
          const categoryCollectionRef = getRestaurantSubCollection(
            restaurantId, 
            "recipes", 
            "categories", 
            categoryName
          );
          
          // Fetch all recipes from this category (for search, we need all recipes)
          // Use a high limit to get all recipes for searching
          const categorySnapshot = await getDocs(query(categoryCollectionRef, limit(1000)));
          
          categorySnapshot.docs.forEach(recipeDoc => {
            const recipeData = recipeDoc.data();
            const recipeArchived = recipeData.archived === true;
            
            // Filter based on archive status
            if (isArchived) {
              // Archived tab: show if recipe is archived
              if (!recipeArchived) return;
            } else {
              // Active tab: skip archived recipes
              if (recipeArchived) return;
            }
            
            // Get all possible name fields from the recipe
            const recipeName = recipeData["recipe name"] || recipeData.name || recipeData.title || recipeData.recipeName || "";
            const ingredients = recipeData.ingredients || "";
            const description = recipeData.description || "";
            const category = categoryName || "";
            
            // Create a searchable string with all relevant fields
            const searchableText = `${recipeName} ${ingredients} ${description} ${category}`.toLowerCase();
            
            // Check if search term matches
            if (searchableText.includes(searchLower)) {
              const recipe = {
                id: recipeDoc.id,
                ...recipeData,
                category: categoryName,
                updatedAt: recipeData.updatedAt || recipeData.createdAt || Timestamp.now()
              };
              matchingRecipes.push(recipe);
            }
          });
        } catch (categoryError) {
          console.error(`Error searching recipes in category ${categoryName}:`, categoryError);
        }
      }
      
      // Sort by updatedAt desc
      matchingRecipes.sort((a, b) => {
        const aTime = a.updatedAt?.toMillis?.() || (a.updatedAt?.seconds ? a.updatedAt.seconds * 1000 : 0) || 0;
        const bTime = b.updatedAt?.toMillis?.() || (b.updatedAt?.seconds ? b.updatedAt.seconds * 1000 : 0) || 0;
        return bTime - aTime;
      });
      
      setSearchResults(matchingRecipes);
    } catch (error) {
      console.error('❌ Error searching recipes:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [restaurantId, activeTab]);

  // Load more recipes for "All Recipes"
  const loadMoreAllRecipes = async () => {
    if (loadingMore || !allRecipesHasMore || selectedCategory !== "All Recipes") {
      return;
    }
    
    setLoadingMore(true);
    try {
      // First try to use cached recipes from ref
      if (allFetchedRecipesRef.current.length > 0) {
        const nextBatch = allFetchedRecipesRef.current.slice(0, 30);
        setAllRecipes([...allRecipes, ...nextBatch]);
        allFetchedRecipesRef.current = allFetchedRecipesRef.current.slice(30);
        setAllRecipesHasMore(allFetchedRecipesRef.current.length > 0);
      } else {
        // No cached recipes, fetch more from Firestore
        await fetchAllRecipes(false);
      }
    } catch (error) {
      console.error('❌ Error loading more recipes:', error);
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
        return;
      }
      
      const isCategoryArchived = categoryInfo.archived === true;
      const isArchived = activeTab === 'archived';
      
      // Skip archived categories for active tab
      if (!isArchived && isCategoryArchived) {
        return;
      }
      
      const categoryCollectionRef = getRestaurantSubCollection(restaurantId, "recipes", "categories", categoryName);
      
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

    // For active tab, use cache-first approach
    // For archived tab, always fetch fresh (since archived recipes aren't cached)
    if (activeTab === 'active') {
      // Use cache-first loading for active recipes
      loadRecipesWithCaching(false).then(() => {
        // After loading, set up listener if a specific category is selected
        if (selectedCategory && selectedCategory !== "All Recipes") {
          setupCategoryListener(selectedCategory);
        }
      }).catch(error => {
        console.error('Error loading recipes:', error);
        setLoading(false);
        setRefreshing(false);
      });
    } else {
      // Archived tab - fetch fresh data
      setLoading(true);

      if (selectedCategory === "All Recipes") {
        fetchAllRecipes(true).then(() => {
          setLoading(false);
          setRefreshing(false);
        }).catch(() => {
          setLoading(false);
          setRefreshing(false);
        });
      } else {
        fetchCategoriesAndRecipes(true).then(() => {
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
      setAllRecipes([]); // Clear displayed recipes when tab changes
      allFetchedRecipesRef.current = []; // Clear stored recipes when tab changes
      setTotalRecipesCount(0); // Reset total count
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
      // Only fetch if we don't already have "All Recipes" loaded
      const needsLoading = allRecipes.length === 0;

      if (needsLoading) {
        // Reset pagination state
        setAllRecipesLastDoc(null);
        setAllRecipesHasMore(true);
        allFetchedRecipesRef.current = []; // Clear stored recipes
        setTotalRecipesCount(0); // Reset total count

        // Load from cache first for instant display - ONLY for active tab
        if (activeTab === 'active') {
          const { recipesByCategory } = getCachedRecipes(restaurantId);
          if (recipesByCategory["All Recipes"]?.length > 0) {
            // Show first 30 from cache
            const cachedPage1 = recipesByCategory["All Recipes"].slice(0, 30);
            setAllRecipes(cachedPage1);
          }
        }
        // Fetch fresh data for pagination
        fetchAllRecipes(true); // Reset pagination
      }

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
      // Keep allRecipes in memory for instant switching back
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

  // Refresh recipes when screen comes into focus (e.g., after archiving/restoring from detail screen)
  useFocusEffect(
    useCallback(() => {
      if (!restaurantId) return;

      // For archived tab, skip cache entirely - just fetch fresh data
      if (activeTab === 'archived') {
        console.log('📱 Archived tab: fetching fresh data (no cache)');
        if (selectedCategory === "All Recipes") {
          allFetchedRecipesRef.current = [];
          setTotalRecipesCount(0);
          fetchAllRecipes(true).catch(error => {
            console.error('Error refreshing all recipes:', error);
          });
        } else {
          fetchCategoriesAndRecipes(true).then(() => {
            if (selectedCategory && selectedCategory !== "All Recipes") {
              setupCategoryListener(selectedCategory);
            }
          }).catch(error => {
            console.error('Error refreshing category recipes:', error);
          });
        }
        return;
      }

      // For active tab, check cache validity before fetching
      const cacheStats = getRecipeCacheStats(restaurantId);

      // If cache is valid (< 24 hours old), use cached data
      if (cacheStats.isValid) {
        console.log('📱 Using cached recipes on focus (cache still valid)');
        loadRecipesWithCaching(false).catch(error => {
          console.error('Error loading from cache:', error);
        });
        return;
      }

      // Cache is stale, refresh based on current selection
      if (selectedCategory === "All Recipes") {
        // Refresh "All Recipes" view
        allFetchedRecipesRef.current = []; // Clear stored recipes
        setTotalRecipesCount(0); // Reset total count
        fetchAllRecipes(true).catch(error => {
          console.error('Error refreshing all recipes:', error);
        });
      } else {
        // Refresh specific category (active only)
        fetchCategoriesAndRecipes(false).then(() => {
          // Re-setup listener for current category
          if (selectedCategory && selectedCategory !== "All Recipes") {
            setupCategoryListener(selectedCategory);
          }
        }).catch(error => {
          console.error('Error refreshing category recipes:', error);
        });
      }
    }, [restaurantId, selectedCategory, activeTab])
  );

  // Swipe down to refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    
    if (selectedCategory === "All Recipes") {
      // Refresh "All Recipes" with paginated fetch (reset)
      allFetchedRecipesRef.current = []; // Clear stored recipes on refresh
      setTotalRecipesCount(0); // Reset total count
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

  // Search effect: when search term changes, query the entire database
  useEffect(() => {
    if (!restaurantId) return;
    
    const searchTerm = search?.trim() || "";
    
    if (searchTerm.length > 0) {
      // Debounce search to avoid too many queries
      const timeoutId = setTimeout(() => {
        searchRecipesInDatabase(searchTerm);
      }, 300); // 300ms debounce
      
      return () => clearTimeout(timeoutId);
    } else {
      // Clear search results when search is cleared
      setSearchResults([]);
      setSearching(false);
    }
  }, [search, restaurantId, activeTab, searchRecipesInDatabase]);

  // Recipes to display (filtered by search)
  // When searching, use searchResults; otherwise use loaded recipes
  const recipes = search.trim().length > 0 
    ? searchResults 
    : (selectedCategory === "All Recipes" 
        ? allRecipes 
        : (recipesByCategory[selectedCategory] || []));

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
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
                ? `${totalRecipesCount} ${activeTab === 'archived' ? 'Archived' : ''} Recipes`
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
          {searching ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Searching recipes...</Text>
            </View>
          ) : (loading || (selectedCategory === "All Recipes" && allRecipesLoading)) && !loadingFromCache ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Loading recipes...</Text>
            </View>
          ) : (
            <>
            {recipes.length === 0 && search.trim().length > 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No recipes found</Text>
                <Text style={styles.emptySubtext}>Try a different search term</Text>
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
              ))
            )}
            
            {/* Load More Button for All Recipes - hide when searching */}
            {search.trim().length === 0 && selectedCategory === "All Recipes" && allRecipesHasMore && (
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
