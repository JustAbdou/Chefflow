"use client"

import { useState, useEffect } from "react"
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, RefreshControl, Alert } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { Colors } from "../../constants/Colors"
import { Typography } from "../../constants/Typography"
import { Spacing } from "../../constants/Spacing"
import { getAndroidTitleMargin } from "../../utils/responsive"
import useNavigationBar from "../../hooks/useNavigationBar"
import AddOrderItemModal from "./AddOrderItemModal"
import { Swipeable } from "react-native-gesture-handler"
import { useNavigation } from "@react-navigation/native"
import { getFormattedTodayDate } from '../../utils/dateUtils';
import { getDocs, addDoc, serverTimestamp, query, orderBy, deleteDoc, doc, getDoc, updateDoc } from "firebase/firestore";
import { useRestaurant } from "../../contexts/RestaurantContext";
import { getRestaurantCollection, getRestaurantDoc } from "../../utils/firestoreHelpers";
import { auth, db } from "../../../firebase";

export function OrderListsScreen() {
  const { restaurantId } = useRestaurant();
  const navigation = useNavigation()
  const [showAddModal, setShowAddModal] = useState(false)
  const [orderItems, setOrderItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Hide Android navigation bar
  const navigationBar = useNavigationBar();
  navigationBar.useHidden(); // Use hidden mode for complete immersion
  const [currentDate, setCurrentDate] = useState('')

  useEffect(() => {
    setCurrentDate(getFormattedTodayDate());
  }, [])

  // Reusable function to fetch order items
  const fetchOrderItems = async () => {
    if (!restaurantId) return;
    
    try {
      const q = query(getRestaurantCollection(restaurantId, "orderlist"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        completed: doc.data().done || false, // completed UI state matches Firestore 'done' field
      }));
      setOrderItems(items);
    } catch (error) {
      console.error("Error fetching order items:", error);
    }
  };

  useEffect(() => {
    const loadOrderItems = async () => {
      setLoading(true);
      await fetchOrderItems();
      setLoading(false);
      setRefreshing(false);
    };
    loadOrderItems();
  }, [restaurantId]);

  // Pull to refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrderItems();
    setRefreshing(false);
  };

  const toggleItem = async (id) => {
    if (!restaurantId) return;
    
    // Update local state first for immediate UI feedback
    const item = orderItems.find(item => item.id === id);
    if (!item) return;
    
    const newCompletedStatus = !item.completed;
    
    setOrderItems((items) =>
      items.map((item) => (item.id === id ? { ...item, completed: newCompletedStatus } : item))
    );
    
    // Update Firestore - when checked (completed: true), set done: true
    try {
      await updateDoc(getRestaurantDoc(restaurantId, "orderlist", id), {
        done: newCompletedStatus,
      });
    } catch (error) {
      console.error("Error updating order item:", error);
      // Revert local state on error
      setOrderItems((items) =>
        items.map((item) => (item.id === id ? { ...item, completed: !newCompletedStatus } : item))
      );
    }
  }

  const clearAllItems = () => {
    Alert.alert(
      "Clear All Items",
      "Are you sure you want to delete all items in the order list? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete All",
          style: "destructive",
          onPress: async () => {
            if (!restaurantId) return;
            
            try {
              // Delete all items from Firestore
              const deletePromises = orderItems.map(item =>
                deleteDoc(getRestaurantDoc(restaurantId, "orderlist", item.id))
              );
              
              await Promise.all(deletePromises);
              
              // Clear local state
              setOrderItems([]);
            } catch (error) {
              console.error("Error clearing all items:", error);
              Alert.alert("Error", "Failed to clear all items. Please try again.");
            }
          }
        }
      ]
    );
  }

  const addNewItem = async (itemName, supplierName) => {
    if (!restaurantId) return;
    
    try {
      const currentUser = auth.currentUser;
      let userInfo = {
        userId: 'anonymous',
        userEmail: 'anonymous',
        userName: 'Anonymous User',
        fullName: 'Anonymous User'
      };

      if (currentUser) {
        // Fetch user's full name from Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          const userData = userDoc.exists() ? userDoc.data() : null;
          
          userInfo = {
            userId: currentUser.uid,
            userEmail: currentUser.email || 'Unknown Email',
            userName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Unknown User',
            fullName: userData?.fullName || currentUser.displayName || currentUser.email?.split('@')[0] || 'Unknown User'
          };
        } catch (firestoreError) {
          console.warn('Could not fetch user data from Firestore:', firestoreError);
          // Fallback to auth data only
          userInfo = {
            userId: currentUser.uid,
            userEmail: currentUser.email || 'Unknown Email',
            userName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Unknown User',
            fullName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Unknown User'
          };
        }
      }

      const docRef = await addDoc(getRestaurantCollection(restaurantId, "orderlist"), {
        name: itemName,
        supplier: supplierName, // Add supplier field
        createdAt: serverTimestamp(),
        createdBy: userInfo,
        done: false, // Initialize as not done
      });
      setOrderItems((items) => [
        { 
          id: docRef.id, 
          name: itemName, 
          supplier: supplierName, // Add supplier to local state
          completed: false, 
          createdBy: userInfo, 
          done: false 
        },
        ...items,
      ]);
      setShowAddModal(false);
    } catch (error) {
      console.error("Error adding order item:", error);
    }
  }

  const deleteItem = async (id) => {
    if (!restaurantId) return;
    
    try {
      await deleteDoc(getRestaurantDoc(restaurantId, "orderlist", id));
      setOrderItems((items) => items.filter((item) => item.id !== id));
    } catch (error) {
      console.error("Error deleting order item:", error);
    }
  }

  const onBack = () => {
    navigation.goBack('Main', { screen: 'Dashboard' })
  }

  // Group order items by supplier
  const groupedOrderItems = orderItems.reduce((groups, item) => {
    const supplier = item.supplier || 'No Supplier';
    if (!groups[supplier]) {
      groups[supplier] = [];
    }
    groups[supplier].push(item);
    return groups;
  }, {});

  // Render items for a specific supplier
  const renderSupplierItems = (items) => {
    return items.map((item) => (
      <Swipeable
        key={item.id}
        renderRightActions={() => renderRightActions(item.id)}
        overshootRight={false}
        containerStyle={styles.swipeableContainer}
      >
        <TouchableOpacity 
          style={styles.listItem}
          onPress={() => toggleItem(item.id)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, item.completed && styles.checkedBox]}>
            {item.completed && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={[styles.itemText, item.completed && styles.completedText]}>{item.name}</Text>
        </TouchableOpacity>
      </Swipeable>
    ));
  };

  // Render right action for swipe-to-delete
  const renderRightActions = (itemId) => (
    <View style={styles.swipeActionContainer}>
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={() => deleteItem(itemId)}
        activeOpacity={0.8}
      >
        <Ionicons name="trash-outline" size={24} color="white" />
        <Text style={styles.deleteActionText}>Delete</Text>
      </TouchableOpacity>
    </View>
  )

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
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

        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today's Orders</Text>
          {orderItems.length > 0 && (
            <TouchableOpacity
              style={styles.clearAllButton}
              onPress={clearAllItems}
              activeOpacity={0.7}
            >
              <Text style={styles.clearAllText}>Clear All</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Order Items List - Grouped by Supplier */}
        <View style={styles.listContainer}>
          {loading ? (
            <Text style={{ textAlign: "center", marginTop: 40 }}>Loading...</Text>
          ) : Object.keys(groupedOrderItems).length === 0 ? (
            <Text style={styles.emptyState}>No order items yet. Add your first item!</Text>
          ) : (
            Object.entries(groupedOrderItems).map(([supplier, items]) => (
              <View key={supplier} style={styles.supplierSection}>
                <View style={styles.supplierHeader}>
                  <Text style={styles.supplierName}>{supplier}</Text>
                  <Text style={styles.supplierItemCount}>{items.length} item{items.length !== 1 ? 's' : ''}</Text>
                </View>
                <View style={styles.supplierItems}>
                  {renderSupplierItems(items)}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowAddModal(true)} activeOpacity={0.85}>
        <Ionicons name="add" size={38} color="#fff" />
      </TouchableOpacity>

      {/* Add Item Modal */}
      {showAddModal && (
        <AddOrderItemModal 
          visible={showAddModal}
          onClose={() => setShowAddModal(false)} 
          onAdd={addNewItem}
          date={currentDate}
        />
      )}
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
    paddingTop: Spacing.lg + getAndroidTitleMargin(),
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
    fontSize: 22,
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
    fontSize: Typography.xl,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
  },
  bulkActionsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  clearAllButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#FF3B30",
    backgroundColor: "transparent",
  },
  clearAllText: {
    fontSize: Typography.sm,
    color: "#FF3B30",
    fontWeight: Typography.medium,
  },
  bulkSelectButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: "transparent",
  },
  bulkSelectButtonActive: {
    backgroundColor: Colors.primary,
  },
  bulkSelectText: {
    fontSize: Typography.sm,
    color: Colors.primary,
    fontWeight: Typography.medium,
  },
  bulkSelectTextActive: {
    color: "white",
  },
  selectAllButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  selectAllText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.medium,
  },
  listContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 100,
  },
  emptyState: {
    textAlign: "center",
    marginTop: 40,
    fontSize: Typography.md,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  supplierSection: {
    marginBottom: Spacing.xl,
  },
  supplierHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    marginBottom: Spacing.sm,
  },
  supplierName: {
    fontSize: Typography.lg,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
  },
  supplierItemCount: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.medium,
  },
  supplierItems: {
    paddingLeft: Spacing.md,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    backgroundColor: Colors.gray50,
    borderRadius: 16,
    paddingHorizontal: Spacing.md,
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
    right: 40,
    bottom: 70,
    width: 72,
    height: 72,
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
  swipeableContainer: {
    backgroundColor: "transparent",
    marginBottom: Spacing.md,
  },
  swipeActionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "flex-end",
    paddingRight: Spacing.md,
  },
  deleteAction: {
    backgroundColor: "#FF3B30",
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    height: "85%",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  deleteActionText: {
    color: "white",
    fontSize: Typography.sm,
    fontWeight: Typography.bold,
    marginTop: 4,
  },
})