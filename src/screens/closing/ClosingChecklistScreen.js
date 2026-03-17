/**
 * Closing checklist: one-off tasks in closinglist (unchanged behavior).
 * Cleaning Checklist (recurring) lives in CleaningChecklistScreen.
 */
import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../constants/Colors";
import { Typography } from "../../constants/Typography";
import { Spacing } from "../../constants/Spacing";
import useNavigationBar from "../../hooks/useNavigationBar";
import { getAndroidTitleMargin } from "../../utils/responsive";
import {
  getDocs,
  addDoc,
  serverTimestamp,
  onSnapshot,
  setDoc,
  query,
  where,
} from "firebase/firestore";
import { useRestaurant } from "../../contexts/RestaurantContext";
import { getRestaurantCollection, getRestaurantDoc } from "../../utils/firestoreHelpers";
import { auth } from "../../../firebase";
import { getFormattedTodayDate } from "../../utils/dateUtils";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { getLocalDateKey } from "../../utils/cleaningHelpers";

export default function ClosingChecklistScreen({ navigation }) {
  const { restaurantId } = useRestaurant();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [taskName, setTaskName] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [logsForDate, setLogsForDate] = useState({});

  const navigationBar = useNavigationBar();
  navigationBar.useHidden();

  useEffect(() => {
    setCurrentDate(getFormattedTodayDate());
  }, []);

  const dateKey = useMemo(() => getLocalDateKey(selectedDate), [selectedDate]);

  // Subscribe to closing tasks (definitions) in real time
  useEffect(() => {
    if (!restaurantId) {
      setTasks([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      getRestaurantCollection(restaurantId, "closinglist"),
      (snapshot) => {
        const fetched = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            title: data.name || "",
          };
        });
        setTasks(fetched);
        setLoading(false);
        setRefreshing(false);
      },
      () => {
        setTasks([]);
        setLoading(false);
        setRefreshing(false);
      }
    );
    return () => unsub();
  }, [restaurantId]);

  // Listen for daily completion logs for the selected date
  useEffect(() => {
    if (!restaurantId) {
      setLogsForDate({});
      return;
    }
    const logsQuery = query(
      getRestaurantCollection(restaurantId, "closingChecklistLogs"),
      where("date", "==", dateKey)
    );
    const unsub = onSnapshot(
      logsQuery,
      (snap) => {
        const byTaskId = {};
        snap.docs.forEach((d) => {
          const data = d.data();
          if (data.taskId) byTaskId[data.taskId] = data;
        });
        setLogsForDate(byTaskId);
      },
      () => setLogsForDate({})
    );
    return () => unsub();
  }, [restaurantId, dateKey]);

  const onRefresh = async () => {
    setRefreshing(true);
    // data is driven by onSnapshot; just stop spinner after a short delay
    setTimeout(() => setRefreshing(false), 300);
  };

  const formatSelectedDate = (date) => {
    const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
    const monthName = date.toLocaleDateString("en-US", { month: "long" });
    const dayNum = date.getDate();
    return `${dayName}, ${monthName} ${dayNum}`;
  };

  const toggleTaskDone = async (task) => {
    if (!restaurantId || !auth.currentUser) return;
    const existing = logsForDate[task.id];
    const nextCompleted = !(existing && existing.completed === true);
    try {
      const logRef = getRestaurantDoc(
        restaurantId,
        "closingChecklistLogs",
        `${dateKey}_${task.id}`
      );
      await setDoc(
        logRef,
        {
          taskId: task.id,
          taskName: task.title,
          date: dateKey,
          completed: nextCompleted,
          completedAt: nextCompleted ? serverTimestamp() : null,
          completedBy: nextCompleted ? auth.currentUser.uid : null,
        },
        { merge: true }
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddTask = async () => {
    if (!restaurantId || !auth.currentUser || !taskName.trim()) return;
    try {
      await addDoc(getRestaurantCollection(restaurantId, "closinglist"), {
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser.uid,
        name: taskName.trim(),
        done: false,
        restaurantId,
        completedAt: null,
      });
      setTaskName("");
      setModalVisible(false);
      await fetchTasks();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <View style={styles.backHeader}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Text style={styles.backArrow}>‹</Text>
            </TouchableOpacity>
            <View style={styles.titleContainer}>
              <Text style={styles.title}>Closing Checklist</Text>
              <Text style={styles.date}>{currentDate}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.dateSelector}
          onPress={() => setShowDatePicker(true)}
          activeOpacity={0.85}
        >
          <View style={styles.dateLeft}>
            <Ionicons name="calendar-outline" size={24} color={Colors.primary} />
            <View style={styles.dateInfo}>
              <Text style={styles.dateLabel}>Selected date</Text>
              <Text style={styles.dateValue}>{formatSelectedDate(selectedDate)}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#6B7280" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.manageBtn}
          onPress={() => navigation.navigate("ClosingChecklistManageTasks")}
          activeOpacity={0.85}
        >
          <Ionicons name="settings-outline" size={22} color={Colors.primary} />
          <Text style={styles.manageBtnText}>Manage tasks</Text>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={Colors.gray400}
            style={{ marginLeft: "auto" }}
          />
        </TouchableOpacity>

        <View style={styles.section}>
          {loading ? (
            <ActivityIndicator size="large" style={{ marginTop: 40 }} />
          ) : tasks.length === 0 ? (
            <Text style={styles.emptyState}>No closing tasks yet. Add one to get started.</Text>
          ) : (
            <View style={styles.tasksContainer}>
              {tasks.map((task) => (
                <TouchableOpacity
                  key={task.id}
                  style={styles.taskCard}
                  onPress={() => toggleTaskDone(task)}
                  activeOpacity={0.7}
                >
                  <View style={styles.taskLeft}>
                    {logsForDate[task.id]?.completed === true ? (
                      <Ionicons name="checkmark-circle" size={24} color={Colors.primary} style={styles.checkCircle} />
                    ) : (
                      <Ionicons name="ellipse-outline" size={24} color="#A0A7B3" style={styles.checkCircle} />
                    )}
                    <Text
                      style={[
                        styles.taskTitle,
                        logsForDate[task.id]?.completed === true && {
                          textDecorationLine: "line-through",
                          opacity: 0.6,
                        },
                      ]}
                    >
                      {task.title}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
      <DateTimePickerModal
        isVisible={showDatePicker}
        mode="date"
        date={selectedDate}
        onConfirm={(date) => {
          setSelectedDate(date);
          setShowDatePicker(false);
        }}
        onCancel={() => setShowDatePicker(false)}
        maximumDate={new Date()}
        themeVariant="light"
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg + getAndroidTitleMargin(),
    paddingBottom: Spacing.md,
  },
  backHeader: { flexDirection: "row", alignItems: "center", width: "100%" },
  backButton: { marginRight: Spacing.md, padding: Spacing.xs },
  backArrow: { fontSize: 35, color: Colors.textPrimary, fontWeight: "300" },
  titleContainer: { flex: 1 },
  title: { fontSize: 26, fontFamily: Typography.fontBold, color: Colors.textPrimary },
  date: { fontSize: Typography.md, color: Colors.textSecondary, marginTop: Spacing.xs },
  section: { paddingHorizontal: Spacing.lg, marginTop: Spacing.md },
  emptyState: { textAlign: "center", marginTop: 40, color: Colors.textSecondary, fontSize: Typography.md },
  tasksContainer: { gap: Spacing.md },
  dateSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  dateLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  dateInfo: { marginLeft: Spacing.md },
  dateLabel: {
    fontSize: 13,
    fontFamily: Typography.fontRegular,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  dateValue: {
    fontSize: 16,
    fontFamily: Typography.fontSemiBold,
    color: Colors.textPrimary,
  },
  taskCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  taskLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  checkCircle: { marginRight: 14 },
  taskTitle: { fontFamily: Typography.fontBold, fontSize: 18, color: "#111", flex: 1 },
  manageBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.lg,
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: Spacing.lg,
    gap: 10,
  },
  manageBtnText: { fontFamily: Typography.fontBold, fontSize: 16, color: Colors.textPrimary },
});
