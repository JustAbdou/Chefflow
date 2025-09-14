"use client"
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Image, ActivityIndicator, TextInput, RefreshControl } from "react-native"
import { Colors } from "../../constants/Colors"
import { Typography } from "../../constants/Typography"
import { Spacing } from "../../constants/Spacing"
import { getAndroidTitleMargin } from "../../utils/responsive"
import useNavigationBar from "../../hooks/useNavigationBar"
import { doc, getDoc, getDocs } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useRestaurant } from "../../contexts/RestaurantContext";
import { getRestaurantDoc, getRestaurantSubCollection, getRestaurantNestedCollection } from "../../utils/firestoreHelpers";
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
  const { restaurantId } = useRestaurant();
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("All Recipes");
  const [recipesByCategory, setRecipesByCategory] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingFromCache, setLoadingFromCache] = useState(false);

  // Hide Android navigation bar
  const navigationBar = useNavigationBar();
  navigationBar.useHidden(); // Use hidden mode for complete immersion
  const [search, setSearch] = useState(""); // <-- Add search state
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation();

  // Load from cache first, then fetch fresh data if needed
  const loadRecipesWithCaching = async (forceRefresh = false) => {
    if (!restaurantId) {
      console.log('No restaurantId available, skipping fetch');
      return;
    }

    // Check if we should use cache
    const cacheValid = await isRecipesCacheValid();
    const isOnline = getNetworkStatus();
    
    // Load from cache first for instant display
    if (!forceRefresh && (cacheValid || !isOnline)) {
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
        
        // If cache is valid, we're done
        if (cacheValid && !forceRefresh) {
          setLoading(false);
          setRefreshing(false);
          return;
        }
      }
    }

    // Fetch fresh data from server
    if (isOnline || forceRefresh) {
      if (!loadingFromCache) setLoading(true);
      
      try {
        console.log('🌐 Fetching fresh recipes from server...');
        await fetchCategoriesAndRecipes();
        
        // Cache the fresh data
        await cacheRecipesOffline(recipesByCategory, categories);
        await updateRecipesCacheTimestamp();
        
      } catch (error) {
        console.error('❌ Error fetching fresh recipes:', error);
        // If we have cached data and fetch fails, keep using cache
        if (Object.keys(recipesByCategory).length === 0) {
          const { recipesByCategory: cachedRecipes, categories: cachedCategories } = await getCachedRecipes();
          if (Object.keys(cachedRecipes).length > 0) {
            setCategories(cachedCategories);
            setRecipesByCategory(cachedRecipes);
            console.log('📚 Fallback to cached recipes after fetch error');
          }
        }
      }
    }
    
    setLoading(false);
    setLoadingFromCache(false);
    setRefreshing(false);
  };

  // Fetch categories and all recipes from category documents
  const fetchCategoriesAndRecipes = async () => {
    try {
      console.log('Fetching recipes for restaurantId:', restaurantId);
      
      // Fetch category names from restaurants/{restaurantId}/recipes/categories/names
      const categoryNamesDoc = await getDoc(getRestaurantDoc(restaurantId, "recipes", "categories"));
      let categoryNames = [];
      
      if (categoryNamesDoc.exists()) {
        const data = categoryNamesDoc.data();
        categoryNames = data?.names || [];
        console.log('Fetched category names from Firestore:', categoryNames);
      } else {
        console.warn('No category names document found, using default categories');
        categoryNames = ['Desserts', 'Main', 'Starters']; // Fallback categories
      }
      
      const fetchedCategories = [];
      const recipesObj = {};
      let allRecipes = [];

      // For each category name from the array
      for (const categoryName of categoryNames) {
        console.log('Processing category:', categoryName);
        fetchedCategories.push({ id: categoryName, name: categoryName });

        try {
          // Fetch recipe documents directly from the category path
          // Path: restaurants/{restaurantId}/recipes/categories/{categoryName}/
          const categoryRecipesSnapshot = await getDocs(getRestaurantSubCollection(restaurantId, "recipes", "categories", categoryName));
          console.log(`Found ${categoryRecipesSnapshot.size} documents in category: ${categoryName}`);
          
          const categoryRecipes = [];
          categoryRecipesSnapshot.forEach(recipeDoc => {
            const recipeData = recipeDoc.data();
            console.log(`Recipe document ${recipeDoc.id} data:`, recipeData);
            
            const recipe = { 
              id: recipeDoc.id, 
              ...recipeData, 
              category: categoryName
            };
            categoryRecipes.push(recipe);
            allRecipes.push(recipe);
          });
          
          recipesObj[categoryName] = categoryRecipes;
          console.log(`Fetched ${categoryRecipes.length} recipes from category: ${categoryName}`);
        } catch (categoryError) {
          console.error(`Error fetching recipes for category ${categoryName}:`, categoryError);
          recipesObj[categoryName] = [];
        }
      }

      const newRecipesByCategory = { "All Recipes": allRecipes, ...recipesObj };
      
      setCategories(fetchedCategories);
      setRecipesByCategory(newRecipesByCategory);
      
      // Cache the data immediately after fetching
      await cacheRecipesOffline(newRecipesByCategory, fetchedCategories);
      await updateRecipesCacheTimestamp();
      
      console.log('Total recipes fetched:', allRecipes.length);
      console.log('Categories:', fetchedCategories.map(cat => cat.name));
      if (!selectedCategory && fetchedCategories.length > 0) setSelectedCategory("All Recipes");
    } catch (error) {
      console.error("Error fetching categories/recipes:", error);
      throw error;
    }
  };

  useEffect(() => {
    loadRecipesWithCaching();
  }, [restaurantId]);

  // Swipe down to refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    await loadRecipesWithCaching(true); // Force refresh from server
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
              {recipesByCategory["All Recipes"] ? `${recipesByCategory["All Recipes"].length} Recipes` : "Loading..."}
            </Text>
            {loadingFromCache && (
              <Text style={styles.cacheIndicator}>📚 Loading from cache...</Text>
            )}
          </View>
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
                All Recipes
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
})

export default RecipesScreen
