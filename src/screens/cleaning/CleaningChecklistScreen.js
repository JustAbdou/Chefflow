import React, { useState, useEffect, useMemo, useCallback } from "react";
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
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { onSnapshot, setDoc, serverTimestamp, query, where } from "firebase/firestore";
import { Colors } from "../../constants/Colors";
import { Typography } from "../../constants/Typography";
import { Spacing } from "../../constants/Spacing";
import useNavigationBar from "../../hooks/useNavigationBar";
import { getAndroidTitleMargin } from "../../utils/responsive";
import { useRestaurant } from "../../contexts/RestaurantContext";
import { getRestaurantCollection, getRestaurantDoc } from "../../utils/firestoreHelpers";
import { auth } from "../../../firebase";
import {
  getLocalDateKey,
  getWeekdayNameForDate,
  cleaningLogDocId,
  filterTasksForWeekday,
} from "../../utils/cleaningHelpers";

function formatSelectedDate(date) {
  const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
  const monthName = date.toLocaleDateString("en-US", { month: "long" });
  const dayNum = date.getDate();
  return `${dayName}, ${monthName} ${dayNum}`;
}

export default function CleaningChecklistScreen({ navigation }) {
  const { restaurantId } = useRestaurant();
  const [taskDefs, setTaskDefs] = useState([]);
  const [logsForDate, setLogsForDate] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const dateKey = getLocalDateKey(selectedDate);
  const weekdayName = getWeekdayNameForDate(selectedDate);

  const navigationBar = useNavigationBar();
  navigationBar.useHidden();

  useEffect(() => {
    if (!restaurantId) {
      setTaskDefs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      getRestaurantCollection(restaurantId, "cleaningTasks"),
      (snap) => {
        setTaskDefs(
          snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
            taskName: d.data().taskName || d.data().name || "",
          }))
        );
        setLoading(false);
        setRefreshing(false);
      },
      () => {
        setTaskDefs([]);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) {
      setLogsForDate({});
      return;
    }
    const q = query(
      getRestaurantCollection(restaurantId, "cleaningTaskLogs"),
      where("date", "==", dateKey)
    );
    const unsub = onSnapshot(
      q,
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

  const scheduledForDay = useMemo(
    () => filterTasksForWeekday(taskDefs, weekdayName),
    [taskDefs, weekdayName]
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 400);
  }, []);

  const upsertCompletion = async (task, completed) => {
    if (!restaurantId || !auth.currentUser) return;
    const logRef = getRestaurantDoc(
      restaurantId,
      "cleaningTaskLogs",
      cleaningLogDocId(task.id, dateKey)
    );
    await setDoc(
      logRef,
      {
        taskId: task.id,
        taskName: task.taskName || task.name || "",
        date: dateKey,
        completed,
        completedAt: completed ? serverTimestamp() : null,
        completedBy: completed ? auth.currentUser.uid : null,
      },
      { merge: true }
    );
  };

  const toggleComplete = async (task) => {
    const currently = logsForDate[task.id]?.completed === true;
    await upsertCompletion(task, !currently);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} tintColor={Colors.primary} />
        }
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Text style={styles.backArrow}>‹</Text>
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.title}>Cleaning Checklist</Text>
            <Text style={styles.subtitle}>Tasks by selected day of week</Text>
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
          onPress={() => navigation.navigate("CleaningManageTasks")}
          activeOpacity={0.85}
        >
          <Ionicons name="settings-outline" size={22} color={Colors.primary} />
          <Text style={styles.manageBtnText}>Manage tasks</Text>
          <Ionicons name="chevron-forward" size={20} color={Colors.gray400} style={{ marginLeft: "auto" }} />
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Scheduled for {weekdayName} ({scheduledForDay.length})
          </Text>
          {loading ? (
            <ActivityIndicator size="large" style={{ marginTop: 32 }} color={Colors.primary} />
          ) : scheduledForDay.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="sparkles-outline" size={40} color={Colors.gray400} />
              <Text style={styles.emptyTitle}>No tasks for {weekdayName}</Text>
              <Text style={styles.emptySub}>
                Nothing is assigned to this day. Use Manage tasks to add tasks or assign this weekday.
              </Text>
            </View>
          ) : (
            <View style={styles.tasksContainer}>
              {scheduledForDay.map((task) => {
                const done = logsForDate[task.id]?.completed === true;
                const days = (task.daysOfWeek || []).join(", ");
                return (
                  <TouchableOpacity
                    key={task.id}
                    style={styles.taskCard}
                    onPress={() => toggleComplete(task)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.taskLeft}>
                      {done ? (
                        <Ionicons name="checkmark-circle" size={26} color={Colors.primary} style={styles.check} />
                      ) : (
                        <Ionicons name="ellipse-outline" size={26} color="#94a3b8" style={styles.check} />
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.taskName, done && styles.taskNameDone]} numberOfLines={2}>
                          {task.taskName || task.name}
                        </Text>
                        {days ? <Text style={styles.taskMeta}>{days}</Text> : null}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
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
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg + getAndroidTitleMargin(),
    paddingBottom: Spacing.sm,
  },
  backButton: { padding: Spacing.xs, marginRight: Spacing.sm },
  backArrow: { fontSize: 32, color: Colors.textPrimary, fontWeight: "300" },
  headerContent: { flex: 1 },
  title: { fontSize: 24, fontFamily: Typography.fontBold, color: Colors.textPrimary },
  subtitle: { fontSize: 15, fontFamily: Typography.fontRegular, color: Colors.textSecondary, marginTop: 4 },
  dateSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.md,
    padding: Spacing.md,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  dateLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  dateInfo: { marginLeft: Spacing.md },
  dateLabel: { fontSize: 13, fontFamily: Typography.fontRegular, color: Colors.textSecondary, marginBottom: 2 },
  dateValue: { fontSize: 16, fontFamily: Typography.fontSemiBold, color: Colors.textPrimary },
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
  section: { paddingHorizontal: Spacing.lg },
  sectionTitle: {
    fontSize: 18,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  emptyBox: {
    alignItems: "center",
    paddingVertical: Spacing.xl * 1.5,
    paddingHorizontal: Spacing.lg,
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
  },
  emptyTitle: {
    marginTop: Spacing.md,
    fontFamily: Typography.fontBold,
    fontSize: 17,
    color: Colors.textPrimary,
    textAlign: "center",
  },
  emptySub: {
    marginTop: Spacing.sm,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  tasksContainer: { gap: Spacing.md },
  taskCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: Spacing.md,
  },
  taskLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  check: { marginRight: 12 },
  taskName: { fontFamily: Typography.fontBold, fontSize: 17, color: Colors.textPrimary },
  taskNameDone: { textDecorationLine: "line-through", opacity: 0.65 },
  taskMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
});
