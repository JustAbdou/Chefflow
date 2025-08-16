import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Image, Alert, Platform,
} from "react-native";
import { Colors } from "../../constants/Colors";
import { Typography } from "../../constants/Typography";
import { Spacing } from "../../constants/Spacing";
import { addDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { useRestaurant } from "../../contexts/RestaurantContext";
import { getRestaurantDoc, getRestaurantSubCollection } from "../../utils/firestoreHelpers";
import * as ImagePicker from "expo-image-picker";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";

export default function AddRecipeScreen({ navigation }) {
  const { restaurantId } = useRestaurant();
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState([]);
  const [recipeName, setRecipeName] = useState("");
  const [ingredients, setIngredients] = useState([]);
  const [instructions, setInstructions] = useState([]);
  const [notes, setNotes] = useState("");
  const [ingredientInput, setIngredientInput] = useState("");
  const [instructionInput, setInstructionInput] = useState("");
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const today = new Date();
    setDate(today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }));
    
    const fetchCategories = async () => {
      if (!restaurantId) return;
      
      const categoriesDoc = await getDoc(getRestaurantDoc(restaurantId, "recipes", "categories"));
      const data = categoriesDoc.data();
      setCategories(data?.names || []);
      if (!category && data?.names?.length) setCategory(data.names[0]);
    };
    
    fetchCategories();
  }, [restaurantId]);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      setImage(result.assets[0].uri);
    }
  };

  const handleAddIngredient = () => {
    if (ingredientInput.trim()) {
      setIngredients([...ingredients, ingredientInput.trim()]);
      setIngredientInput("");
    }
  };

  const handleRemoveIngredient = (idx) => {
    setIngredients(ingredients.filter((_, i) => i !== idx));
  };

  const handleAddInstruction = () => {
    if (instructionInput.trim()) {
      setInstructions([...instructions, instructionInput.trim()]);
      setInstructionInput("");
    }
  };
  const handleRemoveInstruction = (idx) => {
    setInstructions(instructions.filter((_, i) => i !== idx));
  };

  const handleAddRecipe = async () => {
    if (!restaurantId || !category || !recipeName.trim() || ingredients.length === 0 || instructions.length === 0) {
      Alert.alert("Please fill all required fields.");
      return;
    }

    setLoading(true);
    try {
      const recipeData = {
        "recipe name": recipeName.trim(),
        category,
        ingredients,
        instructions,
        notes,
        image: image || "https://firebasestorage.googleapis.com/v0/b/chefflow-67b1f.appspot.com/o/default-recipe.jpg?alt=media&token=default-recipe-token",
        createdAt: serverTimestamp(),
      };

      await addDoc(
        getRestaurantSubCollection(restaurantId, "recipes", "categories", category),
        recipeData
      );

      Alert.alert("Recipe added!");
      navigation.goBack();
    } catch (e) {
      Alert.alert("Error", "Could not add recipe.");
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
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerIcon}>
            <Ionicons name="arrow-back" size={28} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Add Recipe</Text>
            <Text style={styles.date}>{date}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.imagePicker} onPress={pickImage} activeOpacity={0.7}>
          {image ? (
            <Image source={{ uri: image }} style={styles.image} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="camera-outline" size={40} color={Colors.gray300} />
              <Text style={styles.imagePlaceholderText}>Tap to take or upload a photo{"\n"}(Optional)</Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Recipe Details</Text>
        
        <View style={styles.inputGroup}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 0 }}>
            {categories.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryChip,
                  category === cat && styles.activeCategoryChip,
                ]}
                onPress={() => setCategory(cat)}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    category === cat && styles.activeCategoryChipText,
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

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

        <Text style={styles.sectionTitle}>Ingredients</Text>
        <View style={styles.ingredientList}>
          {ingredients.map((ingredient, idx) => (
            <View key={idx} style={styles.ingredientRow}>
              <Text style={styles.ingredientIndex}>{idx + 1}.</Text>
              <Text style={styles.ingredientText}>{ingredient}</Text>
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

        <Text style={styles.sectionTitle}>Instructions</Text>
        <View style={styles.ingredientList}>
          {instructions.map((instruction, idx) => (
            <View key={idx} style={styles.instructionRow}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={styles.ingredientIndex}>{idx + 1}.</Text>
                <Text style={styles.ingredientText}>{instruction.split("\n")[0]}</Text>
              </View>
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

        <Text style={styles.sectionTitle}>Notes</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Add any additional notes or tips (optional)"
          placeholderTextColor={Colors.gray300}
          multiline
        />

        <TouchableOpacity
          style={styles.addRecipeButton}
          onPress={handleAddRecipe}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Text style={styles.addRecipeButtonText}>{loading ? "Adding..." : "Add Recipe"}</Text>
        </TouchableOpacity>

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
    marginTop: Platform.OS === "ios" ? 16 : 12,
    marginHorizontal: 20,
    marginBottom: 8,
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
  imagePicker: {
    borderWidth: 1,
    borderColor: Colors.gray200,
    borderRadius: 12,
    marginHorizontal: 20,
    marginVertical: 24,
    height: 200,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fafbfc",
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: 180,
    borderRadius: 12,
  },
  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    width: "100%",
    height: "100%",
  },
  imagePlaceholderText: {
    color: Colors.gray300,
    fontSize: Typography.base,
    textAlign: "center",
    marginTop: 8,
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
  dropdown: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.gray200,
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fff",
    marginBottom: 4,
  },
  dropdownText: {
    fontSize: Typography.base,
    color: Colors.textPrimary,
    flex: 1,
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
    alignItems: "center",
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
  addRecipeButton: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 18,
    marginHorizontal: 20,
    marginTop: 32,
    alignItems: "center",
  },
  addRecipeButtonText: {
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