/**
 * Modal for adding or editing a fridge/freezer.
 */
import React, { useState, useEffect } from "react";
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
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../constants/Colors";
import { Typography } from "../../constants/Typography";
import { Spacing } from "../../constants/Spacing";

const FRIDGE_TYPES = [
  { value: "fridge", label: "Fridge", icon: "thermometer-outline" },
  { value: "freezer", label: "Freezer", icon: "snow-outline" },
];

export default function AddFridgeModal({
  visible,
  onClose,
  onSave,
  onDelete,
  editingFridge,
}) {
  const [fridgeName, setFridgeName] = useState("");
  const [fridgeType, setFridgeType] = useState("fridge");
  const [saving, setSaving] = useState(false);

  const isEdit = !!editingFridge?.id;

  useEffect(() => {
    if (!visible) return;
    if (editingFridge) {
      setFridgeName(editingFridge.fridgeName || "");
      setFridgeType(editingFridge.fridgeType || "fridge");
    } else {
      setFridgeName("");
      setFridgeType("fridge");
    }
    setSaving(false);
  }, [visible, editingFridge]);

  const handleSave = async () => {
    const name = fridgeName.trim();
    if (!name) return;

    setSaving(true);
    try {
      await onSave({
        fridgeName: name,
        fridgeType,
        id: editingFridge?.id,
      });
      onClose();
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Could not save fridge.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!editingFridge?.id || !onDelete) return;
    Alert.alert("Delete fridge", "Remove this fridge/freezer from the list?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await onDelete(editingFridge.id);
            onClose();
          } catch (e) {
            Alert.alert("Error", "Could not delete.");
          }
        },
      },
    ]);
  };

  const canSave = fridgeName.trim().length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
        <View style={styles.modal}>
          <View style={styles.header}>
            <View style={styles.titleContainer}>
              <Text style={styles.title}>{isEdit ? "Edit fridge" : "Add fridge"}</Text>
              <Text style={styles.sub}>Name and type</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={28} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Fridge name</Text>
            <TextInput
              style={styles.input}
              value={fridgeName}
              onChangeText={setFridgeName}
              placeholder="e.g. Walk-in Fridge, Prep Fridge"
              placeholderTextColor={Colors.gray400}
              autoCapitalize="words"
            />

            <Text style={[styles.label, { marginTop: Spacing.lg }]}>Type</Text>
            <View style={styles.typeWrap}>
              {FRIDGE_TYPES.map(({ value, label, icon }) => {
                const on = fridgeType === value;
                return (
                  <TouchableOpacity
                    key={value}
                    style={[styles.typeChip, on && styles.typeChipOn]}
                    onPress={() => setFridgeType(value)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={icon}
                      size={20}
                      color={on ? "#fff" : Colors.textSecondary}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[styles.typeChipText, on && styles.typeChipTextOn]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {isEdit && onDelete ? (
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
              <Text style={styles.deleteBtnText}>Delete fridge</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={[styles.addButton, !canSave && styles.addButtonDisabled]}
            onPress={handleSave}
            disabled={!canSave || saving}
          >
            <Text style={styles.addButtonText}>{saving ? "Saving…" : isEdit ? "Save changes" : "Add fridge"}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  modal: {
    backgroundColor: Colors.background || "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    maxHeight: "88%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  titleContainer: { flex: 1, paddingRight: Spacing.sm },
  title: { fontSize: Typography.xl, fontFamily: Typography.fontBold, color: Colors.textPrimary },
  sub: { fontSize: Typography.sm, color: Colors.textSecondary, marginTop: 4 },
  label: { fontSize: Typography.base, color: Colors.textSecondary, marginBottom: Spacing.sm },
  input: {
    fontSize: Typography.lg,
    fontFamily: Typography.fontMedium,
    color: Colors.textPrimary,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#f8fafc",
  },
  typeWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: Spacing.xs },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  typeChipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeChipText: { fontFamily: Typography.fontMedium, color: Colors.textSecondary, fontSize: 15 },
  typeChipTextOn: { color: "#fff" },
  deleteBtn: { paddingVertical: 12, alignItems: "center", marginBottom: Spacing.sm },
  deleteBtnText: { color: "#dc2626", fontFamily: Typography.fontMedium, fontSize: 16 },
  addButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  addButtonDisabled: { opacity: 0.45 },
  addButtonText: { color: "#fff", fontFamily: Typography.fontBold, fontSize: 18 },
});
