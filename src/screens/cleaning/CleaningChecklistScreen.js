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
import { Swipeable } from "react-native-gesture-handler";
import { Colors } from "../../constants/Colors";
import { Typography } from "../../constants/Typography";
import { Spacing } from "../../constants/Spacing";
import useNavigationBar from "../../hooks/useNavigationBar";
import { getAndroidTitleMargin } from "../../utils/responsive";
import { getDocs, updateDoc, addDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { useRestaurant } from "../../contexts/RestaurantContext";
import { getRestaurantCollection, getRestaurantDoc } from "../../utils/firestoreHelpers";
import { auth } from "../../../firebase";
import { getFormattedTodayDate, groupCleaningTasksByDay } from '../../utils/dateUtils';
import AddCleaningTaskModal from "./AddCleaningTaskModal";
export default function CleaningChecklistScreen({ navigation }) {
  const { restaurantId } = useRestaurant();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentDate, setCurrentDate] = useState('');
  const navigationBar = useNavigationBar();
  navigationBar.useHidden();
  useEffect(() => {
    setCurrentDate(getFormattedTodayDate());
  }, []);
  const fetchTasks = async () => {
    if (!restaurantId) return;
    try {
      const snapshot = await getDocs(getRestaurantCollection(restaurantId, "cleaninglist"));
      const fetchedTasks = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          title: data.name || "",
          time: data.createdAt
            ? new Date(data.createdAt.seconds * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : "--:--",
          done: !!data.done,
          createdAt: data.createdAt,
        };
      });
      setTasks(fetchedTasks);
    } catch (e) {
      console.error("Error fetching cleaning tasks:", e);
      setTasks([]);
    }
  };
  useEffect(() => {
    const loadTasks = async () => {
      setLoading(true);
      await fetchTasks();
      setLoading(false);
      setRefreshing(false);
    };
    loadTasks();
  }, [restaurantId]);
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTasks();
    setRefreshing(false);
  };
  const toggleTaskDone = async (taskId, currentDone) => {
    if (!restaurantId) return;
    try {
      await updateDoc(getRestaurantDoc(restaurantId, "cleaninglist", taskId), { done: !currentDone });
      setTasks(prevTasks =>
        prevTasks.map(task =>
          task.id === taskId ? { ...task, done: !currentDone } : task
        )
      );
    } catch (e) {
      console.error("Error updating cleaning task:", e);
    }
  };
  const handleAddTask = async (taskName) => {
    if (!restaurantId || !auth.currentUser) return;
    try {
      await addDoc(getRestaurantCollection(restaurantId, "cleaninglist"), {
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser.uid,
        name: taskName,
        done: false,
        restaurantId: restaurantId,
      });
      await fetchTasks();
    } catch (error) {
      console.error("Error adding cleaning task:", error);
    }
  };
  const deleteTask = async (taskId) => {
    if (!restaurantId) return;
    try {
      await deleteDoc(getRestaurantDoc(restaurantId, "cleaninglist", taskId));
      setTasks((tasks) => tasks.filter((task) => task.id !== taskId));
    } catch (error) {
      console.error("Error deleting cleaning task:", error);
    }
  };
  const { todayTasks, yesterdayTasks } = groupCleaningTasksByDay(tasks);
  const renderRightActions = (taskId) => (
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
        onPress={() => deleteTask(taskId)}
        activeOpacity={0.8}
      >
        <Text style={{ color: "white", fontWeight: "bold", fontSize: 16 }}>Delete</Text>
      </TouchableOpacity>
    </View>
  );
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <View style={styles.backHeader}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
              <Text style={styles.backArrow}>‹</Text>
            </TouchableOpacity>
            <View style={styles.titleContainer}>
              <Text style={styles.title}>Cleaning Checklist</Text>
              <Text style={styles.date}>{currentDate}</Text>
            </View>
          </View>
        </View>
        <View style={styles.section}>
          {loading ? (
            <ActivityIndicator size="large" style={{ marginTop: 40 }} />
          ) : (
            <>
              {todayTasks.length > 0 && (
                <>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Today's Tasks</Text>
                  </View>
                  <View style={styles.tasksContainer}>
                    {todayTasks.map((task) => (
                      <Swipeable
                        key={task.id}
                        renderRightActions={() => renderRightActions(task.id)}
                        overshootRight={false}
                        containerStyle={{ backgroundColor: "transparent" }}
                      >
                        <View style={styles.taskCard}>
                          <View style={styles.taskLeft}>
                            <TouchableOpacity onPress={() => toggleTaskDone(task.id, task.done)}>
                              {task.done ? (
                                <Ionicons name="checkmark-circle" size={24} color="#2563eb" style={styles.checkCircle} />
                              ) : (
                                <Ionicons name="ellipse-outline" size={24} color="#A0A7B3" style={styles.checkCircle} />
                              )}
                            </TouchableOpacity>
                            <View style={styles.taskContent}>
                              <Text style={styles.taskTitle}>{task.title}</Text>
                              <Text style={styles.taskTime}>{task.time}</Text>
                            </View>
                          </View>
                        </View>
                      </Swipeable>
                    ))}
                  </View>
                </>
              )}
              {yesterdayTasks.length > 0 && (
                <>
                  <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, styles.yesterdaySectionTitle]}>Yesterday's Tasks</Text>
                  </View>
                  <View style={styles.tasksContainer}>
                    {yesterdayTasks.map((task) => (
                      <Swipeable
                        key={task.id}
                        renderRightActions={() => renderRightActions(task.id)}
                        overshootRight={false}
                        containerStyle={{ backgroundColor: "transparent" }}
                      >
                        <View style={styles.taskCard}>
                          <View style={styles.taskLeft}>
                            <TouchableOpacity onPress={() => toggleTaskDone(task.id, task.done)}>
                              {task.done ? (
                                <Ionicons name="checkmark-circle" size={24} color="#2563eb" style={styles.checkCircle} />
                              ) : (
                                <Ionicons name="ellipse-outline" size={24} color="#A0A7B3" style={styles.checkCircle} />
                              )}
                            </TouchableOpacity>
                            <View style={styles.taskContent}>
                              <Text style={styles.taskTitle}>{task.title}</Text>
                              <Text style={styles.taskTime}>{task.time}</Text>
                            </View>
                          </View>
                        </View>
                      </Swipeable>
                    ))}
                  </View>
                </>
              )}
              {todayTasks.length === 0 && yesterdayTasks.length === 0 && (
                <Text style={styles.emptyState}>No cleaning tasks yet. Add your first task!</Text>
              )}
            </>
          )}
        </View>
      </ScrollView>
      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Ionicons name="add" size={38} color="#fff" />
      </TouchableOpacity>
      <AddCleaningTaskModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onAdd={handleAddTask}
        date={currentDate}
      />
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
  viewAllText: {
    fontSize: 16,
    fontFamily: Typography.fontMedium,
    color: "#2563eb",
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
  taskTime: {
    fontFamily: Typography.fontRegular,
    fontSize: 16,
    color: "#8B96A5",
  },
  taskRight: {
    alignItems: "flex-end",
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