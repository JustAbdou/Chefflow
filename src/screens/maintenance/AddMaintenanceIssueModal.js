import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Colors } from "../../constants/Colors";
import { Typography } from "../../constants/Typography";
import { Spacing } from "../../constants/Spacing";
import Button from "../../components/ui/Button";

export default function AddMaintenanceIssueModal({ visible, onClose, onAdd }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Maintenance");

  const categories = ["Maintenance", "Equipment", "Incident"];

  const handleAdd = () => {
    if (!title.trim()) {
      return;
    }

    onAdd({
      title: title.trim(),
      description: description.trim(),
      category: category,
      status: "Open", // Default status
    });

    // Reset form
    setTitle("");
    setDescription("");
    setCategory("Maintenance");
  };

  React.useEffect(() => {
    if (!visible) {
      setTitle("");
      setDescription("");
      setCategory("Maintenance");
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
          <View style={styles.modal}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.titleContainer}>
                  <Text style={styles.title}>Log an Issue</Text>
                </View>
                <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
                  <Text style={styles.closeText}>×</Text>
                </TouchableOpacity>
              </View>

              {/* Form */}
              <View style={styles.form}>
                <Text style={styles.label}>Issue Title *</Text>
                <TextInput
                  style={styles.input}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="e.g., Walk-in fridge not cooling"
                  placeholderTextColor={Colors.gray200}
                  autoFocus
                />
                
                <Text style={[styles.label, { marginTop: Spacing.lg }]}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Additional details (optional)"
                  placeholderTextColor={Colors.gray200}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />

                <Text style={[styles.label, { marginTop: Spacing.lg }]}>Category</Text>
                <View style={styles.selectorContainer}>
                  {categories.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.selectorChip,
                        category === cat && styles.activeSelectorChip,
                      ]}
                      onPress={() => setCategory(cat)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.selectorText,
                          category === cat && styles.activeSelectorText,
                        ]}
                        numberOfLines={1}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Save Button */}
              <View style={styles.buttonContainer}>
                <Button 
                  onPress={handleAdd} 
                  disabled={!title.trim()} 
                  fullWidth 
                  size="lg"
                >
                  Log Issue
                </Button>
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modal: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    maxHeight: '90%',
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.xl,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: Typography.xl,
    fontWeight: "bold",
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  closeText: {
    fontSize: 24,
    color: Colors.textSecondary,
    fontWeight: "300",
  },
  form: {
    marginBottom: Spacing.xl,
  },
  label: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  input: {
    fontSize: Typography.lg,
    fontWeight: "600",
    color: Colors.textPrimary,
    paddingVertical: Spacing.sm,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  textArea: {
    minHeight: 100,
    paddingTop: Spacing.sm,
  },
  selectorContainer: {
    flexDirection: "row",
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  selectorChip: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.gray100,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    minWidth: 0,
  },
  activeSelectorChip: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  selectorText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.medium,
    textAlign: "center",
  },
  activeSelectorText: {
    color: Colors.background,
  },
  buttonContainer: {
    marginTop: "auto",
    paddingTop: Spacing.md,
  },
});

