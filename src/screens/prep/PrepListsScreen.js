import { useState, useEffect } from "react";
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, RefreshControl, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Swipeable } from "react-native-gesture-handler";
import { Colors } from "../../constants/Colors";
import { Typography } from "../../constants/Typography";
import { Spacing } from "../../constants/Spacing";
import { getAndroidTitleMargin } from "../../utils/responsive";
import useNavigationBar from "../../hooks/useNavigationBar";
import { useNavigation } from "@react-navigation/native";
import { getFormattedTodayDate, groupPrepItemsByDay } from '../../utils/dateUtils';
import AddPrepItemModal from "./AddPrepItemModal";
import { getDocs, addDoc, serverTimestamp, query, orderBy, deleteDoc, updateDoc, doc, getDoc } from "firebase/firestore";
import { useRestaurant } from "../../contexts/RestaurantContext";
import { getRestaurantCollection, getRestaurantDoc } from "../../utils/firestoreHelpers";
import { auth, db } from "../../../firebase";

export default function PrepListsScreen() {
  const { restaurantId } = useRestaurant();
  const navigation = useNavigation();
  const [prepItems, setPrepItems] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentDate, setCurrentDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Hide Android navigation bar
  const navigationBar = useNavigationBar();
  navigationBar.useHidden(); // Use hidden mode for complete immersion

  useEffect(() => {
    setCurrentDate(getFormattedTodayDate());
  }, []);

  useEffect(() => {
    const fetchPrepItems = async () => {
      if (!restaurantId) return;
      
      setLoading(true);
      try {
        const q = query(getRestaurantCollection(restaurantId, "preplist"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        const items = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt, // Ensure createdAt is preserved
            completed: false, // or from Firestore if you store it
          };
        });
        
        // Check for items that need daily reset (done status cleared after 24h)
        await performDailyReset(items);
        
        setPrepItems(items);
      } catch (error) {
        console.error("Error fetching prep items:", error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    };
    fetchPrepItems();
  }, [restaurantId]);

  // Daily reset function to clear 'done' status after 24 hours
  const performDailyReset = async (items) => {
    if (!restaurantId) return;
    
    const now = new Date();
    const resetPromises = [];
    
    items.forEach(item => {
      // Only process items that are marked as done
      if (item.done && item.completedAt) {
        let completedTime;
        
        // Handle Firestore timestamp
        if (item.completedAt && typeof item.completedAt.toDate === 'function') {
          completedTime = item.completedAt.toDate();
        } else if (item.completedAt instanceof Date) {
          completedTime = item.completedAt;
        } else if (item.completedAt) {
          completedTime = new Date(item.completedAt);
        }
        
        // Check if more than 24 hours have passed since completion
        if (completedTime) {
          const hoursSinceCompletion = (now.getTime() - completedTime.getTime()) / (1000 * 60 * 60);
          
          if (hoursSinceCompletion >= 24) {
            console.log(`🔄 Resetting done status for item: ${item.name} (completed ${hoursSinceCompletion.toFixed(1)}h ago)`);
            
            // Reset the done status and remove completedAt timestamp
            const resetPromise = updateDoc(getRestaurantDoc(restaurantId, "preplist", item.id), {
              done: false,
              completedAt: null
            });
            
            resetPromises.push(resetPromise);
            
            // Update local state
            item.done = false;
            item.completedAt = null;
          }
        }
      }
    });
    
    // Execute all reset operations
    if (resetPromises.length > 0) {
      try {
        await Promise.all(resetPromises);
        console.log(`✅ Daily reset completed: ${resetPromises.length} items reset`);
      } catch (error) {
        console.error("Error performing daily reset:", error);
      }
    }
  };

  // Pull to refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const q = query(getRestaurantCollection(restaurantId, "preplist"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt, // Ensure createdAt is preserved
          completed: false,
        };
      });
      
      // Check for items that need daily reset on refresh
      await performDailyReset(items);
      
      setPrepItems(items);
    } catch (error) {
      console.error("Error refreshing prep items:", error);
    } finally {
      setRefreshing(false);
    }
  };

  // Toggle done (checkbox) in state and Firestore
  const toggleItem = async (id, currentDone) => {
    if (!restaurantId) return;
    
    const newDoneStatus = !currentDone;
    const updateData = { 
      done: newDoneStatus,
      // Set completedAt timestamp when marking as done, clear it when unmarking
      completedAt: newDoneStatus ? serverTimestamp() : null
    };
    
    setPrepItems((items) =>
      items.map((item) =>
        item.id === id ? { 
          ...item, 
          done: newDoneStatus,
          completedAt: newDoneStatus ? new Date() : null
        } : item
      )
    );
    
    try {
      const itemRef = getRestaurantDoc(restaurantId, "preplist", id);
      await updateDoc(itemRef, updateData);
    } catch (error) {
      console.error("Error updating done field:", error);
    }
  };

  const addNewItem = async (itemName) => {
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

      const docRef = await addDoc(getRestaurantCollection(restaurantId, "preplist"), {
        name: itemName,
        done: false, // Default to not done
        createdAt: serverTimestamp(),
        createdBy: userInfo,
      });
      setPrepItems((items) => [
        { id: docRef.id, name: itemName, done: false, completed: false, flagged: false, createdBy: userInfo },
        ...items,
      ]);
      setShowAddModal(false);
    } catch (error) {
      console.error("Error adding prep item:", error);
    }
  };

  // Toggle urgent flag in state and Firestore
  const toggleUrgent = async (id, currentUrgent) => {
    if (!restaurantId) return;
    
    setPrepItems((items) =>
      items.map((item) =>
        item.id === id ? { ...item, urgent: !currentUrgent } : item
      )
    );
    try {
      const itemRef = getRestaurantDoc(restaurantId, "preplist", id);
      await updateDoc(itemRef, { urgent: !currentUrgent });
    } catch (error) {
      console.error("Error updating urgent flag:", error);
    }
  };

  // Delete individual item
  const deleteItem = async (id) => {
    if (!restaurantId) return;
    
    try {
      await deleteDoc(getRestaurantDoc(restaurantId, "preplist", id));
      setPrepItems((items) => items.filter((item) => item.id !== id));
    } catch (error) {
      console.error("Error deleting prep item:", error);
    }
  };

  const clearAllItems = () => {
    Alert.alert(
      "Clear All Items",
      "Are you sure you want to delete all items in the prep list? This action cannot be undone.",
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
              const deletePromises = prepItems.map(item =>
                deleteDoc(getRestaurantDoc(restaurantId, "preplist", item.id))
              );
              
              await Promise.all(deletePromises);
              
              // Clear local state
              setPrepItems([]);
            } catch (error) {
              console.error("Error clearing all items:", error);
              Alert.alert("Error", "Failed to clear all items. Please try again.");
            }
          }
        }
      ]
    );
  };

  const onBack = () => {
    navigation.goBack();
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
  );

  const renderPrepItem = (item) => (
    <Swipeable
      key={item.id}
      renderRightActions={() => renderRightActions(item.id)}
      overshootRight={false}
      containerStyle={styles.swipeableContainer}
    >
      <TouchableOpacity 
        style={styles.listItem}
        onPress={() => toggleItem(item.id, item.done)}
        activeOpacity={0.7}
      >
        <View style={[styles.checkbox, item.done && styles.checkedBox]}>
          {item.done && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <Text style={[styles.itemText, item.done && styles.completedText]}>
          {item.name}
        </Text>
        <TouchableOpacity 
          style={styles.flagContainer}
          onPress={(e) => {
            e.stopPropagation();
            toggleUrgent(item.id, item.urgent);
          }} 
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.flagIcon,
              { color: item.urgent ? "#F7B801" : Colors.gray200 }
            ]}
          >
            ⚑
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Swipeable>
  );

  // Sort prep items: urgent items first, then by creation date (newest first)
  const sortedPrepItems = [...prepItems].sort((a, b) => {
    // First priority: urgent items
    if (a.urgent !== b.urgent) {
      return a.urgent ? -1 : 1;
    }
    
    // Second priority: creation date and time (newest first)
    let aTime, bTime;
    
    // Handle Firestore timestamps properly
    if (a.createdAt && typeof a.createdAt.toDate === 'function') {
      aTime = a.createdAt.toDate();
    } else if (a.createdAt instanceof Date) {
      aTime = a.createdAt;
    } else if (a.createdAt) {
      aTime = new Date(a.createdAt);
    } else {
      aTime = new Date(0); // Fallback for missing date
    }
    
    if (b.createdAt && typeof b.createdAt.toDate === 'function') {
      bTime = b.createdAt.toDate();
    } else if (b.createdAt instanceof Date) {
      bTime = b.createdAt;
    } else if (b.createdAt) {
      bTime = new Date(b.createdAt);
    } else {
      bTime = new Date(0); // Fallback for missing date
    }
    
    // Debug: Log the full timestamps for verification
    if (__DEV__) {
      console.log('Sorting prep items:', {
        itemA: { name: a.name, createdAt: aTime.toISOString() },
        itemB: { name: b.name, createdAt: bTime.toISOString() }
      });
    }
    
    // Compare full date and time (newest first)
    return bTime.getTime() - aTime.getTime();
  });

  // Group items by day (today/yesterday based on 3 AM cutoff)
  const { todayItems, yesterdayItems } = groupPrepItemsByDay(sortedPrepItems);

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
              <Text style={styles.title}>Prep Lists</Text>
              <Text style={styles.date}>{currentDate}</Text>
            </View>
          </View>
        </View>

        {/* Prep Items List */}
        <View style={styles.listContainer}>
          {loading ? (
            <Text style={{ textAlign: "center", marginTop: 40 }}>Loading...</Text>
          ) : (
            <>
              {/* Today's Items */}
              {todayItems.length > 0 && (
                <>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Today's List</Text>
                    <TouchableOpacity
                      style={styles.clearAllButton}
                      onPress={clearAllItems}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.clearAllText}>Clear All</Text>
                    </TouchableOpacity>
                  </View>
                  {todayItems.map(renderPrepItem)}
                </>
              )}
              
              {/* Yesterday's Items */}
              {yesterdayItems.length > 0 && (
                <>
                  <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, styles.yesterdaySectionTitle]}>Yesterday's List</Text>
                  </View>
                  {yesterdayItems.map(renderPrepItem)}
                </>
              )}
              
              {/* Empty state */}
              {todayItems.length === 0 && yesterdayItems.length === 0 && (
                <Text style={styles.emptyState}>No prep items yet. Add your first item!</Text>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowAddModal(true)} activeOpacity={0.85}>
        <Ionicons name="add" size={38} color="#fff" />
      </TouchableOpacity>
      {/* Add Item Modal */}
      {showAddModal && (
        <AddPrepItemModal
          visible={showAddModal}
          onClose={() => setShowAddModal(false)}
          onAdd={addNewItem}
          date={currentDate}
        />
      )}
    </SafeAreaView>
  );
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
    color: "#FF3B30",
    fontWeight: Typography.medium,
  },
  listContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 100,
  },
  yesterdaySectionTitle: {
    color: Colors.warning, // Orange color for yesterday's list
  },
  emptyState: {
    textAlign: "center",
    marginTop: 40,
    fontSize: Typography.md,
    color: Colors.textSecondary,
    fontStyle: 'italic',
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
    backgroundColor: Colors.background,
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
  flagContainer: {
    marginLeft: Spacing.md,
    padding: Spacing.xs,
  },
  flagIcon: {
    fontSize: 22,
    color: "#F7B801", // yellow/orange for flagged, gray for not flagged
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
});