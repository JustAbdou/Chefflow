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
import { getDocs, addDoc, serverTimestamp, query, orderBy, deleteDoc, doc, getDoc, updateDoc, where } from "firebase/firestore";
import { useRestaurant } from "../../contexts/RestaurantContext";
import { getRestaurantCollection, getRestaurantDoc } from "../../utils/firestoreHelpers";
import { auth, db } from "../../../firebase";
import { 
  initializeOfflineSync, 
  offlineCapableCreate, 
  offlineCapableUpdate, 
  offlineCapableDelete, 
  cacheOrderItemsOffline, 
  getCachedOrderItems,
  refreshDataFromServer
} from '../../utils/offlineSync';
import { addNetworkListener, getNetworkStatus, addOnlineCallback } from '../../utils/networkMonitor';

export function OrderListsScreen() {
  const { restaurantId } = useRestaurant();
  const navigation = useNavigation()
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState(null)
  const [orderItems, setOrderItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [ordersBySupplier, setOrdersBySupplier] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isNetworkOnline, setIsNetworkOnline] = useState(true);

  // Hide Android navigation bar
  const navigationBar = useNavigationBar();
  navigationBar.useHidden(); // Use hidden mode for complete immersion
  const [currentDate, setCurrentDate] = useState('')

  useEffect(() => {
    setCurrentDate(getFormattedTodayDate());
  }, [])

  // Initialize network monitoring
  useEffect(() => {
    if (!restaurantId) return;

    // Set initial network status
    setIsNetworkOnline(getNetworkStatus());

    // Add network listener
    const removeNetworkListener = addNetworkListener((isOnline) => {
      setIsNetworkOnline(isOnline);
      console.log(`🌐 Order List - Network status updated: ${isOnline ? 'Online' : 'Offline'}`);
    });

    // Add callback for when coming back online
    const removeOnlineCallback = addOnlineCallback(async (syncResult) => {
      console.log('🔄 Order List - Back online, refreshing data...');
      await fetchOrderItems(true); // Force refresh from server
    });

    return () => {
      removeNetworkListener();
      removeOnlineCallback();
    };
  }, [restaurantId]);

  // Initialize offline sync
  useEffect(() => {
    if (!restaurantId) return;

    const initSync = async () => {
      await initializeOfflineSync(restaurantId);
    };

    initSync();
  }, [restaurantId]);

  // Function to fetch suppliers from delivery logs (documents without createdAt field)
  const fetchSuppliers = async () => {
    if (!restaurantId) return [];

    try {
      console.log('🚛 Fetching suppliers from delivery logs...');
      
      // Fetch all documents from deliverylogs collection
      const deliveryLogsSnapshot = await getDocs(getRestaurantCollection(restaurantId, "deliverylogs"));
      const suppliersList = [];

      deliveryLogsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        
        // Only include documents that don't have createdAt field
        if (!data.createdAt) {
          suppliersList.push({
            id: doc.id,
            name: doc.id, // Use document ID as supplier name
            ...data
          });
        }
      });

      console.log(`🚛 Found ${suppliersList.length} suppliers:`, suppliersList.map(s => s.name));
      return suppliersList;
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      return [];
    }
  };

  // Reusable function to fetch order items and organize by supplier
  const fetchOrderItems = async (forceRefresh = false) => {
    if (!restaurantId) return;
    
    try {
      let suppliersList = [];
      let items = [];

      if (isNetworkOnline || forceRefresh) {
        // Fetch suppliers and order items from Firestore
        console.log('🌐 Fetching suppliers and orders from server...');
        
        suppliersList = await fetchSuppliers();
        
        const q = query(getRestaurantCollection(restaurantId, "orderlist"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        items = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          completed: doc.data().done || false,
        }));
        
        // Cache items for offline use
        await cacheOrderItemsOffline(items);
        console.log(`📱 Cached ${items.length} order items for offline use`);
      } else {
        // Use cached data when offline
        console.log('📱 Offline mode: Using cached data');
        const cachedItems = await getCachedOrderItems();
        items = cachedItems.map(item => ({
          ...item,
          completed: item.done || false,
        }));
        
        // For offline mode, we'll need cached suppliers too (implement if needed)
        suppliersList = suppliers; // Use existing suppliers state
      }

      // Organize orders by supplier
      const ordersBySup = {};
      
      // Initialize with empty arrays for each supplier
      suppliersList.forEach(supplier => {
        ordersBySup[supplier.name] = [];
      });

      // Group items by supplier
      items.forEach(item => {
        let supplierName = item.supplier;
        
        // If item has no supplier, assign to first available supplier
        if (!supplierName && suppliersList.length > 0) {
          supplierName = suppliersList[0].name;
        }
        
        // Only add to existing supplier groups
        if (supplierName && ordersBySup[supplierName]) {
          ordersBySup[supplierName].push(item);
        }
      });

      setSuppliers(suppliersList);
      setOrderItems(items);
      setOrdersBySupplier(ordersBySup);
      
      console.log('📦 Orders organized by supplier:', Object.keys(ordersBySup).map(sup => `${sup}: ${ordersBySup[sup].length} items`));
      
    } catch (error) {
      console.error("Error fetching order items:", error);
      // Try to load from cache as fallback
      const cachedItems = await getCachedOrderItems();
      const itemsWithCompleted = cachedItems.map(item => ({
        ...item,
        completed: item.done || false,
      }));
      setOrderItems(itemsWithCompleted);
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
  }, [restaurantId, isNetworkOnline]);

  // Pull to refresh handler
  const onRefresh = async () => {
    if (!isNetworkOnline) {
      console.log('📱 Offline: Cannot refresh, using cached data');
      return;
    }
    
    setRefreshing(true);
    await fetchOrderItems(true); // Force refresh from server
    setRefreshing(false);
  };

  const toggleItem = async (id) => {
    if (!restaurantId) return;
    
    // Update local state first for immediate UI feedback
    const item = orderItems.find(item => item.id === id);
    if (!item) return;
    
    const newCompletedStatus = !item.completed;
    const supplierName = item.supplier || (suppliers.length > 0 ? suppliers[0].name : "Unknown");
    
    setOrderItems((items) =>
      items.map((item) => (item.id === id ? { ...item, completed: newCompletedStatus } : item))
    );
    
    // Update supplier grouping
    setOrdersBySupplier((prev) => ({
      ...prev,
      [supplierName]: prev[supplierName].map((item) => 
        item.id === id ? { ...item, completed: newCompletedStatus } : item
      )
    }));
    
    // Update using offline-capable function
    try {
      await offlineCapableUpdate(restaurantId, "orderlist", id, { done: newCompletedStatus }, isNetworkOnline);
    } catch (error) {
      console.error("Error updating order item:", error);
      // Revert local state on error
      setOrderItems((items) =>
        items.map((item) => (item.id === id ? { ...item, completed: !newCompletedStatus } : item))
      );
      setOrdersBySupplier((prev) => ({
        ...prev,
        [supplierName]: prev[supplierName].map((item) => 
          item.id === id ? { ...item, completed: !newCompletedStatus } : item
        )
      }));
    }
  }

  const clearAllItems = async () => {
    if (!restaurantId || orderItems.length === 0) return;
    
    Alert.alert(
      "Clear All Items",
      `Are you sure you want to delete all ${orderItems.length} order items? This action cannot be undone.`,
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete All",
          style: "destructive",
          onPress: async () => {
            try {
              // Delete all items using offline-capable delete
              const deletePromises = orderItems.map(item =>
                offlineCapableDelete(restaurantId, "orderlist", item.id, isNetworkOnline)
              );
              
              await Promise.all(deletePromises);
              
              // Clear local state
              setOrderItems([]);
              setOrdersBySupplier({});
            } catch (error) {
              console.error("Error clearing all order items:", error);
              Alert.alert("Error", "Failed to delete all items. Please try again.");
            }
          }
        }
      ]
    );
  }

  const getSelectedCount = () => {
    return orderItems.filter(item => item.completed).length;
  }

  const addNewItem = async (itemName, supplier) => {
    if (!restaurantId) return;
    
    // If no supplier provided, use the first available supplier
    if (!supplier && suppliers.length > 0) {
      supplier = suppliers[0].name;
    }
    
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

      const itemData = {
        name: itemName,
        supplier: supplier, // Always store the supplier name
        createdAt: isNetworkOnline ? serverTimestamp() : new Date(),
        createdBy: userInfo,
        done: false, // Initialize as not done
      };

      const result = await offlineCapableCreate(restaurantId, "orderlist", itemData, isNetworkOnline);
      
      const newItem = { 
        ...result, 
        completed: false,
        createdAt: new Date() // Always use current date for immediate display
      };
      
      setOrderItems((items) => [newItem, ...items]);
      
      // Update the supplier grouping
      setOrdersBySupplier((prev) => ({
        ...prev,
        [supplier]: [newItem, ...(prev[supplier] || [])]
      }));
      
      setShowAddModal(false);
    } catch (error) {
      console.error("Error adding order item:", error);
    }
  }

  const addItemToSupplier = (supplierName) => {
    setSelectedSupplier(supplierName);
    setShowAddModal(true);
  }

  const deleteItem = async (id) => {
    if (!restaurantId) return;
    
    // Find the item to get its supplier
    const item = orderItems.find(item => item.id === id);
    const supplierName = item ? (item.supplier || (suppliers.length > 0 ? suppliers[0].name : "Unknown")) : (suppliers.length > 0 ? suppliers[0].name : "Unknown");
    
    try {
      await offlineCapableDelete(restaurantId, "orderlist", id, isNetworkOnline);
      setOrderItems((items) => items.filter((item) => item.id !== id));
      
      // Update supplier grouping
      setOrdersBySupplier((prev) => ({
        ...prev,
        [supplierName]: prev[supplierName] ? prev[supplierName].filter((item) => item.id !== id) : []
      }));
    } catch (error) {
      console.error("Error deleting order item:", error);
    }
  }

  const onBack = () => {
    navigation.goBack('Main', { screen: 'Dashboard' })
  }

  // Render right action for swipe-to-delete
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

        {/* Offline Indicator */}
        {!isNetworkOnline && (
          <View style={styles.offlineIndicator}>
            <Text style={styles.offlineText}>📱 Offline Mode - Changes will sync when connected</Text>
          </View>
        )}

        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>List by Supplier</Text>
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

        {/* Order Items by Supplier */}
        <View style={styles.listContainer}>
          {loading ? (
            <Text style={{ textAlign: "center", marginTop: 40 }}>Loading...</Text>
          ) : suppliers.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="business-outline" size={48} color={Colors.gray200} />
              <Text style={styles.emptyStateText}>No Suppliers Found</Text>
              <Text style={styles.emptyStateSubtext}>Add suppliers through delivery logs first</Text>
            </View>
          ) : (
            <>
              {/* Show only real suppliers from database */}
              {suppliers.map((supplier) => {
                const supplierOrders = ordersBySupplier[supplier.name] || [];
                
                return (
                  <View key={supplier.name} style={styles.supplierSection}>
                    {/* Supplier Header */}
                    <View style={styles.supplierHeader}>
                      <View style={styles.supplierHeaderLeft}>
                        <Ionicons 
                          name="business-outline" 
                          size={20} 
                          color={Colors.primary} 
                          style={styles.supplierIcon}
                        />
                        <Text style={styles.supplierName}>{supplier.name}</Text>
                      </View>
                      <View style={styles.supplierHeaderRight}>
                        <Text style={styles.supplierCount}>
                          {supplierOrders.length} {supplierOrders.length === 1 ? 'item' : 'items'}
                        </Text>
                        <TouchableOpacity 
                          style={styles.addButton}
                          onPress={() => addItemToSupplier(supplier.name)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="add-circle-outline" size={24} color={Colors.primary} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Supplier Orders */}
                    {supplierOrders.map((item) => (
                      <Swipeable
                        key={item.id}
                        renderRightActions={() => renderRightActions(item.id)}
                        overshootRight={false}
                        containerStyle={{ backgroundColor: "transparent" }}
                      >
                        <TouchableOpacity
                          style={styles.listItem}
                          onPress={() => toggleItem(item.id)}
                          activeOpacity={0.7}
                        >
                          <View
                            style={[styles.checkbox, item.completed && styles.checkedBox]}
                          >
                            {item.completed && <Text style={styles.checkmark}>✓</Text>}
                          </View>
                          <Text style={[styles.itemText, item.completed && styles.completedText]}>
                            {item.name}
                          </Text>
                        </TouchableOpacity>
                      </Swipeable>
                    ))}
                  </View>
                );
              })}
            </>
          )}
          
          {/* Empty state */}
          {!loading && Object.keys(ordersBySupplier).length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="bag-outline" size={48} color={Colors.gray300} />
              <Text style={styles.emptyStateText}>No orders yet</Text>
              <Text style={styles.emptyStateSubtext}>Add your first order item!</Text>
            </View>
          )}
        </View>
      </ScrollView>



      {/* Add Item Modal */}
      {showAddModal && (
        <AddOrderItemModal 
          visible={showAddModal}
          onClose={() => {
            setShowAddModal(false);
            setSelectedSupplier(null);
          }} 
          onAdd={addNewItem}
          date={currentDate}
          suppliers={suppliers}
          defaultSupplier={selectedSupplier}
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
    color: "#FF3B30", // Red color to indicate deletion
    fontWeight: Typography.medium,
  },
  listContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 100,
    paddingHorizontal: Spacing.xl
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

  offlineIndicator: {
    backgroundColor: Colors.warning,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderRadius: 8,
  },
  offlineText: {
    color: Colors.background,
    fontSize: Typography.sm,
    fontWeight: Typography.medium,
    textAlign: 'center',
  },
  supplierSection: {
    marginBottom: Spacing.xl,
  },
  supplierHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.gray50,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: 12,
    marginBottom: Spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  supplierHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  supplierHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  supplierIcon: {
    marginRight: Spacing.sm,
  },
  supplierName: {
    fontSize: Typography.base,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
    flex: 1,
  },
  supplierCount: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontFamily: Typography.fontMedium,
  },
  addButton: {
    padding: Spacing.xs,
    borderRadius: 8,
    backgroundColor: Colors.gray100,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
    paddingHorizontal: Spacing.xl,
  },
  emptyStateText: {
    fontSize: Typography.lg,
    fontFamily: Typography.fontMedium,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  emptyStateSubtext: {
    fontSize: Typography.sm,
    color: Colors.gray400,
    fontFamily: Typography.fontRegular,
    marginTop: Spacing.xs,
  },
})
