/**
 * Manage fridges/freezers for the restaurant.
 * Uses the same fridge loading logic as Fridge Temperature Logs: fridgelogs collection.
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { Colors } from "../../constants/Colors";
import { Typography } from "../../constants/Typography";
import { Spacing } from "../../constants/Spacing";
import useNavigationBar from "../../hooks/useNavigationBar";
import { getAndroidTitleMargin } from "../../utils/responsive";
import { useRestaurant } from "../../contexts/RestaurantContext";
import { getRestaurantCollection } from "../../utils/firestoreHelpers";
import { auth } from "../../../firebase";
import {
  fetchFridgeListFromFridgelogs,
  addFridgeToFridgesCollection,
  updateFridgeInFridgesCollection,
  deleteFridgeFromFridgesCollection,
} from "../../utils/fridgeHelpers";
import AddFridgeModal from "./AddFridgeModal";

export default function ManageFridgesScreen({ navigation }) {
  const { restaurantId } = useRestaurant();
  const [fridges, setFridges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingFridge, setEditingFridge] = useState(null);

  const navigationBar = useNavigationBar();
  navigationBar.useHidden();

  const loadFridges = useCallback(async () => {
    if (!restaurantId) {
      setFridges([]);
      return;
    }
    try {
      const list = await fetchFridgeListFromFridgelogs(restaurantId, null);
      setFridges(list);
    } catch (err) {
      console.warn("ManageFridges load error:", err);
      setFridges([]);
    }
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) {
      setFridges([]);
      setLoading(false);
      return;
    }
    const run = async () => {
      setLoading(true);
      await loadFridges();
      setLoading(false);
    };
    run();
  }, [restaurantId, loadFridges]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFridges();
    setRefreshing(false);
  }, [loadFridges]);

  const handleSave = async ({ fridgeName, fridgeType, id }) => {
    if (!restaurantId || !auth.currentUser) return;
    const name = fridgeName.trim();
    if (!name) return;

    const fridgeLogsCollection = getRestaurantCollection(restaurantId, "fridgelogs");

    if (id) {
      const oldFridge = fridges.find((f) => f.id === id);
      if (!oldFridge) return;
      setFridges((prev) =>
        prev.map((f) =>
          f.id === id ? { ...f, fridgeName: name, fridgeType: fridgeType || "fridge" } : f
        )
      );
      const oldName = (oldFridge.fridgeName || "").trim();
      const snap = await getDocs(fridgeLogsCollection);
      const updates = snap.docs.filter((d) => (d.data().fridgeName || d.data().name || "").toLowerCase() === oldName.toLowerCase());
      for (const d of updates) {
        await updateDoc(d.ref, {
          fridgeName: name,
          fridgeType: fridgeType || "fridge",
          updatedAt: serverTimestamp(),
        });
      }
      try {
        await updateFridgeInFridgesCollection(restaurantId, oldName, name, fridgeType || "fridge");
      } catch (e) {
        console.warn("Fridge sync to admin failed:", e);
      }
    } else {
      const newFridge = {
        id: `new-${Date.now()}`,
        fridgeName: name,
        fridgeType: fridgeType || "fridge",
        fridgeId: null,
        temperatureAM: "",
        temperaturePM: "",
      };
      setFridges((prev) => {
        const next = [...prev, newFridge];
        next.sort((a, b) => (a.fridgeName || "").toLowerCase().localeCompare((b.fridgeName || "").toLowerCase()));
        return next;
      });
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      await addDoc(fridgeLogsCollection, {
        fridgeName: name,
        fridgeType: fridgeType || "fridge",
        temperatureAM: "",
        temperaturePM: "",
        done: false,
        createdAt: Timestamp.fromDate(today),
        loggedBy: { userId: auth.currentUser.uid, email: auth.currentUser.email },
      });
      try {
        await addFridgeToFridgesCollection(
          restaurantId,
          name,
          fridgeType || "fridge",
          auth.currentUser?.email || auth.currentUser?.uid
        );
      } catch (e) {
        console.warn("Fridge sync to admin failed:", e);
      }
      await loadFridges();
    }
  };

  const handleDelete = async (id) => {
    if (!restaurantId) return;

    const toRemove = fridges.find((f) => f.id === id);
    if (!toRemove) return;

    setFridges((prev) => prev.filter((f) => f.id !== id));

    const fridgeName = (toRemove.fridgeName || "").trim();
    const fridgeLogsCollection = getRestaurantCollection(restaurantId, "fridgelogs");
    const snap = await getDocs(fridgeLogsCollection);
    const toDelete = snap.docs.filter((d) => (d.data().fridgeName || d.data().name || "").toLowerCase() === fridgeName.toLowerCase());

    for (const d of toDelete) {
      await deleteDoc(d.ref);
    }
    try {
      await deleteFridgeFromFridgesCollection(restaurantId, fridgeName);
    } catch (e) {
      console.warn("Fridge sync to admin failed:", e);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>Manage Fridges</Text>
          <Text style={styles.sub}>Fridges and freezers</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => {
          setEditingFridge(null);
          setModalVisible(true);
        }}
        activeOpacity={0.85}
      >
        <Ionicons name="add-circle-outline" size={22} color="#fff" />
        <Text style={styles.addBtnText}>Add fridge</Text>
      </TouchableOpacity>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} tintColor={Colors.primary} />}
      >
        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
        ) : fridges.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="thermometer-outline" size={44} color={Colors.gray400} />
            <Text style={styles.emptyTitle}>No fridges yet</Text>
            <Text style={styles.emptySub}>Add fridges and freezers to manage your list.</Text>
          </View>
        ) : (
          fridges.map((fridge) => (
            <TouchableOpacity
              key={fridge.id}
              style={styles.card}
              onPress={() => {
                setEditingFridge({
                  id: fridge.id,
                  fridgeName: fridge.fridgeName,
                  fridgeType: fridge.fridgeType,
                });
                setModalVisible(true);
              }}
              activeOpacity={0.75}
            >
              <View style={styles.cardIcon}>
                {fridge.fridgeType === "freezer" ? (
                  <Ionicons name="snow-outline" size={22} color={Colors.primary} />
                ) : (
                  <Ionicons name="thermometer-outline" size={22} color={Colors.primary} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{fridge.fridgeName}</Text>
                <Text style={styles.cardSub} numberOfLines={1}>
                  {fridge.fridgeType === "freezer" ? "Freezer" : "Fridge"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.gray400} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <AddFridgeModal
        visible={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setEditingFridge(null);
        }}
        onSave={handleSave}
        onDelete={handleDelete}
        editingFridge={editingFridge}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg + getAndroidTitleMargin(),
    paddingBottom: Spacing.md,
  },
  backBtn: { padding: Spacing.xs, marginRight: Spacing.sm },
  backArrow: { fontSize: 32, color: Colors.textPrimary, fontWeight: "300" },
  headerText: { flex: 1 },
  title: { fontSize: 24, fontFamily: Typography.fontBold, color: Colors.textPrimary },
  sub: { fontSize: 15, color: Colors.textSecondary, marginTop: 4 },
  addBtn: {
    marginHorizontal: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: Spacing.lg,
  },
  addBtnText: { color: "#fff", fontFamily: Typography.fontBold, fontSize: 16 },
  scroll: { flex: 1, paddingHorizontal: Spacing.lg },
  empty: { alignItems: "center", paddingVertical: 48 },
  emptyTitle: { marginTop: 12, fontFamily: Typography.fontBold, fontSize: 17, color: Colors.textPrimary },
  emptySub: { marginTop: 8, fontSize: 14, color: Colors.textSecondary, textAlign: "center" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  cardTitle: { fontFamily: Typography.fontBold, fontSize: 17, color: Colors.textPrimary },
  cardSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
});
