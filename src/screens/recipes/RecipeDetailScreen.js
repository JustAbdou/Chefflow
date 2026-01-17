import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Dimensions, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Colors } from "../../constants/Colors";
import { Typography } from "../../constants/Typography";
import { Spacing } from "../../constants/Spacing";
import { getDoc, updateDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { useRestaurant } from "../../contexts/RestaurantContext";
import { getRestaurantSubDoc } from "../../utils/firestoreHelpers";
import { useFocusEffect } from "@react-navigation/native";
import * as Print from "expo-print";
import { Ionicons } from "@expo/vector-icons";
import FullscreenImageViewer from "../../components/FullscreenImageViewer";
import { getCachedRecipes, saveRecipeCache } from "../../utils/recipeCache";

const { width: screenWidth } = Dimensions.get('window');

function RecipeDetailScreen({ route, navigation }) {
  const { restaurantId } = useRestaurant();
  const { recipeId, category } = route.params;
  const [recipe, setRecipe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isPrinting, setIsPrinting] = useState(false);
  const [fullscreenImageVisible, setFullscreenImageVisible] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  const fetchRecipeDetails = React.useCallback(async () => {
    if (!restaurantId) return;
    
    setLoading(true);
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
  }, [recipeId, category, restaurantId]);

  useEffect(() => {
    fetchRecipeDetails();
  }, [fetchRecipeDetails]);

  // Refresh recipe when screen comes into focus (e.g., after editing)
  useFocusEffect(
    React.useCallback(() => {
      fetchRecipeDetails();
    }, [fetchRecipeDetails])
  );

  // Set up real-time listener for recipe updates
  useEffect(() => {
    if (!restaurantId || !recipeId || !category) return;

    const recipeDocRef = getRestaurantSubDoc(restaurantId, "recipes", "categories", category, recipeId);
    
    const unsubscribe = onSnapshot(recipeDocRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const recipeData = docSnapshot.data();
        setRecipe(recipeData);
      }
    }, (error) => {
      console.error("Error in recipe listener:", error);
    });

    return () => unsubscribe();
  }, [restaurantId, recipeId, category]);

  // Handle archive/restore recipe
  const handleArchiveRecipe = async () => {
    if (!restaurantId || !recipeId || !category || !recipe) return;

    const isArchived = recipe.archived === true;
    const action = isArchived ? "Restore" : "Archive";
    const message = isArchived 
      ? "Restore this recipe to Active recipes?"
      : "Archive this recipe? It will be hidden from Active recipes.";

    Alert.alert(
      `${action} Recipe`,
      message,
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: action,
          style: isArchived ? "default" : "destructive",
          onPress: async () => {
            setIsArchiving(true);
            try {
              const recipeDocRef = getRestaurantSubDoc(restaurantId, "recipes", "categories", category, recipeId);
              await updateDoc(recipeDocRef, {
                archived: !isArchived,
                updatedAt: serverTimestamp()
              });

              // Update the recipe in cache instead of clearing entire cache
              try {
                const { recipesByCategory, categories } = getCachedRecipes(restaurantId);

                // Update recipe in its category
                if (recipesByCategory[category]) {
                  recipesByCategory[category] = recipesByCategory[category].map(r =>
                    r.id === recipeId ? { ...r, archived: !isArchived } : r
                  );
                }

                // Update recipe in "All Recipes"
                if (recipesByCategory["All Recipes"]) {
                  recipesByCategory["All Recipes"] = recipesByCategory["All Recipes"].map(r =>
                    r.id === recipeId ? { ...r, archived: !isArchived } : r
                  );
                }

                // Save updated cache
                await saveRecipeCache(restaurantId, { categories, recipesByCategory });
                console.log(`📝 Updated recipe ${recipeId} in cache (archived: ${!isArchived})`);
              } catch (cacheError) {
                console.warn('Failed to update cache, will refresh on next load:', cacheError);
              }

              // Show success message
              Alert.alert(
                "Success",
                `Recipe ${isArchived ? "restored" : "archived"} successfully.`,
                [
                  {
                    text: "OK",
                    onPress: () => {
                      // Navigate back to recipes list
                      navigation.goBack();
                    }
                  }
                ]
              );
            } catch (error) {
              console.error("Error archiving/restoring recipe:", error);
              Alert.alert("Error", `Could not ${action.toLowerCase()} recipe. Please try again.`);
            } finally {
              setIsArchiving(false);
            }
          }
        }
      ]
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

  // Handle image data - ensure it's always an array
  const getRecipeImages = () => {
    if (!recipe.image) return ["https://placehold.co/200x200?text=No+Image"];
    if (Array.isArray(recipe.image)) return recipe.image.length > 0 ? recipe.image : ["https://placehold.co/200x200?text=No+Image"];
    return [recipe.image];
  };

  const recipeImages = getRecipeImages();
  const hasMultipleImages = recipeImages.length > 1;
  
  // Filter out placeholder images for fullscreen viewer
  const validImages = recipeImages.filter(img => img && !img.includes('placehold'));

  const handleScroll = (event) => {
    const slideWidth = screenWidth * 0.92;
    const currentIndex = Math.round(event.nativeEvent.contentOffset.x / slideWidth);
    setCurrentImageIndex(currentIndex);
  };

  // Handle image click - open fullscreen viewer
  const handleImagePress = () => {
    if (validImages.length === 0) {
      return;
    }
    setFullscreenImageVisible(true);
  };
  
  // Calculate initial index for fullscreen viewer
  const getFullscreenInitialIndex = () => {
    if (validImages.length === 0) return 0;
    const displayedImage = recipeImages[currentImageIndex];
    const index = validImages.findIndex(img => img === displayedImage);
    return index >= 0 ? index : 0;
  };

  // Print recipe
  const handlePrintRecipe = async () => {
    // Prevent multiple simultaneous print requests
    if (isPrinting) {
      return;
    }

    setIsPrinting(true);
    try {
      const recipeName = recipe["recipe name"] || recipe.recipeName || "Recipe";
      const recipeImage = recipeImages[0]; // Use first image
      const ingredients = recipe.ingredients || [];
      const allergens = recipe.notes || "";

      // Helper function to escape HTML
      const escapeHtml = (text) => {
        if (!text) return '';
        return String(text)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      };

      // Split ingredients into two columns (max 7 per column)
      const splitIngredients = () => {
        const leftColumn = ingredients.slice(0, 7);
        const rightColumn = ingredients.slice(7, 14);
        return { leftColumn, rightColumn };
      };
      
      const { leftColumn, rightColumn } = splitIngredients();

      // Create HTML for printing
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>${escapeHtml(recipeName)}</title>
          <style>
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            @page {
              size: A4;
              margin: 10mm;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
              margin: 0;
              padding: 0;
              color: #333;
              line-height: 1.4;
              font-size: 14px;
            }
            .recipe-image-container {
              width: 100%;
              height: 75mm;
              max-height: 75mm;
              margin: 0 auto 8mm auto;
              overflow: hidden;
              border-radius: 4px;
              display: flex;
              align-items: center;
              justify-content: center;
              background-color: #f3f4f6;
              page-break-inside: avoid;
            }
            .recipe-image {
              width: 100%;
              height: 100%;
              object-fit: cover;
              display: block;
            }
            .ingredients-section {
              margin-bottom: 8mm;
              page-break-inside: avoid;
            }
            .ingredients-title {
              font-size: 18px;
              font-weight: bold;
              color: #1f2937;
              margin-bottom: 6mm;
              text-align: center;
              border-bottom: 2px solid #e5e7eb;
              padding-bottom: 4mm;
            }
            .ingredients-container {
              display: flex;
              gap: 8mm;
              justify-content: space-between;
            }
            .ingredients-column {
              flex: 1;
              min-width: 0;
            }
            .ingredients-list {
              list-style: none;
              padding: 0;
              margin: 0;
            }
            .ingredient-item {
              padding: 3mm 0;
              font-size: 13px;
              color: #374151;
              border-bottom: 1px solid #f3f4f6;
              line-height: 1.5;
            }
            .ingredient-item:last-child {
              border-bottom: none;
            }
            .ingredient-item:before {
              content: "✓ ";
              color: #2563eb;
              font-weight: bold;
              margin-right: 4px;
            }
            .allergens-section {
              margin-top: 8mm;
              margin-bottom: 0;
              page-break-inside: avoid;
            }
            .allergens-title {
              font-size: 18px;
              font-weight: bold;
              color: #1f2937;
              margin-bottom: 4mm;
              text-align: center;
              border-bottom: 2px solid #e5e7eb;
              padding-bottom: 4mm;
            }
            .allergens-content {
              background-color: #fef2f2;
              padding: 6mm;
              border-radius: 4px;
              border-left: 4px solid #dc2626;
              font-size: 13px;
              color: #374151;
              white-space: pre-wrap;
              line-height: 1.6;
            }
            @media print {
              body {
                padding: 0;
                margin: 0;
              }
              .recipe-image-container {
                height: 75mm;
                max-height: 75mm;
              }
            }
            @media screen {
              body {
                max-width: 210mm;
                margin: 0 auto;
                padding: 10mm;
                background: white;
              }
            }
          </style>
        </head>
        <body>
          ${recipeImage && !recipeImage.includes('placehold') ? `
            <div class="recipe-image-container">
              <img src="${escapeHtml(recipeImage)}" alt="${escapeHtml(recipeName)}" class="recipe-image" />
            </div>
          ` : ''}
          
          <div class="ingredients-section">
            <h2 class="ingredients-title">Ingredients</h2>
            <div class="ingredients-container">
              <div class="ingredients-column">
                <ul class="ingredients-list">
                  ${leftColumn.map(ingredient => `
                    <li class="ingredient-item">${escapeHtml(ingredient)}</li>
                  `).join('')}
                </ul>
              </div>
              ${rightColumn.length > 0 ? `
                <div class="ingredients-column">
                  <ul class="ingredients-list">
                    ${rightColumn.map(ingredient => `
                      <li class="ingredient-item">${escapeHtml(ingredient)}</li>
                    `).join('')}
                  </ul>
                </div>
              ` : '<div class="ingredients-column"></div>'}
            </div>
          </div>
          
          ${allergens ? `
            <div class="allergens-section">
              <h2 class="allergens-title">Allergens</h2>
              <div class="allergens-content">${escapeHtml(allergens)}</div>
            </div>
          ` : ''}
        </body>
        </html>
      `;

      // Open print dialog
      await Print.printAsync({ html });
    } catch (error) {
      // Don't show error if user cancelled printing or if another request is in progress
      if (error.message && (error.message.includes("did not complete") || error.message.includes("already in progress"))) {
        console.log("Print cancelled or already in progress");
        return;
      }
      console.error("Error printing recipe:", error);
      Alert.alert("Print Error", "Failed to print recipe. Please try again.");
    } finally {
      setIsPrinting(false);
    }
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
            <TouchableOpacity 
              style={[styles.archiveButton, recipe.archived === true && styles.restoreButton]}
              onPress={handleArchiveRecipe}
              activeOpacity={0.7}
              disabled={isArchiving}
            >
              <Ionicons 
                name={recipe.archived === true ? "refresh-outline" : "archive-outline"} 
                size={18} 
                color={recipe.archived === true ? Colors.secondary : Colors.gray600} 
                style={styles.archiveButtonIcon} 
              />
              <Text style={[styles.archiveButtonText, recipe.archived === true && styles.restoreButtonText]}>
                {isArchiving ? "..." : (recipe.archived === true ? "Restore" : "Archive")}
              </Text>
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
            <TouchableOpacity
              key={index}
              activeOpacity={0.9}
              onPress={handleImagePress}
              style={styles.imageTouchable}
            >
              <Image
                source={{ uri: imageUri }}
                style={styles.image}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={{ duration: 200 }}
                priority="high"
              />
            </TouchableOpacity>
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

      {/* Action Buttons */}
      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.editButton]}
          onPress={() => navigation.navigate("EditRecipe", { recipeId, category, recipe })}
          activeOpacity={0.7}
        >
          <Ionicons name="pencil" size={18} color={Colors.primary} style={styles.buttonIcon} />
          <Text style={styles.actionButtonText}>Edit</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionButton, styles.printButton, isPrinting && styles.actionButtonDisabled]}
          onPress={handlePrintRecipe}
          activeOpacity={0.7}
          disabled={isPrinting}
        >
          <Ionicons name="print" size={18} color={isPrinting ? Colors.gray400 : Colors.primary} style={styles.buttonIcon} />
          <Text style={[styles.actionButtonText, isPrinting && styles.actionButtonTextDisabled]}>
            {isPrinting ? "Printing..." : "Print"}
          </Text>
        </TouchableOpacity>
      </View>

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
            <Text style={styles.sectionTitle}>Allergens</Text>
            <Text style={styles.notes}>{recipe.notes}</Text>
          </>
        )}
      </View>
    </ScrollView>
    
    {/* Fullscreen Image Viewer */}
    <FullscreenImageViewer
      visible={fullscreenImageVisible}
      images={validImages}
      initialIndex={getFullscreenInitialIndex()}
      onClose={() => setFullscreenImageVisible(false)}
    />
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
    justifyContent: "space-between",
    width: "100%",
  },
  backButton: {
    padding: Spacing.xs,
  },
  archiveButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.gray100,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.gray300,
  },
  restoreButton: {
    backgroundColor: "#E6F7F0",
    borderColor: Colors.secondary,
  },
  archiveButtonIcon: {
    marginRight: 6,
  },
  archiveButtonText: {
    color: Colors.gray600,
    fontSize: Typography.base,
    fontWeight: "600",
  },
  restoreButtonText: {
    color: Colors.secondary,
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
  imageTouchable: {
    width: screenWidth * 0.92,
    height: 220,
    marginHorizontal: screenWidth * 0.04,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
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
  actionButtonsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F4F7FF",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    marginHorizontal: 6,
  },
  editButton: {
    backgroundColor: "#F4F7FF",
  },
  printButton: {
    backgroundColor: "#F4F7FF",
  },
  buttonIcon: {
    marginRight: 6,
  },
  actionButtonText: {
    color: Colors.primary,
    fontSize: Typography.base,
    fontWeight: "600",
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonTextDisabled: {
    color: Colors.gray400,
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