"use client"

import { useState } from "react"
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, KeyboardAvoidingView, Platform, ScrollView } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { Colors } from "../../constants/Colors"
import { Typography } from "../../constants/Typography"
import { Spacing } from "../../constants/Spacing"
import Button from "../../components/ui/Button" // <-- Fix import (remove curly braces)

export default function AddOrderItemModal({ visible, onClose, onAdd, date, suppliers = [] }) {
  const [itemName, setItemName] = useState("")
  const [selectedSupplier, setSelectedSupplier] = useState("")

  const handleAdd = () => {
    if (itemName.trim()) {
      onAdd(itemName.trim(), selectedSupplier || "No Supplier")
      setItemName("")
      setSelectedSupplier("")
      onClose()
    }
  }

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
                <Text style={styles.title}>Add Order Item</Text>
                {/* Date shown under the title */}
                {date && <Text style={styles.date}>{date}</Text>}
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
                <Text style={styles.closeText}>×</Text>
              </TouchableOpacity>
            </View>

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
              
              {/* Supplier Selection */}
              <Text style={[styles.label, { marginTop: Spacing.lg }]}>Supplier</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                style={styles.supplierScroll}
                contentContainerStyle={styles.supplierContainer}
              >
                <TouchableOpacity
                  style={[
                    styles.supplierChip,
                    selectedSupplier === "" && styles.activeSupplierChip,
                  ]}
                  onPress={() => setSelectedSupplier("")}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.supplierText,
                      selectedSupplier === "" && styles.activeSupplierText,
                    ]}
                  >
                    No Supplier
                  </Text>
                </TouchableOpacity>
                
                {suppliers.map((supplier) => (
                  <TouchableOpacity
                    key={supplier.id}
                    style={[
                      styles.supplierChip,
                      selectedSupplier === supplier.name && styles.activeSupplierChip,
                    ]}
                    onPress={() => setSelectedSupplier(supplier.name)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.supplierText,
                        selectedSupplier === supplier.name && styles.activeSupplierText,
                      ]}
                    >
                      {supplier.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Add Button */}
            <View style={styles.buttonContainer}>
              <Button onPress={handleAdd} disabled={!itemName.trim()} fullWidth size="lg">
                Add Item
              </Button>
            </View>
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
    minHeight: 300,
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
  buttonContainer: {
    marginTop: "auto",
  },
  supplierScroll: {
    marginTop: Spacing.sm,
  },
  supplierContainer: {
    paddingRight: Spacing.lg,
  },
  supplierChip: {
    backgroundColor: Colors.gray100,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 20,
    marginRight: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  activeSupplierChip: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  supplierText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.medium,
  },
  activeSupplierText: {
    color: Colors.background,
  },
})
