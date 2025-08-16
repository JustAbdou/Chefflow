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
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../constants/Colors";
import { Typography } from "../../constants/Typography";
import { Spacing } from "../../constants/Spacing";

export default function AddFridgeTempModal({
  visible,
  onClose,
  onSave,
  fridgeNames,
  loadingFridges,
}) {
  const [selectedFridge, setSelectedFridge] = useState(fridgeNames[0] || "");
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [tempValue, setTempValue] = useState("");
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (visible) {
      // Set the first available fridge as default, or empty string if no fridges
      setSelectedFridge(fridgeNames.length > 0 ? fridgeNames[0] : "");
      setTempValue("");
      setDropdownVisible(false);
      setSaving(false);
    }
  }, [visible, fridgeNames]);

  const handleSave = async () => {
    if (!selectedFridge || !tempValue.trim()) {
      console.log('⚠️ Missing fridge selection or temperature value');
      return;
    }
    
    // Validate that it's a valid number string
    const cleanTempValue = tempValue.replace(',', '.'); // Convert comma to dot
    const tempNumber = parseFloat(cleanTempValue);
    
    if (isNaN(tempNumber)) {
      console.log('⚠️ Invalid temperature value');
      return;
    }
    
    console.log('🌡️ Temperature string being saved:', cleanTempValue);
    
    setSaving(true);
    try {
      await onSave(selectedFridge, cleanTempValue); // Pass the clean string
      console.log('✅ Temperature saved successfully');
    } catch (error) {
      console.error('❌ Error saving temperature:', error);
    } finally {
      setSaving(false);
    }
  };

  // Format temperature input - only allow numbers, dots, and commas
  const handleTempChange = (text) => {
    // Remove any non-numeric characters except dots and commas
    let cleanText = text.replace(/[^0-9.,]/g, '');
    
    // Replace comma with dot for display
    cleanText = cleanText.replace(',', '.');
    
    // Ensure only one decimal point
    const parts = cleanText.split('.');
    if (parts.length > 2) {
      cleanText = parts[0] + '.' + parts.slice(1).join('');
    }
    
    setTempValue(cleanText);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.modalContainer}
      >
        <View style={styles.modalContent}>
          {/* Modal Header */}
          <View style={styles.modalHeaderRow}>
            <Text style={styles.modalTitle}>Set Fridge Temp</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={28} color="#222" />
            </TouchableOpacity>
          </View>
          <Text style={styles.modalDate}>
            Today, {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Text>
          <View style={styles.modalDivider} />

          {/* Set Temperature */}
          <Text style={styles.modalSectionTitle}>Set Temperature</Text>

          {/* Dropdown for fridge name under Set Temperature */}
          <TouchableOpacity
            style={styles.dropdown}
            onPress={() => setDropdownVisible(!dropdownVisible)}
            activeOpacity={0.8}
            disabled={loadingFridges}
          >
            <Text style={styles.modalFridge}>
              {selectedFridge
                ? selectedFridge
                : loadingFridges
                ? "Loading fridges..."
                : fridgeNames.length === 0
                ? "No fridges available"
                : "Select Fridge"}
            </Text>
            <Ionicons
              name={dropdownVisible ? "chevron-up" : "chevron-down"}
              size={22}
              color="#222"
              style={{ marginLeft: 6 }}
            />
          </TouchableOpacity>
          {dropdownVisible && (
            <View style={styles.dropdownList}>
              <FlatList
                data={fridgeNames}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.dropdownItem}
                    onPress={() => {
                      setSelectedFridge(item);
                      setDropdownVisible(false);
                    }}
                  >
                    <Text style={styles.dropdownItemText}>
                      {item}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          )}

          <View style={{ height: 8 }} />

          <View style={styles.tempInputCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.tempInputLabel}>Temperature</Text>
              <TextInput
                style={styles.tempInput}
                value={tempValue}
                onChangeText={handleTempChange}
                placeholder="0.0"
                placeholderTextColor="#A0A7B3"
                keyboardType="decimal-pad"
              />
            </View>
            <Text style={styles.tempUnit}>℃</Text>
          </View>

          {/* Save */}
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[
                styles.saveButton,
                (saving || !selectedFridge || !tempValue.trim() || loadingFridges) && styles.saveButtonDisabled
              ]}
              onPress={handleSave}
              disabled={saving || !selectedFridge || !tempValue.trim() || loadingFridges}
            >
              <Text style={[
                styles.saveButtonText,
                (saving || !selectedFridge || !tempValue.trim() || loadingFridges) && styles.saveButtonTextDisabled
              ]}>
                {saving ? "Saving..." : "Save"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(34, 37, 41, 0.45)",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
    minHeight: 380,
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  modalFridge: {
    fontFamily: Typography.fontBold,
    fontSize: 18,
    color: "#111",
    paddingVertical: 8,
  },
  modalTitle: {
    fontFamily: Typography.fontBold,
    fontSize: 22,
    color: "#111",
  },
  modalDate: {
    fontFamily: Typography.fontRegular,
    fontSize: 16,
    color: "#8B96A5",
    marginTop: 2,
    marginBottom: 8,
  },
  modalDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 18,
    marginHorizontal: -24,
  },
  modalSectionTitle: {
    fontFamily: Typography.fontBold,
    fontSize: 18,
    color: "#111",
    marginBottom: 14,
  },
  tempInputCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginBottom: 32,
  },
  tempInputLabel: {
    fontFamily: Typography.fontRegular,
    fontSize: 16,
    color: "#8B96A5",
    marginBottom: 2,
  },
  tempInput: {
    fontFamily: Typography.fontBold,
    fontSize: 22,
    color: "#111",
    marginTop: 2,
  },
  tempUnit: {
    fontFamily: Typography.fontBold,
    fontSize: 22,
    color: "#8B96A5",
    marginLeft: 8,
  },
  modalActions: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  saveButton: {
    flex: 1,
    backgroundColor: "#2563eb",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  saveButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  saveButtonText: {
    color: "#fff",
    fontFamily: Typography.fontBold,
    fontSize: 20,
  },
  saveButtonTextDisabled: {
    color: "#D1D5DB",
  },
  dropdown: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 12,
    minWidth: 150,
  },
  dropdownList: {
    backgroundColor: "#fff",
    borderRadius: 10,
    marginTop: 4,
    marginBottom: 8,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    maxHeight: 180,
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  dropdownItemText: {
    fontSize: 16,
    color: "#222",
    fontFamily: Typography.fontRegular,
  },
});