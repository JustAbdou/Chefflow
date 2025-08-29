import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Image, ScrollView, ActivityIndicator, TouchableOpacity, SafeAreaView, Dimensions } from "react-native";
import { Colors } from "../../constants/Colors";
import { Typography } from "../../constants/Typography";
import { Spacing } from "../../constants/Spacing";
import { getDoc } from "firebase/firestore";
import { useRestaurant } from "../../contexts/RestaurantContext";
import { getRestaurantSubDoc } from "../../utils/firestoreHelpers";

const { width: screenWidth } = Dimensions.get('window');

function RecipeDetailScreen({ route, navigation }) {
  const { restaurantId } = useRestaurant();
  const { recipeId, category } = route.params;
  const [recipe, setRecipe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const fetchRecipeDetails = async () => {
      if (!restaurantId) return;
      
      try {
        const recipeDoc = await getDoc(
          getRestaurantSubDoc(restaurantId, "recipes", "categories", category, recipeId)
        );
        const recipeData = recipeDoc.data();
        setRecipe(recipeData);
        // Reset image index when recipe changes
        setCurrentImageIndex(0);
      } catch (error) {
        console.error("Error fetching recipe details:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecipeDetails();
  }, [recipeId, category, restaurantId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (!recipe) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Recipe not found.</Text>
      </SafeAreaView>
    );
  }

  // Handle image data - ensure it's always an array
  const getRecipeImages = () => {
    if (!recipe.image) return ["https://placehold.co/200x200?text=No+Image"];
    if (Array.isArray(recipe.image)) return recipe.image.length > 0 ? recipe.image : ["https://placehold.co/200x200?text=No+Image"];
    return [recipe.image];
  };

  const recipeImages = getRecipeImages();
  const hasMultipleImages = recipeImages.length > 1;

  const handleScroll = (event) => {
    const slideWidth = screenWidth * 0.92;
    const currentIndex = Math.round(event.nativeEvent.contentOffset.x / slideWidth);
    setCurrentImageIndex(currentIndex);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.backHeader}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
              <Text style={styles.backArrow}>‹</Text>
            </TouchableOpacity>
          </View>
        </View>

      {/* Image Slideshow */}
      <View style={styles.imageContainer}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          style={styles.imageScrollView}
          contentContainerStyle={styles.imageScrollContainer}
        >
          {recipeImages.map((imageUri, index) => (
            <Image
              key={index}
              source={{ uri: imageUri }}
              style={styles.image}
              resizeMode="cover"
            />
          ))}
        </ScrollView>
        
        {/* Pagination Dots - only show if multiple images */}
        {hasMultipleImages && (
          <View style={styles.paginationContainer}>
            {recipeImages.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.paginationDot,
                  index === currentImageIndex && styles.paginationDotActive
                ]}
              />
            ))}
          </View>
        )}
      </View>

      {/* Title */}
      <Text style={styles.title}>{recipe["recipe name"]}</Text>

      {/* Recipe Details Button */}
      <TouchableOpacity style={styles.detailsButton}>
        <Text style={styles.detailsButtonText}>Recipe Details</Text>
      </TouchableOpacity>

      {/* Card */}
      <View style={styles.card}>
        {/* Ingredients */}
        <Text style={styles.sectionTitle}>Ingredients</Text>
        {recipe.ingredients?.map((ingredient, idx) => (
          <View key={idx} style={styles.ingredientRow}>
            <Text style={styles.checkmark}>✓</Text>
            <Text style={styles.ingredientText}>{ingredient}</Text>
          </View>
        ))}

        {/* Instructions */}
        <Text style={styles.sectionTitle}>Instructions</Text>
        {recipe.instructions?.map((instruction, idx) => (
          <View key={idx} style={styles.instructionCard}>
            <View style={styles.instructionCircle}>
              <Text style={styles.instructionCircleText}>{idx + 1}</Text>
            </View>
            <Text style={styles.instructionText}>
              {instruction}
            </Text>
          </View>
        ))}

        {/* Notes */}
        {recipe.notes && (
          <>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notes}>{recipe.notes}</Text>
          </>
        )}
      </View>
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backHeader: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    width: "100%",
  },
  backButton: {
    marginRight: Spacing.md,
    padding: Spacing.xs,
  },
  backArrow: {
    fontSize: 35,
    color: Colors.textPrimary,
    fontWeight: "300",
  },
  imageContainer: {
    marginBottom: Spacing.sm,
  },
  imageScrollView: {
    width: "100%",
  },
  imageScrollContainer: {
    alignItems: 'center',
  },
  image: {
    width: screenWidth * 0.92,
    height: 220,
    borderRadius: 18,
    marginHorizontal: screenWidth * 0.04,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.gray300,
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: Colors.primary,
    width: 24,
  },
  title: {
    fontSize: 26,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
    textAlign: "center",
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
  },
  detailsButton: {
    alignSelf: "center",
    backgroundColor: "#F4F7FF",
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: Spacing.lg,
  },
  detailsButtonText: {
    color: Colors.primary,
    fontSize: Typography.base,
    fontWeight: "600",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    marginHorizontal: Spacing.lg,
    padding: Spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: Typography.lg,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    marginTop: Spacing.md,
    textAlign: "center",
  },
  ingredientRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  checkmark: {
    fontSize: 18,
    color: Colors.primary,
    marginRight: 8,
  },
  ingredientText: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
  },
  instructionCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F4F7FF",
    borderRadius: 14,
    padding: 14,
    marginBottom: Spacing.md,
  },
  instructionCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
    marginTop: 2,
  },
  instructionCircleText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
    textAlign: "center",
    includeFontPadding: false,
    textAlignVertical: "center",
    lineHeight: 16,
  },
  instructionText: {
    fontSize: Typography.base,
    color: Colors.textPrimary,
    lineHeight: 22,
    flex: 1,
  },
  notes: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  errorText: {
    fontSize: Typography.lg,
    color: Colors.error,
    textAlign: "center",
    marginTop: Spacing.lg,
  },
});

export default RecipeDetailScreen;