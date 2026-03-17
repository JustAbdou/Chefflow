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
import { DAYS_OF_WEEK } from "../../utils/cleaningHelpers";

export default function AddCleaningTaskModal({
  visible,
  onClose,
  onSave,
  date,
  editingTask,
  onDelete,
}) {
  const [taskName, setTaskName] = useState("");
  const [selectedDays, setSelectedDays] = useState([]);
  const [saving, setSaving] = useState(false);

  const isEdit = !!editingTask?.id;

  useEffect(() => {
    if (!visible) return;
    if (editingTask) {
      setTaskName(editingTask.taskName || editingTask.name || "");
      setSelectedDays(Array.isArray(editingTask.daysOfWeek) ? [...editingTask.daysOfWeek] : []);
    } else {
      setTaskName("");
      setSelectedDays([]);
    }
    setSaving(false);
  }, [visible, editingTask]);

  const toggleDay = (day) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSave = async () => {
    const name = taskName.trim();
    if (!name) return;
    if (selectedDays.length === 0) return;
    setSaving(true);
    try {
      await onSave({
        taskName: name,
        daysOfWeek: selectedDays,
        id: editingTask?.id,
      });
      onClose();
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Could not save task.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!editingTask?.id || !onDelete) return;
    Alert.alert("Delete task", "Remove this recurring task?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await onDelete(editingTask.id);
            onClose();
          } catch (e) {
            Alert.alert("Error", "Could not delete.");
          }
        },
      },
    ]);
  };

  const canSave = taskName.trim().length > 0 && selectedDays.length > 0;

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
              <Text style={styles.title}>{isEdit ? "Edit cleaning task" : "Add cleaning task"}</Text>
              {date ? <Text style={styles.date}>{date}</Text> : null}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={28} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Task name</Text>
            <TextInput
              style={styles.input}
              value={taskName}
              onChangeText={setTaskName}
              placeholder="e.g. Deep clean fridge handles"
              placeholderTextColor={Colors.gray400}
            />

            <Text style={[styles.label, { marginTop: Spacing.lg }]}>Days of week (at least one)</Text>
            <View style={styles.daysWrap}>
              {DAYS_OF_WEEK.map((day) => {
                const on = selectedDays.includes(day);
                return (
                  <TouchableOpacity
                    key={day}
                    style={[styles.dayChip, on && styles.dayChipOn]}
                    onPress={() => toggleDay(day)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.dayChipText, on && styles.dayChipTextOn]}>{day.slice(0, 3)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.hint}>Full days: {selectedDays.join(", ") || "None"}</Text>
          </ScrollView>

          {isEdit && onDelete ? (
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
              <Text style={styles.deleteBtnText}>Delete task</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={[styles.addButton, !canSave && styles.addButtonDisabled]}
            onPress={handleSave}
            disabled={!canSave || saving}
          >
            <Text style={styles.addButtonText}>{saving ? "Saving…" : isEdit ? "Save changes" : "Add task"}</Text>
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
  date: { fontSize: Typography.sm, color: Colors.textSecondary, marginTop: 4 },
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
  daysWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dayChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  dayChipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dayChipText: { fontFamily: Typography.fontMedium, color: Colors.textSecondary, fontSize: 14 },
  dayChipTextOn: { color: "#fff" },
  hint: { fontSize: 12, color: Colors.textSecondary, marginTop: Spacing.sm, marginBottom: Spacing.md },
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
