import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../constants/Colors";
import { Typography } from "../../constants/Typography";
import { Spacing } from "../../constants/Spacing";
import useNavigationBar from "../../hooks/useNavigationBar";
import { getAndroidTitleMargin } from "../../utils/responsive";
import { getDocs, updateDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { useRestaurant } from "../../contexts/RestaurantContext";
import { getRestaurantCollection, getRestaurantDoc } from "../../utils/firestoreHelpers";
import { auth } from "../../../firebase";
import { getFormattedTodayDate } from '../../utils/dateUtils';

export default function OpeningChecklistScreen({ navigation }) {
  const { restaurantId } = useRestaurant();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentDate, setCurrentDate] = useState('');

  // Hide Android navigation bar
  const navigationBar = useNavigationBar();
  navigationBar.useHidden(); // Use hidden mode for complete immersion

  useEffect(() => {
    setCurrentDate(getFormattedTodayDate());
    console.log('🏪 Restaurant ID from context:', restaurantId);
    console.log('👤 Current user:', auth.currentUser?.uid);
  }, []);

  // Reusable function to fetch tasks
  const fetchTasks = async () => {
    if (!restaurantId) return;

    try {
      console.log('🔍 Fetching opening tasks for restaurant:', restaurantId);
      const snapshot = await getDocs(getRestaurantCollection(restaurantId, "openinglist"));
      console.log('📋 Found', snapshot.docs.length, 'opening tasks');

      const fetchedTasks = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        console.log('📝 Task data:', data);
        return {
          id: docSnap.id,
          title: data.name || "",
          time: data.createdAt
            ? new Date(data.createdAt.seconds * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : "--:--",
          done: !!data.done,
          createdAt: data.createdAt, // Preserve original createdAt for grouping
        };
      });
      console.log('✅ Processed tasks:', fetchedTasks);
      setTasks(fetchedTasks);
    } catch (e) {
      console.error("❌ Error fetching opening tasks:", e);
      setTasks([]);
    }
  };

  // Fetch tasks from Firestore
  useEffect(() => {
    const loadTasks = async () => {
      setLoading(true);
      await fetchTasks();
      setLoading(false);
      setRefreshing(false);
    };
    loadTasks();
  }, [restaurantId]);

  // Pull to refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTasks();
    setRefreshing(false);
  };

  // Toggle done state in Firestore and locally
  const toggleTaskDone = async (taskId, currentDone) => {
    if (!restaurantId) return;

    try {
      // Prepare update object
      const updateData = {
        done: !currentDone,
        completedAt: !currentDone ? serverTimestamp() : null
      };

      // Update in Firestore
      await updateDoc(getRestaurantDoc(restaurantId, "openinglist", taskId), updateData);
      // Update locally
      setTasks(prevTasks =>
        prevTasks.map(task =>
          task.id === taskId ? { ...task, done: !currentDone } : task
        )
      );
    } catch (e) {
      console.error("Error updating opening task:", e);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.backHeader}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
              <Text style={styles.backArrow}>‹</Text>
            </TouchableOpacity>
            <View style={styles.titleContainer}>
              <Text style={styles.title}>Opening Checklist</Text>
              <Text style={styles.date}>{currentDate}</Text>
            </View>
          </View>
        </View>

        {/* Tasks List */}
        <View style={styles.section}>
          {loading ? (
            <ActivityIndicator size="large" style={{ marginTop: 40 }} />
          ) : (
            <>
              {/* All Tasks */}
              {tasks.length > 0 && (
                <>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Opening Tasks ({tasks.length})</Text>
                  </View>
                  <View style={styles.tasksContainer}>
                    {tasks.map((task) => (
                      <TouchableOpacity
                        key={task.id}
                        style={styles.taskCard}
                        onPress={() => toggleTaskDone(task.id, task.done)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.taskLeft}>
                          {task.done ? (
                            <Ionicons name="checkmark-circle" size={24} color="#2563eb" style={styles.checkCircle} />
                          ) : (
                            <Ionicons name="ellipse-outline" size={24} color="#A0A7B3" style={styles.checkCircle} />
                          )}
                          <View style={styles.taskContent}>
                            <Text style={[styles.taskTitle, task.done && {textDecorationLine: 'line-through', opacity: 0.6}]}>
                              {task.title}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {/* Empty state */}
              {tasks.length === 0 && (
                <>
                  <Text style={styles.emptyState}>No opening tasks found.</Text>
                  <Text style={[styles.emptyState, {marginTop: 10, fontSize: 14}]}>
                    Restaurant ID: {restaurantId || 'Not found'}
                  </Text>
                  <Text style={[styles.emptyState, {marginTop: 5, fontSize: 14}]}>
                    Total tasks in state: {tasks.length}
                  </Text>
                  <Text style={[styles.emptyState, {marginTop: 5, fontSize: 14}]}>
                    User authenticated: {auth.currentUser ? 'Yes' : 'No'}
                  </Text>
                </>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  appTitle: {
    fontFamily: Typography.fontBold,
    fontSize: 28,
    color: "#2563eb",
    textAlign: "center",
    marginTop: 12,
    marginBottom: 8,
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
    fontSize: 26,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
  },
  date: {
    fontSize: Typography.md,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  section: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: Spacing.md,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
  },
  emptyState: {
    textAlign: "center",
    marginTop: 40,
    fontSize: Typography.md,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  tasksContainer: {
    gap: Spacing.md,
  },
  taskCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 16,
    justifyContent: "space-between",
  },
  taskLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  checkCircle: {
    marginRight: 14,
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontFamily: Typography.fontBold,
    fontSize: 18,
    color: "#111",
    marginBottom: 2,
  },
});
