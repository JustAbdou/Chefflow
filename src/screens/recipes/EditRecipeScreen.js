import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Image, Alert, Platform,
} from "react-native";
import { Colors } from "../../constants/Colors";
import { Typography } from "../../constants/Typography";
import { Spacing } from "../../constants/Spacing";
import { getAndroidTitleMargin } from "../../utils/responsive";
import { updateDoc, addDoc, deleteDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { useRestaurant } from "../../contexts/RestaurantContext";
import { getRestaurantDoc, getRestaurantSubCollection, getRestaurantSubDoc } from "../../utils/firestoreHelpers";
import { uploadImageToStorage } from "../../utils/imageUpload";
import * as ImagePicker from "expo-image-picker";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";

export default function EditRecipeScreen({ route, navigation }) {
  const { restaurantId } = useRestaurant();
  const { recipeId, category: initialCategory, recipe: initialRecipe } = route.params;
  
  const [date, setDate] = useState("");
  const [category, setCategory] = useState(initialCategory || "");
  const [categories, setCategories] = useState([]);
  const [recipeName, setRecipeName] = useState("");
  const [ingredients, setIngredients] = useState([]);
  const [instructions, setInstructions] = useState([]);
  const [notes, setNotes] = useState("");
  const [ingredientInput, setIngredientInput] = useState("");
  const [instructionInput, setInstructionInput] = useState("");
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Set today's date
    const today = new Date();
    setDate(today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }));

    // Fetch categories from Firestore
    const fetchCategories = async () => {
      if (!restaurantId) return;
      
      const categoriesDoc = await getDoc(getRestaurantDoc(restaurantId, "recipes", "categories"));
      const data = categoriesDoc.data();
      setCategories(data?.names || []);
    };
    fetchCategories();

    // Fetch recipe data from Firestore to ensure we have complete, up-to-date data
    const fetchRecipeData = async () => {
      if (!restaurantId || !recipeId || !initialCategory) return;
      
      try {
        const recipeDoc = await getDoc(
          getRestaurantSubDoc(restaurantId, "recipes", "categories", initialCategory, recipeId)
        );
        
        if (recipeDoc.exists()) {
          const recipeData = recipeDoc.data();
          
          // Handle recipe name - check both "recipe name" and "recipeName" fields
          const name = recipeData["recipe name"] || recipeData.recipeName || "";
          setRecipeName(name);
          
          setIngredients(recipeData.ingredients || []);
          setInstructions(recipeData.instructions || []);
          setNotes(recipeData.notes || "");
          
          // Handle images - it can be an array or a single string
          if (recipeData.image) {
            if (Array.isArray(recipeData.image)) {
              setImages(recipeData.image);
            } else if (typeof recipeData.image === "string") {
              setImages([recipeData.image]);
            }
          } else {
            setImages([]);
          }
        }
      } catch (error) {
        console.error("Error fetching recipe data:", error);
        // Fallback to initialRecipe if fetch fails
        if (initialRecipe) {
          const name = initialRecipe["recipe name"] || initialRecipe.recipeName || "";
          setRecipeName(name);
          setIngredients(initialRecipe.ingredients || []);
          setInstructions(initialRecipe.instructions || []);
          setNotes(initialRecipe.notes || "");
          
          if (initialRecipe.image) {
            if (Array.isArray(initialRecipe.image)) {
              setImages(initialRecipe.image);
            } else if (typeof initialRecipe.image === "string") {
              setImages([initialRecipe.image]);
            }
          } else {
            setImages([]);
          }
        }
      }
    };
    
    fetchRecipeData();
  }, [restaurantId, recipeId, initialCategory, initialRecipe]);

  // Image picker - add new image
  const pickImage = async () => {
    if (images.length >= 8) {
      Alert.alert("Maximum Images", "You can only add up to 8 images.");
      return;
    }
    
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setImages([...images, result.assets[0].uri]);
    }
  };

  // Delete image
  const handleDeleteImage = (index) => {
    Alert.alert(
      "Delete Image",
      "Are you sure you want to delete this image?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            const updatedImages = images.filter((_, i) => i !== index);
            setImages(updatedImages);
          },
        },
      ]
    );
  };

  // Add ingredient
  const handleAddIngredient = () => {
    if (ingredientInput.trim()) {
      setIngredients([...ingredients, ingredientInput.trim()]);
      setIngredientInput("");
    }
  };

  // Remove ingredient
  const handleRemoveIngredient = (idx) => {
    setIngredients(ingredients.filter((_, i) => i !== idx));
  };

  // Add instruction
  const handleAddInstruction = () => {
    if (instructionInput.trim()) {
      setInstructions([...instructions, instructionInput.trim()]);
      setInstructionInput("");
    }
  };

  // Remove instruction
  const handleRemoveInstruction = (idx) => {
    setInstructions(instructions.filter((_, i) => i !== idx));
  };

  // Update ingredient
  const handleUpdateIngredient = (idx, newValue) => {
    const updatedIngredients = [...ingredients];
    updatedIngredients[idx] = newValue;
    setIngredients(updatedIngredients);
  };

  // Update instruction
  const handleUpdateInstruction = (idx, newValue) => {
    const updatedInstructions = [...instructions];
    updatedInstructions[idx] = newValue;
    setInstructions(updatedInstructions);
  };

  // Update recipe in Firestore
  const handleUpdateRecipe = async () => {
    if (!restaurantId || !category || !recipeName.trim() || ingredients.length === 0 || instructions.length === 0) {
      Alert.alert("Please fill all required fields.");
      return;
    }
    setLoading(true);
    try {
      // Upload images that aren't already URLs (local images need to be uploaded)
      const uploadedImages = [];
      const uploadedThumbs = [];
      for (const imageUri of images) {
        // If already a URL (from Firebase Storage), keep it
        if (imageUri.startsWith('http://') || imageUri.startsWith('https://')) {
          console.log('✅ Image already uploaded, keeping URL:', imageUri);
          uploadedImages.push(imageUri);
          uploadedThumbs.push(imageUri); // Use same URL as fallback for existing images
        } else {
          // Otherwise, upload to Firebase Storage
          try {
            console.log('📤 Uploading local image:', imageUri);
            const uploadResult = await uploadImageToStorage(imageUri, restaurantId, recipeId);
            // Handle both new format {fullUrl, thumbUrl} and legacy string format
            if (typeof uploadResult === 'object' && uploadResult.fullUrl) {
              console.log('✅ Image uploaded successfully:', uploadResult.fullUrl);
              uploadedImages.push(uploadResult.fullUrl);
              uploadedThumbs.push(uploadResult.thumbUrl);
            } else {
              // Legacy format (string)
              console.log('✅ Image uploaded successfully:', uploadResult);
              uploadedImages.push(uploadResult);
              uploadedThumbs.push(uploadResult);
            }
          } catch (error) {
            console.error('❌ Error uploading image:', error);
            Alert.alert("Upload Error", `Failed to upload image: ${error.message}. Please try again.`);
            setLoading(false);
            return; // Stop the save process if upload fails
          }
        }
      }

      const recipeData = {
        "recipe name": recipeName.trim(),
        category,
        ingredients,
        instructions,
        notes,
        image: uploadedImages.length > 0 ? uploadedImages : ["https://placehold.co/200x200?text=No+Image"],
        restaurantId, // Add restaurantId for collectionGroup queries
        updatedAt: serverTimestamp(),
      };
      
      // Add thumbnail field(s) if we have thumbnails
      if (uploadedThumbs.length > 0) {
        // Check if all thumbs are different from full images
        const hasUniqueThumbs = uploadedThumbs.some((thumb, idx) => thumb !== uploadedImages[idx]);
        if (hasUniqueThumbs) {
          // Use array format if multiple images, single string if one image
          recipeData.thumbs = uploadedThumbs.length === 1 ? uploadedThumbs[0] : uploadedThumbs;
        }
      }

      // Preserve createdAt timestamp if it exists
      if (initialRecipe?.createdAt) {
        recipeData.createdAt = initialRecipe.createdAt;
      }

      // If category changed, we need to move the document
      if (category !== initialCategory) {
        // Create in new category (preserving createdAt if it exists)
        await addDoc(
          getRestaurantSubCollection(restaurantId, "recipes", "categories", category),
          recipeData
        );
        // Delete from old category
        await deleteDoc(
          getRestaurantSubDoc(restaurantId, "recipes", "categories", initialCategory, recipeId)
        );
      } else {
        // Just update in the same category (don't overwrite createdAt)
        const updateData = { ...recipeData };
        delete updateData.createdAt; // Don't update createdAt on existing doc
        await updateDoc(
          getRestaurantSubDoc(restaurantId, "recipes", "categories", category, recipeId),
          updateData
        );
      }

      Alert.alert("Recipe updated!");
      // Navigate back to recipe detail if category didn't change, otherwise go to recipes list
      if (category === initialCategory) {
        // Navigate back to recipe detail (will refresh automatically via focus listener)
        navigation.goBack();
      } else {
        // Category changed, navigate back to recipes list (will refresh automatically via focus listener)
        navigation.navigate("Recipes");
      }
    } catch (e) {
      Alert.alert("Error", "Could not update recipe.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerIcon}>
            <Ionicons name="arrow-back" size={28} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Edit Recipe</Text>
            <Text style={styles.date}>{date}</Text>
          </View>
        </View>

        {/* Images Section */}
        <Text style={styles.sectionTitle}>Images ({images.length}/8)</Text>
        <View style={styles.imagesContainer}>
          {images.map((imageUri, index) => (
            <View key={index} style={styles.imageWrapper}>
              <Image source={{ uri: imageUri }} style={styles.imageThumbnail} />
              <TouchableOpacity
                style={styles.deleteImageButton}
                onPress={() => handleDeleteImage(index)}
                activeOpacity={0.7}
              >
                <Ionicons name="close-circle" size={24} color={Colors.error} />
              </TouchableOpacity>
            </View>
          ))}
          {images.length < 8 && (
            <TouchableOpacity
              style={styles.addImageButton}
              onPress={pickImage}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={32} color={Colors.gray400} />
              <Text style={styles.addImageText}>Add Image</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Recipe Name */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Recipe Name</Text>
          <TextInput
            style={styles.input}
            value={recipeName}
            onChangeText={setRecipeName}
            placeholder="Enter recipe name"
            placeholderTextColor={Colors.gray300}
          />
        </View>

        {/* Ingredients */}
        <Text style={styles.sectionTitle}>Ingredients</Text>
        <View style={styles.ingredientList}>
          {ingredients.map((ingredient, idx) => (
            <View key={idx} style={styles.ingredientRow}>
              <Text style={styles.ingredientIndex}>{idx + 1}.</Text>
              <TextInput
                style={styles.editableIngredientText}
                value={ingredient}
                onChangeText={(text) => handleUpdateIngredient(idx, text)}
                placeholder="Enter ingredient"
                placeholderTextColor={Colors.gray300}
                multiline
              />
              <TouchableOpacity onPress={() => handleRemoveIngredient(idx)}>
                <MaterialIcons name="delete" size={20} color={Colors.error} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
        <View style={styles.addRow}>
          <TextInput
            style={styles.input}
            value={ingredientInput}
            onChangeText={setIngredientInput}
            placeholder="Add ingredient"
            placeholderTextColor={Colors.gray300}
          />
          <TouchableOpacity style={styles.addButton} onPress={handleAddIngredient}>
            <Text style={styles.addButtonText}>Add Ingredient</Text>
          </TouchableOpacity>
        </View>

        {/* Instructions */}
        <Text style={styles.sectionTitle}>Instructions</Text>
        <View style={styles.ingredientList}>
          {instructions.map((instruction, idx) => (
            <View key={idx} style={styles.instructionRow}>
              <Text style={styles.ingredientIndex}>{idx + 1}.</Text>
              <TextInput
                style={styles.editableInstructionText}
                value={instruction}
                onChangeText={(text) => handleUpdateInstruction(idx, text)}
                placeholder="Enter instruction"
                placeholderTextColor={Colors.gray300}
                multiline
              />
              <TouchableOpacity onPress={() => handleRemoveInstruction(idx)}>
                <MaterialIcons name="delete" size={20} color={Colors.error} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
        <View style={styles.addRow}>
          <TextInput
            style={styles.input}
            value={instructionInput}
            onChangeText={setInstructionInput}
            placeholder="Add instruction"
            placeholderTextColor={Colors.gray300}
          />
          <TouchableOpacity style={styles.addButton} onPress={handleAddInstruction}>
            <Text style={styles.addButtonText}>Add Instruction</Text>
          </TouchableOpacity>
        </View>

        {/* Allergen */}
        <Text style={styles.sectionTitle}>Allergen</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Add allergen information (optional)"
          placeholderTextColor={Colors.gray300}
          multiline
        />

        {/* Save Button */}
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleUpdateRecipe}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Text style={styles.saveButtonText}>{loading ? "Saving..." : "Save Changes"}</Text>
        </TouchableOpacity>
        {/* Cancel Button */}
        <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingTop: 0,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
    marginHorizontal: Spacing.sm
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    paddingTop: Spacing.lg + getAndroidTitleMargin(),
  },
  headerIcon: {
    padding: 8,
    marginRight: 8,
  },
  title: {
    fontSize: 22,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
  },
  date: {
    fontSize: Typography.md,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  imagesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: 20,
    marginBottom: 24,
    marginRight: 20,
  },
  imageWrapper: {
    position: "relative",
    width: "30%",
    aspectRatio: 1,
    marginBottom: 12,
    marginRight: "3.33%",
  },
  imageThumbnail: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
    backgroundColor: Colors.gray100,
  },
  deleteImageButton: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "#fff",
    borderRadius: 12,
    zIndex: 1,
  },
  addImageButton: {
    width: "30%",
    aspectRatio: 1,
    borderWidth: 2,
    borderColor: Colors.gray200,
    borderStyle: "dashed",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fafbfc",
    marginBottom: 12,
    marginRight: "3.33%",
  },
  addImageText: {
    color: Colors.gray400,
    fontSize: Typography.sm,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 8,
  },
  inputGroup: {
    marginHorizontal: 20,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  categoryChip: {
    backgroundColor: Colors.gray100,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 50,
    marginRight: 10,
  },
  activeCategoryChip: {
    backgroundColor: Colors.primary,
  },
  categoryChipText: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
  },
  activeCategoryChipText: {
    color: Colors.background,
    fontWeight: "bold",
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.gray200,
    borderRadius: 8,
    padding: 14,
    fontSize: Typography.base,
    color: Colors.textPrimary,
    backgroundColor: "#fff",
    marginBottom: 0,
    flex: 1,
  },
  ingredientList: {
    marginBottom: 0,
  },
  ingredientRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 0,
    borderWidth: 1,
    borderColor: Colors.gray100,
  },
  instructionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: "#f7f7f7",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 0,
    borderWidth: 1,
    borderColor: Colors.gray100,
  },
  ingredientIndex: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    marginRight: 8,
    marginLeft: 8,
    paddingHorizontal: 5,
  },
  ingredientText: {
    fontSize: Typography.base,
    color: Colors.textPrimary,
    flex: 1,
    paddingRight: 40
  },
  editableIngredientText: {
    fontSize: Typography.base,
    color: Colors.textPrimary,
    flex: 1,
    paddingRight: 8,
    paddingLeft: 0,
    paddingVertical: 4,
    borderWidth: 0,
    backgroundColor: "transparent",
  },
  editableInstructionText: {
    fontSize: Typography.base,
    color: Colors.textPrimary,
    flex: 1,
    paddingRight: 8,
    paddingLeft: 0,
    paddingVertical: 4,
    borderWidth: 0,
    backgroundColor: "transparent",
    textAlignVertical: "top",
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 16,
    marginTop: 0,
  },
  addButton: {
    backgroundColor: "#19C37D",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 18,
    marginLeft: 10,
  },
  addButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: Typography.sm,
  },
  notesInput: {
    minHeight: 100,
    marginHorizontal: 20,
    marginTop: 0,
    marginBottom: 0,
    textAlignVertical: "top",
  },
  saveButton: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 18,
    marginHorizontal: 20,
    marginTop: 32,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: Typography.base,
    fontFamily: Typography.fontBold,
  },
  cancelButton: {
    alignItems: "center",
    marginTop: 20,
    marginBottom: 24,
  },
  cancelButtonText: {
    color: Colors.gray400,
    fontSize: Typography.base,
  },
});

