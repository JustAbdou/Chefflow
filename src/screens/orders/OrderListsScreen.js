"use client"

import { useState, useEffect } from "react"
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from "react-native"
import { Colors } from "../../constants/Colors"
import { Typography } from "../../constants/Typography"
import { Spacing } from "../../constants/Spacing"
import AddOrderItemModal from "./AddOrderItemModal"
import { Swipeable } from "react-native-gesture-handler"
import { useNavigation } from "@react-navigation/native"
import { getFormattedTodayDate } from '../../utils/dateUtils';

export function OrderListsScreen() {
  const navigation = useNavigation()
  const [showAddModal, setShowAddModal] = useState(false)
  const [orderItems, setOrderItems] = useState([
    { id: 1, name: "Vegetables", completed: true },
    { id: 2, name: "Meat & Poultry", completed: true },
    { id: 3, name: "Pantry Items", completed: false },
    { id: 4, name: "Beverages", completed: false },
    { id: 5, name: "Dairy Products", completed: false },
  ])
  const [currentDate, setCurrentDate] = useState('')

  useEffect(() => {
    setCurrentDate(getFormattedTodayDate());
  }, [])

  const toggleItem = (id) => {
    setOrderItems((items) =>
      items.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item))
    )
  }

  const addNewItem = (itemName) => {
    const newItem = {
      id: Date.now(),
      name: itemName,
      completed: false,
    }
    setOrderItems((items) => [...items, newItem])
    setShowAddModal(false)
  }

  const deleteItem = (id) => {
    setOrderItems((items) => items.filter((item) => item.id !== id))
  }

  const onBack = () => {
    navigation.goBack('Main', { screen: 'Dashboard' })
  }

  const renderRightActions = (itemId) => (
    <View style={{ flex: 1, justifyContent: "center" }}>
      <TouchableOpacity
        style={{
          backgroundColor: "#FF3B30",
          justifyContent: "center",
          alignItems: "center",
          width: 90,
          height: "80%",
          borderRadius: 16,
          marginVertical: 8,
          alignSelf: "flex-end",
        }}
        onPress={() => deleteItem(itemId)}
        activeOpacity={0.8}
      >
        <Text style={{ color: "white", fontWeight: "bold", fontSize: 16 }}>Delete</Text>
      </TouchableOpacity>
    </View>
  )

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.backHeader}>
            <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
              <Text style={styles.backArrow}>‹</Text>
            </TouchableOpacity>
            <View style={styles.titleContainer}>
              <Text style={styles.title}>Order Lists</Text>
              <Text style={styles.date}>{currentDate}</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today's List</Text>
          <TouchableOpacity activeOpacity={0.7}>
            <Text style={styles.viewAll}>View All</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.listContainer}>
          {orderItems.map((item) => (
            <Swipeable
              key={item.id}
              renderRightActions={() => renderRightActions(item.id)}
              overshootRight={false}
              containerStyle={{ backgroundColor: "transparent" }}
            >
              <View style={styles.listItem}>
                <TouchableOpacity
                  style={[styles.checkbox, item.completed && styles.checkedBox]}
                  onPress={() => toggleItem(item.id)}
                  activeOpacity={0.7}
                >
                  {item.completed && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
                <Text style={[styles.itemText, item.completed && styles.completedText]}>{item.name}</Text>
              </View>
            </Swipeable>
          ))}
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => setShowAddModal(true)} activeOpacity={0.8}>
        <Text style={styles.plus}>+</Text>
      </TouchableOpacity>

      {showAddModal && <AddOrderItemModal onClose={() => setShowAddModal(false)} onAdd={addNewItem} />}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backHeader: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    width: "100%",
  },
  backButton: {
    marginRight: Spacing.md,
    padding: Spacing.xs,
  },
  backArrow: {
    fontSize: 35,
    color: Colors.textPrimary,
    fontWeight: "300",
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 26,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
  },
  date: {
    fontSize: Typography.md,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    marginTop: Spacing.xl,
  },
  sectionTitle: {
    fontSize: Typography.xxl,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
  },
  viewAll: {
    fontSize: Typography.base,
    color: Colors.primary,
    fontWeight: Typography.medium,
  },
  listContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 100,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.primary,
    marginRight: Spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  checkedBox: {
    backgroundColor: Colors.primary,
  },
  checkmark: {
    color: "white",
    fontSize: 10,
    fontWeight: Typography.bold,
  },
  itemText: {
    fontSize: Typography.lg,
    color: Colors.textPrimary,
    fontWeight: Typography.medium,
    flex: 1,
  },
  completedText: {
    textDecorationLine: "line-through",
    color: Colors.textSecondary,
  },
  fab: {
    position: "absolute",
    bottom: 90,
    right: Spacing.lg,
    width: 80,
    height: 80,
    borderRadius: 50,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  plus: {
    color: "white",
    fontSize: 50,
    fontFamily: Typography.fontRegular,
    marginBottom: 4,
  },
})
