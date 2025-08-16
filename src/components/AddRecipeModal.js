import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  Platform,
  Alert,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import * as ImagePicker from "expo-image-picker";
import { addDoc } from "firebase/firestore";
import { useRestaurant } from "../contexts/RestaurantContext";
import { getRestaurantSubCollection } from "../utils/firestoreHelpers";
import { Colors } from "../constants/Colors";
import { Typography } from "../constants/Typography";
import { Spacing } from "../constants/Spacing";
const today = new Date();
const dateString = today.toLocaleDateString("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
});
const categories = ["Main", "Desserts", "Starters"];
export default function AddRecipeModal({ visible, onClose, onRecipeAdded }) {
  const { restaurantId } = useRestaurant();
  const [image, setImage] = useState(null);
  const [category, setCategory] = useState(categories[0]);
  const [name, setName] = useState("");
  const [ingredients, setIngredients] = useState([]);
  const [instructions, setInstructions] = useState([]);
  const [notes, setNotes] = useState("");
  const [ingredientInput, setIngredientInput] = useState("");
  const [instructionTitle, setInstructionTitle] = useState("");
  const [instructionDesc, setInstructionDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });
    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };
  const addIngredient = () => {
    if (ingredientInput.trim()) {
      setIngredients([...ingredients, ingredientInput.trim()]);
      setIngredientInput("");
    }
  };
  const removeIngredient = idx => {
    setIngredients(ingredients.filter((_, i) => i !== idx));
  };
  const addInstruction = () => {
    if (instructionTitle.trim()) {
      setInstructions([
        ...instructions,
        { title: instructionTitle.trim(), desc: instructionDesc.trim() },
      ]);
      setInstructionTitle("");
      setInstructionDesc("");
    }
  };
  const removeInstruction = idx => {
    setInstructions(instructions.filter((_, i) => i !== idx));
  };
  const handleAddRecipe = async () => {
    if (!restaurantId || !name.trim() || !category || ingredients.length === 0 || instructions.length === 0) {
      Alert.alert("Please fill all required fields.");
      return;
    }
    setLoading(true);
    try {
      await addDoc(
        getRestaurantSubCollection(restaurantId, "recipes", "categories", category),
        {
          "recipe name": name,
          image: image || "",
          ingredients,
          instructions: instructions.map(
            step => `${step.title}. ${step.desc}`
          ),
          notes,
        }
      );
      onRecipeAdded && onRecipeAdded();
      onClose();
      setImage(null);
      setCategory(categories[0]);
      setName("");
      setIngredients([]);
      setInstructions([]);
      setNotes("");
    } catch (e) {
      Alert.alert("Error", "Could not add recipe.");
    }
    setLoading(false);
  };
  return (
    <Modal visible={visible} animationType="slide">
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={onClose} style={styles.headerIcon}>
            <Text style={styles.headerIconText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Recipe</Text>
        </View>
        <Text style={styles.dateText}>{dateString}</Text>
        <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
          {image ? (
            <Image source={{ uri: image }} style={styles.image} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.cameraIcon}>📷</Text>
              <Text style={styles.imageText}>Tap to take or upload a photo{"\n"}<Text style={{ color: Colors.gray400 }}>(Optional)</Text></Text>
            </View>
          )}
        </TouchableOpacity>
        <Text style={styles.sectionTitle}>Recipe Details</Text>
        <View style={styles.inputCard}>
          <Picker
            selectedValue={category}
            onValueChange={setCategory}
            style={styles.picker}
            itemStyle={styles.pickerItem}
          >
            {categories.map(cat => (
              <Picker.Item label={cat} value={cat} key={cat} />
            ))}
          </Picker>
        </View>
        <View style={styles.inputCard}>
          <TextInput
            placeholder="Recipe Name"
            value={name}
            onChangeText={setName}
            style={styles.input}
            placeholderTextColor={Colors.gray400}
          />
        </View>
        <Text style={styles.sectionTitle}>Ingredients</Text>
        {ingredients.map((ing, idx) => (
          <View key={idx} style={styles.listItem}>
            <Text style={styles.listIndex}>{idx + 1}.</Text>
            <Text style={styles.listText}>{ing}</Text>
            <TouchableOpacity onPress={() => removeIngredient(idx)}>
              <Text style={styles.deleteIcon}>🗑️</Text>
            </TouchableOpacity>
          </View>
        ))}
        <View style={styles.addRow}>
          <TextInput
            placeholder="Add Ingredient"
            value={ingredientInput}
            onChangeText={setIngredientInput}
            style={styles.input}
            placeholderTextColor={Colors.gray400}
          />
          <TouchableOpacity style={styles.addBtn} onPress={addIngredient}>
            <Text style={styles.addBtnText}>Add Ingredient</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.sectionTitle}>Instructions</Text>
        {instructions.map((ins, idx) => (
          <View key={idx} style={styles.instructionCard}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={styles.listIndex}>{idx + 1}.</Text>
              <Text style={styles.listTextBold}>{ins.title}</Text>
              <TouchableOpacity onPress={() => removeInstruction(idx)}>
                <Text style={styles.deleteIcon}>🗑️</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.instructionDesc}>{ins.desc}</Text>
          </View>
        ))}
        <View style={styles.addRow}>
          <TextInput
            placeholder="Step Title"
            value={instructionTitle}
            onChangeText={setInstructionTitle}
            style={styles.input}
            placeholderTextColor={Colors.gray400}
          />
          <TextInput
            placeholder="Step Description"
            value={instructionDesc}
            onChangeText={setInstructionDesc}
            style={styles.input}
            placeholderTextColor={Colors.gray400}
          />
          <TouchableOpacity style={styles.addBtn} onPress={addInstruction}>
            <Text style={styles.addBtnText}>Add Instruction</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.sectionTitle}>Notes</Text>
        <View style={styles.notesCard}>
          <TextInput
            placeholder="Add any additional notes or tips (optional)"
            value={notes}
            onChangeText={setNotes}
            style={styles.notesInput}
            placeholderTextColor={Colors.gray400}
            multiline
          />
        </View>
        <TouchableOpacity
          style={styles.addRecipeBtn}
          onPress={handleAddRecipe}
          disabled={loading}
        >
          <Text style={styles.addRecipeBtnText}>Add Recipe</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: Platform.OS === "android" ? 40 : 0,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.lg,
    marginHorizontal: Spacing.lg,
    marginBottom: 0,
  },
  headerIcon: {
    padding: 8,
    marginRight: 8,
  },
  headerIconText: {
    fontSize: 28,
    color: Colors.textPrimary,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
    marginLeft: 0,
  },
  dateText: {
    color: Colors.gray400,
    fontSize: Typography.base,
    marginLeft: Spacing.lg,
    marginBottom: Spacing.md,
  },
  imagePicker: {
    width: "92%",
    height: 160,
    alignSelf: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.gray200,
    backgroundColor: Colors.gray50,
    marginBottom: Spacing.lg,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
    borderRadius: 16,
  },
  imagePlaceholder: {
    justifyContent: "center",
    alignItems: "center",
    flex: 1,
  },
  cameraIcon: {
    fontSize: 36,
    color: Colors.gray400,
    marginBottom: 6,
  },
  imageText: {
    color: Colors.gray400,
    fontSize: Typography.base,
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: Typography.lg,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
    marginLeft: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  inputCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.gray200,
  },
  picker: {
    width: "100%",
    color: Colors.textPrimary,
  },
  pickerItem: {
    fontSize: Typography.base,
  },
  input: {
    fontSize: Typography.base,
    color: Colors.textPrimary,
    paddingVertical: 8,
    paddingHorizontal: 0,
    backgroundColor: "transparent",
    flex: 1,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    marginHorizontal: Spacing.lg,
    marginBottom: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.gray200,
  },
  listIndex: {
    fontSize: Typography.base,
    color: Colors.textPrimary,
    marginRight: 6,
    fontWeight: "bold",
  },
  listText: {
    fontSize: Typography.base,
    color: Colors.textPrimary,
    flex: 1,
  },
  listTextBold: {
    fontSize: Typography.base,
    color: Colors.textPrimary,
    fontWeight: "bold",
    marginRight: 8,
  },
  deleteIcon: {
    fontSize: 18,
    color: Colors.error,
    marginLeft: 8,
  },
  addRow: {
    flexDirection: "column",
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    gap: 6,
  },
  addBtn: {
    backgroundColor: Colors.success,
    borderRadius: 8,
    paddingVertical: 10,
    marginTop: 6,
    alignItems: "center",
  },
  addBtnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: Typography.base,
  },
  instructionCard: {
    backgroundColor: "#F7F8FA",
    borderRadius: 10,
    marginHorizontal: Spacing.lg,
    marginBottom: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.gray200,
  },
  instructionDesc: {
    color: Colors.textSecondary,
    fontSize: Typography.base,
    marginLeft: 24,
    marginTop: 2,
  },
  notesCard: {
    backgroundColor: "#F7F8FA",
    borderRadius: 10,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.gray200,
  },
  notesInput: {
    fontSize: Typography.base,
    color: Colors.textPrimary,
    minHeight: 40,
  },
  addRecipeBtn: {
    backgroundColor: "#2962FF",
    borderRadius: 8,
    marginHorizontal: Spacing.lg,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  addRecipeBtnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: Typography.base,
  },
  cancelBtn: {
    alignItems: "center",
    marginBottom: 32,
  },
  cancelBtnText: {
    color: Colors.gray400,
    fontSize: Typography.base,
    marginTop: 8,
  },
});