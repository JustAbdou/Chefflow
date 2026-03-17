/**
 * Manage recurring cleaning tasks only (no day-by-day completion).
 */
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { onSnapshot, addDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { Colors } from "../../constants/Colors";
import { Typography } from "../../constants/Typography";
import { Spacing } from "../../constants/Spacing";
import useNavigationBar from "../../hooks/useNavigationBar";
import { getAndroidTitleMargin } from "../../utils/responsive";
import { useRestaurant } from "../../contexts/RestaurantContext";
import { getRestaurantCollection, getRestaurantDoc } from "../../utils/firestoreHelpers";
import { auth } from "../../../firebase";
import AddCleaningTaskModal from "./AddCleaningTaskModal";

export default function CleaningManageTasksScreen({ navigation }) {
  const { restaurantId } = useRestaurant();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  const navigationBar = useNavigationBar();
  navigationBar.useHidden();

  useEffect(() => {
    if (!restaurantId) {
      setTasks([]);
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(
      getRestaurantCollection(restaurantId, "cleaningTasks"),
      (snap) => {
        setTasks(
          snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
            taskName: d.data().taskName || d.data().name || "",
          }))
        );
        setLoading(false);
      },
      () => {
        setTasks([]);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [restaurantId]);

  const handleSave = async ({ taskName, daysOfWeek, id }) => {
    if (!restaurantId || !auth.currentUser) return;
    const body = {
      taskName: taskName.trim(),
      daysOfWeek,
      updatedAt: serverTimestamp(),
    };
    if (id) {
      await updateDoc(getRestaurantDoc(restaurantId, "cleaningTasks", id), body);
    } else {
      await addDoc(getRestaurantCollection(restaurantId, "cleaningTasks"), {
        ...body,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser.uid,
        active: true,
      });
    }
  };

  const handleDelete = async (id) => {
    if (!restaurantId) return;
    await deleteDoc(getRestaurantDoc(restaurantId, "cleaningTasks", id));
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>Manage tasks</Text>
          <Text style={styles.sub}>Recurring cleaning tasks</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => {
          setEditingTask(null);
          setModalVisible(true);
        }}
        activeOpacity={0.85}
      >
        <Ionicons name="add-circle-outline" size={22} color="#fff" />
        <Text style={styles.addBtnText}>Add task</Text>
      </TouchableOpacity>

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 48 }}>
        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
        ) : tasks.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="list-outline" size={44} color={Colors.gray400} />
            <Text style={styles.emptyTitle}>No tasks yet</Text>
            <Text style={styles.emptySub}>Add a task and assign days of the week.</Text>
          </View>
        ) : (
          tasks.map((task) => (
            <TouchableOpacity
              key={task.id}
              style={styles.card}
              onPress={() => {
                setEditingTask({
                  id: task.id,
                  taskName: task.taskName,
                  daysOfWeek: task.daysOfWeek || [],
                });
                setModalVisible(true);
              }}
              activeOpacity={0.75}
            >
              <View style={styles.cardIcon}>
                <Ionicons name="brush-outline" size={22} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{task.taskName || task.name}</Text>
                <Text style={styles.cardDays} numberOfLines={2}>
                  {(task.daysOfWeek || []).join(", ") || "No days assigned"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.gray400} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <AddCleaningTaskModal
        visible={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setEditingTask(null);
        }}
        onSave={handleSave}
        onDelete={handleDelete}
        editingTask={editingTask}
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
  cardDays: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
});
