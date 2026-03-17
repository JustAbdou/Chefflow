import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { onSnapshot, addDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { Colors } from "../../constants/Colors";
import { Typography } from "../../constants/Typography";
import { Spacing } from "../../constants/Spacing";
import useNavigationBar from "../../hooks/useNavigationBar";
import { getAndroidTitleMargin } from "../../utils/responsive";
import { useRestaurant } from "../../contexts/RestaurantContext";
import { getRestaurantCollection, getRestaurantDoc } from "../../utils/firestoreHelpers";
import { auth } from "../../../firebase";

export default function OpeningChecklistManageTasksScreen({ navigation }) {
  const { restaurantId } = useRestaurant();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newTaskName, setNewTaskName] = useState("");

  const navigationBar = useNavigationBar();
  navigationBar.useHidden();

  useEffect(() => {
    if (!restaurantId) {
      setTasks([]);
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(
      getRestaurantCollection(restaurantId, "openinglist"),
      (snap) => {
        setTasks(
          snap.docs.map((d) => ({
            id: d.id,
            name: d.data().name || "",
          }))
        );
        setLoading(false);
      },
      () => {
        setTasks([]);
        setLoading(false);
      }
    );

    return () => {
      unsub();
    };
  }, [restaurantId]);

  const handleAdd = async () => {
    if (!restaurantId || !auth.currentUser) return;
    const name = newTaskName.trim();
    if (!name) {
      return;
    }
    try {
      await addDoc(getRestaurantCollection(restaurantId, "openinglist"), {
        name,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser.uid,
        restaurantId,
        done: false,
        completedAt: null,
      });
      setNewTaskName("");
      setAddModalVisible(false);
    } catch (e) {
      console.error("Opening manage add error:", e);
      Alert.alert("Error", "Could not add task. Please try again.");
    }
  };

  const handleDelete = async (id) => {
    if (!restaurantId) return;
    try {
      await deleteDoc(getRestaurantDoc(restaurantId, "openinglist", id));
    } catch (e) {
      console.error("Opening manage delete error:", e);
      Alert.alert("Error", "Could not delete task. Please try again.");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>Manage opening tasks</Text>
          <Text style={styles.sub}>Opening checklist tasks</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => {
          setNewTaskName("");
          setAddModalVisible(true);
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
          <Text style={styles.emptyText}>No opening tasks yet.</Text>
        ) : (
          tasks.map((task) => (
            <View key={task.id} style={styles.taskRow}>
              <View style={styles.taskRowLeft}>
                <Ionicons
                  name="sunny-outline"
                  size={20}
                  color={Colors.primary}
                  style={{ marginRight: 10 }}
                />
                <Text style={styles.taskRowText} numberOfLines={2}>
                  {task.name}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() =>
                  Alert.alert(
                    "Delete task",
                    "Are you sure you want to delete this task?",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () => handleDelete(task.id),
                      },
                    ]
                  )
                }
                style={styles.deleteBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
      <Modal
        visible={addModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1, justifyContent: "flex-end" }}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setAddModalVisible(false)}
          />
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Add opening task</Text>
            <TextInput
              style={styles.modalInput}
              value={newTaskName}
              onChangeText={setNewTaskName}
              placeholder="Task name"
              placeholderTextColor={Colors.gray400}
            />
            <TouchableOpacity
              style={[styles.modalBtn, !newTaskName.trim() && { opacity: 0.5 }]}
              disabled={!newTaskName.trim()}
              onPress={handleAdd}
              activeOpacity={0.85}
            >
              <Text style={styles.modalBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontStyle: "italic",
    marginTop: 6,
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  taskRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 8,
  },
  taskRowText: {
    fontSize: 15,
    fontFamily: Typography.fontRegular,
    color: Colors.textPrimary,
  },
  deleteBtn: {
    padding: 4,
  },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  modalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  modalTitle: { fontFamily: Typography.fontBold, fontSize: 20, marginBottom: Spacing.md },
  modalInput: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: Spacing.md,
  },
  modalBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  modalBtnText: { color: "#fff", fontFamily: Typography.fontBold, fontSize: 17 },
});

