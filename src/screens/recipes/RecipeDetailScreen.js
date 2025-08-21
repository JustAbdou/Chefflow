import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Image, ScrollView, ActivityIndicator, TouchableOpacity, SafeAreaView, FlatList, Dimensions, RefreshControl } from "react-native";
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
  const [imageLoadingStates, setImageLoadingStates] = useState({});
  const [imageErrors, setImageErrors] = useState({});
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const fetchRecipeDetails = async () => {
      if (!restaurantId) return;
      
      try {
        const recipeDoc = await getDoc(
          getRestaurantSubDoc(restaurantId, "recipes", "categories", category, recipeId)
        );
        setRecipe(recipeDoc.data());
      } catch (error) {
        console.error("Error fetching recipe details:", error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    };

    fetchRecipeDetails();
  }, [recipeId, category, restaurantId]);

  const onRefresh = async () => {
    setRefreshing(true);
    
    if (!restaurantId) {
      setRefreshing(false);
      return;
    }
    
    try {
      const recipeDoc = await getDoc(
        getRestaurantSubDoc(restaurantId, "recipes", "categories", category, recipeId)
      );
      setRecipe(recipeDoc.data());
      
      setImageLoadingStates({});
      setImageErrors({});
      setCurrentImageIndex(0);
    } catch (error) {
      console.error("Error refreshing recipe details:", error);
    } finally {
      setRefreshing(false);
    }
  };

  const getImageArray = (recipe) => {
    if (!recipe?.image) return [];
    
    // Handle backward compatibility
    if (Array.isArray(recipe.image)) {
      // New format: already an array - filter out invalid entries
      return recipe.image.filter(img => img && typeof img === 'string' && img.trim() !== '');
    } else if (typeof recipe.image === 'string' && recipe.image.trim() !== '') {
      // Old format: single string, convert to array
      return [recipe.image];
    }
    
    return [];
  };

  // Image slideshow functions
  const renderImageItem = ({ item, index }) => {
    // Validate the image URI
    if (!item || typeof item !== 'string' || item.trim() === '') {
      return (
        <View style={styles.imageItemContainer}>
          <View style={styles.imageErrorOverlay}>
            <Text style={styles.imageErrorText}>Invalid image</Text>
          </View>
        </View>
      );
    }

    const imageKey = `${index}-${item}`;
    const isLoading = imageLoadingStates[imageKey];
    const hasError = imageErrors[imageKey];

    return (
      <View style={styles.imageItemContainer}>
        <Image 
          source={{ uri: item.trim() }} 
          style={styles.image} 
          resizeMode="cover"
          onLoadStart={() => {
            setImageLoadingStates(prev => ({ ...prev, [imageKey]: true }));
          }}
          onLoad={() => {
            setImageLoadingStates(prev => ({ ...prev, [imageKey]: false }));
          }}
          onError={(error) => {
            console.log('Image load error:', error);
            setImageLoadingStates(prev => ({ ...prev, [imageKey]: false }));
            setImageErrors(prev => ({ ...prev, [imageKey]: true }));
          }}
        />
        {isLoading && !hasError && (
          <View style={styles.imageLoadingOverlay}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        )}
        {hasError && (
          <View style={styles.imageErrorOverlay}>
            <Text style={styles.imageErrorText}>Failed to load image</Text>
          </View>
        )}
      </View>
    );
  };

  const onImageScroll = (event) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = event.nativeEvent.contentOffset.x / slideSize;
    const roundedIndex = Math.round(index);
    
    if (roundedIndex !== currentImageIndex) {
      setCurrentImageIndex(roundedIndex);
    }
  };

  const renderPaginationDots = () => {
    const images = getImageArray(recipe);
    if (!images || images.length <= 1) return null;
    
    return (
      <View style={styles.paginationContainer}>
        {images.map((_, index) => (
          <View
            key={index}
            style={[
              styles.paginationDot,
              index === currentImageIndex && styles.paginationDotActive
            ]}
          />
        ))}
      </View>
    );
  };

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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.backHeader}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
              <Text style={styles.backArrow}>‹</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Image Slideshow */}
        {(() => {
          const images = getImageArray(recipe);
          console.log('Recipe images:', images); // Debug log
          return images.length > 0 ? (
            <View style={styles.imageContainer}>
              <FlatList
                data={images}
                renderItem={renderImageItem}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={onImageScroll}
                scrollEventThrottle={16}
                keyExtractor={(item, index) => `image-${index}-${typeof item === 'string' ? item.substring(0, 10) : 'invalid'}`}
                style={styles.imageSlideshow}
                // Simplified performance optimizations
                initialNumToRender={1}
                windowSize={2}
                removeClippedSubviews={false}
              />
              {renderPaginationDots()}
            </View>
          ) : (
            <View style={styles.noImageContainer}>
              <Text style={styles.noImageText}>No images available</Text>
            </View>
          );
        })()}

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
            <View style={styles.instructionTextContainer}>
              <Text style={styles.instructionText}>
                {instruction}
              </Text>
            </View>
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
  image: {
    width: screenWidth * 0.92,
    height: 220,
    borderRadius: 18,
    marginHorizontal: screenWidth * 0.04,
  },
  imageItemContainer: {
    position: 'relative',
  },
  imageLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: screenWidth * 0.04,
    right: screenWidth * 0.04,
    bottom: 0,
    backgroundColor: Colors.gray100,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageErrorOverlay: {
    position: 'absolute',
    top: 0,
    left: screenWidth * 0.04,
    right: screenWidth * 0.04,
    bottom: 0,
    backgroundColor: Colors.gray100,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageErrorText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  imageContainer: {
    marginBottom: Spacing.lg,
  },
  imageSlideshow: {
    height: 220,
  },
  noImageContainer: {
    width: "92%",
    height: 220,
    alignSelf: "center",
    borderRadius: 18,
    backgroundColor: Colors.gray100,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  noImageText: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  paginationContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: Spacing.md,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.gray200,
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: Colors.primary,
    width: 20,
  },
  title: {
    fontSize: 26,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
    textAlign: "center",
    marginBottom: Spacing.sm,
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
    flexShrink: 0,
  },
  instructionCircleText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 18,
  },
  instructionTitle: {
    fontSize: Typography.base,
    fontWeight: "bold",
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  instructionDesc: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
  },
  instructionText: {
    fontSize: Typography.base,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  instructionTextContainer: {
    flex: 1,
    justifyContent: "center",
    minHeight: 32,
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