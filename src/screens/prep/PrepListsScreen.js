import { useState, useEffect } from "react";
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
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

  const navigationBar = useNavigationBar();
  navigationBar.useHidden();
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
            createdAt: data.createdAt,
            completed: false,
          };
        });
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
  };
  const onRefresh = async () => { {
    setRefreshing(true);
    try {
      const q = query(getRestaurantCollection(restaurantId, "preplist"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt,
          completed: false,
        };
      });
      setPrepItems(items);
    } catch (error) {
      console.error("Error refreshing prep items:", error);
    } finally {
      setRefreshing(false);
    }
  };
  const toggleItem = async (id, currentDone) => {
    if (!restaurantId) return;
    setPrepItems((items) =>
      items.map((item) =>
        item.id === id ? { ...item, done: !currentDone } : item
      )
    );
    try {
      const itemRef = getRestaurantDoc(restaurantId, "preplist", id);
      await updateDoc(itemRef, { done: !currentDone });
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
        done: false,
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
  const deleteItem = async (id) => {
    if (!restaurantId) return;
    try {
      await deleteDoc(getRestaurantDoc(restaurantId, "preplist", id));
      setPrepItems((items) => items.filter((item) => item.id !== id));
    } catch (error) {
      console.error("Error deleting prep item:", error);
    }
  };
  const onBack = () => {
    navigation.goBack();
  };
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
  );
  const renderPrepItem = (item) => (
    <Swipeable
      key={item.id}
      renderRightActions={() => renderRightActions(item.id)}
      overshootRight={false}
      containerStyle={{ backgroundColor: "transparent" }}
    >
      <View style={styles.listItem}>
        <TouchableOpacity
          style={[styles.checkbox, item.done && styles.checkedBox]}
          onPress={() => toggleItem(item.id, item.done)}
          activeOpacity={0.7}
        >
          {item.done && <Text style={styles.checkmark}>✓</Text>}
        </TouchableOpacity>
        <Text style={[styles.itemText, item.done && styles.completedText]}>
          {item.name}
        </Text>
        <View style={styles.flagContainer}>
          <TouchableOpacity onPress={() => toggleUrgent(item.id, item.urgent)} activeOpacity={0.7}>
            <Text
              style={[
                styles.flagIcon,
                { color: item.urgent ? "#F7B801" : Colors.gray200 }
              ]}
            >
              ⚑
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Swipeable>
  );
  const sortedPrepItems = [...prepItems].sort((a, b) => {
    if (a.urgent !== b.urgent) {
      return a.urgent ? -1 : 1;
    }
    let aTime, bTime;
    if (a.createdAt && typeof a.createdAt.toDate === 'function') {
      aTime = a.createdAt.toDate();
    } else if (a.createdAt instanceof Date) {
      aTime = a.createdAt;
    } else if (a.createdAt) {
      aTime = new Date(a.createdAt);
    } else {
      aTime = new Date(0);
    }
    if (b.createdAt && typeof b.createdAt.toDate === 'function') {
      bTime = b.createdAt.toDate();
    } else if (b.createdAt instanceof Date) {
      bTime = b.createdAt;
    } else if (b.createdAt) {
      bTime = new Date(b.createdAt);
    } else {
      bTime = new Date(0);
    }
    if (__DEV__) {
      console.log('Sorting prep items:', {
        itemA: { name: a.name, createdAt: aTime.toISOString() },
        itemB: { name: b.name, createdAt: bTime.toISOString() }
      });
    }
    return bTime.getTime() - aTime.getTime();
  });
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
        <View style={styles.listContainer}>
          {loading ? (
            <Text style={{ textAlign: "center", marginTop: 40 }}>Loading...</Text>
          ) : (
            <>
              {todayItems.length > 0 && (
                <>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Today's List</Text>
                  </View>
                  {todayItems.map(renderPrepItem)}
                </>
              )}
              {yesterdayItems.length > 0 && (
                <>
                  <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, styles.yesterdaySectionTitle]}>Yesterday's List</Text>
                  </View>
                  {yesterdayItems.map(renderPrepItem)}
                </>
              )}
              {todayItems.length === 0 && yesterdayItems.length === 0 && (
                <Text style={styles.emptyState}>No prep items yet. Add your first item!</Text>
              )}
            </>
          )}
        </View>
      </ScrollView>
      <TouchableOpacity style={styles.fab} onPress={() => setShowAddModal(true)} activeOpacity={0.85}>
        <Ionicons name="add" size={38} color="#fff" />
      </TouchableOpacity>
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
  listContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 100,
  },
  yesterdaySectionTitle: {
    color: Colors.warning,
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
    marginBottom: Spacing.md,
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
    fontSize: 14,
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
  },
  flagIcon: {
    fontSize: 22,
    color: "#F7B801",
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
});