"use client"

import { useState, useEffect } from "react"
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, KeyboardAvoidingView, Platform, ActivityIndicator, FlatList } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { Colors } from "../../constants/Colors"
import { Typography } from "../../constants/Typography"
import { Spacing } from "../../constants/Spacing"
import { useRestaurant } from "../../contexts/RestaurantContext"
import { getRestaurantDoc } from "../../utils/firestoreHelpers"
import { getDoc } from "firebase/firestore"
import Button from "../../components/ui/Button" // <-- Fix import (remove curly braces)

export default function AddOrderItemModal({ visible, onClose, onAdd, date }) {
  const { restaurantId } = useRestaurant();
  const [step, setStep] = useState(1); // 1: select supplier, 2: enter item
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [itemName, setItemName] = useState("");

  // Fetch suppliers from Firestore when modal opens
  useEffect(() => {
    const fetchSuppliers = async () => {
      if (!visible || !restaurantId) return;
      
      setLoading(true);
      try {
        const suppliersDocRef = getRestaurantDoc(restaurantId, "suppliers", "suppliers");
        const suppliersDoc = await getDoc(suppliersDocRef);
        
        if (suppliersDoc.exists() && suppliersDoc.data().names) {
          setSuppliers(suppliersDoc.data().names);
        } else {
          setSuppliers([]);
        }
      } catch (error) {
        console.error("Error fetching suppliers:", error);
        setSuppliers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSuppliers();
  }, [visible, restaurantId]);

  // Reset modal state when closed
  useEffect(() => {
    if (!visible) {
      setStep(1);
      setSelectedSupplier("");
      setItemName("");
    }
  }, [visible]);

  const handleSupplierSelect = () => {
    if (selectedSupplier.trim()) {
      setStep(2);
    }
  };

  const handleAddItem = () => {
    if (itemName.trim() && selectedSupplier.trim()) {
      onAdd(itemName.trim(), selectedSupplier.trim());
      setStep(1);
      setSelectedSupplier("");
      setItemName("");
      onClose();
    }
  };

  const renderSupplierItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.supplierOption,
        selectedSupplier === item && styles.supplierOptionSelected
      ]}
      onPress={() => setSelectedSupplier(item)}
      activeOpacity={0.7}
    >
      <Text style={[
        styles.supplierOptionText,
        selectedSupplier === item && styles.supplierOptionTextSelected
      ]}>
        {item}
      </Text>
      {selectedSupplier === item && (
        <Ionicons name="checkmark" size={20} color="#2563eb" />
      )}
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
          <View style={styles.modal}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.titleContainer}>
                <Text style={styles.title}>
                  {step === 1 ? "Select Supplier" : "Add Order Item"}
                </Text>
                {/* Date shown under the title */}
                {date && <Text style={styles.date}>{date}</Text>}
                {step === 2 && selectedSupplier && (
                  <Text style={styles.selectedSupplier}>Supplier: {selectedSupplier}</Text>
                )}
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
                <Text style={styles.closeText}>×</Text>
              </TouchableOpacity>
            </View>

            {step === 1 ? (
              // Step 1: Select Supplier
              <>
                <View style={styles.suppliersList}>
                  {loading ? (
                    <ActivityIndicator size="large" color="#2563eb" style={{ marginVertical: 20 }} />
                  ) : suppliers.length > 0 ? (
                    <FlatList
                      data={suppliers}
                      renderItem={renderSupplierItem}
                      keyExtractor={(item, index) => index.toString()}
                      showsVerticalScrollIndicator={false}
                      style={{ maxHeight: 300 }}
                    />
                  ) : (
                    <Text style={styles.noSuppliersText}>No suppliers found</Text>
                  )}
                </View>
                
                {/* Next Button */}
                <View style={styles.buttonContainer}>
                  <Button 
                    onPress={handleSupplierSelect} 
                    disabled={!selectedSupplier.trim()} 
                    fullWidth 
                    size="lg"
                  >
                    Next: Add Item
                  </Button>
                </View>
              </>
            ) : (
              // Step 2: Enter Item Name
              <>
                {/* Back Button */}
                <TouchableOpacity 
                  style={styles.backButton} 
                  onPress={() => setStep(1)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chevron-back" size={24} color={Colors.primary} />
                  <Text style={styles.backText}>Change Supplier</Text>
                </TouchableOpacity>

                {/* Form */}
                <View style={styles.form}>
                  <Text style={styles.label}>Item Name</Text>
                  <TextInput
                    style={styles.input}
                    value={itemName}
                    onChangeText={setItemName}
                    placeholder="Enter item name"
                    placeholderTextColor={Colors.gray200}
                    autoFocus
                  />
                </View>

                {/* Add Button */}
                <View style={styles.buttonContainer}>
                  <Button onPress={handleAddItem} disabled={!itemName.trim()} fullWidth size="lg">
                    Add Item
                  </Button>
                </View>
              </>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
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
    minHeight: 400,
    maxHeight: "80%",
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
  date: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  selectedSupplier: {
    fontSize: Typography.sm,
    color: Colors.primary,
    marginTop: Spacing.xs,
    fontWeight: "600",
  },
  closeButton: {
    padding: Spacing.xs,
  },
  closeText: {
    fontSize: 24,
    color: Colors.textSecondary,
    fontWeight: "300",
  },
  suppliersList: {
    flex: 1,
    marginBottom: Spacing.xl,
  },
  supplierOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: "#f8fafc",
  },
  supplierOptionSelected: {
    backgroundColor: "#e0f2fe",
    borderColor: "#2563eb",
    borderWidth: 1,
  },
  supplierOptionText: {
    fontSize: Typography.base,
    color: Colors.textPrimary,
    fontWeight: "500",
  },
  supplierOptionTextSelected: {
    color: "#2563eb",
    fontWeight: "600",
  },
  noSuppliersText: {
    textAlign: "center",
    fontSize: Typography.base,
    color: Colors.textSecondary,
    marginVertical: 20,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  backText: {
    fontSize: Typography.base,
    color: Colors.primary,
    marginLeft: Spacing.xs,
    fontWeight: "500",
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
  buttonContainer: {
    marginTop: "auto",
  },
})
