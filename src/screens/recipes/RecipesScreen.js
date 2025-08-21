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

function RecipesScreen() {
  const { restaurantId } = useRestaurant();
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("All Recipes");
  const [recipesByCategory, setRecipesByCategory] = useState({});
  const [loading, setLoading] = useState(true);

  // Hide Android navigation bar
  const navigationBar = useNavigationBar();
  navigationBar.useHidden(); // Use hidden mode for complete immersion
  const [search, setSearch] = useState(""); // <-- Add search state
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation();

  // Fetch categories and all recipes from category documents
  const fetchCategoriesAndRecipes = async () => {
    if (!restaurantId) {
      console.log('No restaurantId available, skipping fetch');
      return;
    }
    setLoading(true);
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

      setCategories(fetchedCategories);
      setRecipesByCategory({ "All Recipes": allRecipes, ...recipesObj });
      console.log('Total recipes fetched:', allRecipes.length);
      console.log('Categories:', fetchedCategories.map(cat => cat.name));
      if (!selectedCategory && fetchedCategories.length > 0) setSelectedCategory("All Recipes");
    } catch (error) {
      console.error("Error fetching categories/recipes:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCategoriesAndRecipes();
  }, [restaurantId]);

  // Swipe down to refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCategoriesAndRecipes();
  };

  // Helper function to get thumbnail image from recipe
  const getThumbnailImage = (recipe) => {
    if (!recipe?.image) return null;
    
    // Handle backward compatibility
    if (Array.isArray(recipe.image)) {
      // New format: array - return first valid image
      const validImages = recipe.image.filter(img => img && typeof img === 'string' && img.trim() !== '');
      return validImages.length > 0 ? validImages[0] : null;
    } else if (typeof recipe.image === 'string' && recipe.image.trim() !== '') {
      // Old format: single string
      return recipe.image;
    }
    
    return null;
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
          <Text style={styles.subtitle}>{recipesByCategory["All Recipes"] ? `${recipesByCategory["All Recipes"].length} Recipes` : "Loading..."}</Text>
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
          {loading ? (
            <ActivityIndicator size="large" style={{ marginTop: 40 }} />
          ) : (
            recipes.map(recipe => {
              const thumbnailImage = getThumbnailImage(recipe);
              return (
                <TouchableOpacity
                  key={recipe.id}
                  style={styles.recipeCard}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate("RecipeDetail", { recipeId: recipe.id, category: recipe.category })}
                >
                  {thumbnailImage ? (
                    <Image 
                      source={{ uri: thumbnailImage }} 
                      style={styles.recipeImage} 
                      resizeMode="cover" 
                    />
                  ) : (
                    <View style={[styles.recipeImage, styles.noImagePlaceholder]}>
                      <Text style={styles.noImageText}>No Image</Text>
                    </View>
                  )}
                  <View style={styles.recipeInfo}>
                    <Text style={styles.recipeName}>
                      {recipe["recipe name"] || recipe.name || recipe.title || recipe.recipeName || "Untitled Recipe"}
                    </Text>
                    <Text style={styles.recipeCategory}>{recipe.category}</Text>
                  </View>
                </TouchableOpacity>
              );
            })
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
  subtitle: {
    fontFamily: Typography.fontRegular,
    opacity: 0.7,
    paddingVertical: Spacing.sm,
    fontSize: Typography.sm,
    color: Colors.textSecondary,
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
  noImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  noImageText: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontStyle: 'italic',
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
