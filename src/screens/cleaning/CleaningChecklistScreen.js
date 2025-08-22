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
import { getFormattedTodayDate, groupCleaningTasksByDay } from '../../utils/dateUtils';
import AddCleaningTaskModal from "./AddCleaningTaskModal"; // import the modal

export default function CleaningChecklistScreen({ navigation }) {
  const { restaurantId } = useRestaurant();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentDate, setCurrentDate] = useState('');

  // Hide Android navigation bar
  const navigationBar = useNavigationBar();
  navigationBar.useHidden(); // Use hidden mode for complete immersion

  useEffect(() => {
    setCurrentDate(getFormattedTodayDate());
  }, []);

  // Reusable function to fetch tasks
  const fetchTasks = async () => {
    if (!restaurantId) return;
    
    try {
      const snapshot = await getDocs(getRestaurantCollection(restaurantId, "closinglist"));
      const fetchedTasks = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          title: data.name || "",
          time: data.createdAt
            ? new Date(data.createdAt.seconds * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : "--:--",
          done: !!data.done,
          createdAt: data.createdAt, // Preserve original createdAt for grouping
          completedAt: data.completedAt, // Track when task was completed
        };
      });
      setTasks(fetchedTasks);
    } catch (e) {
      console.error("Error fetching cleaning tasks:", e);
      setTasks([]);
    }
  };

  // Daily reset function - reset completed tasks after 24 hours
  const performDailyReset = async () => {
    if (!restaurantId) return;
    
    try {
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
      
      const resetPromises = [];
      
      for (const task of tasks) {
        if (task.done && task.completedAt) {
          let completedDate;
          
          // Handle different timestamp formats
          if (task.completedAt.toDate) {
            completedDate = task.completedAt.toDate();
          } else if (task.completedAt.seconds) {
            completedDate = new Date(task.completedAt.seconds * 1000);
          } else {
            completedDate = new Date(task.completedAt);
          }
          
          // If task was completed more than 24 hours ago, reset it
          if (completedDate < twentyFourHoursAgo) {
            console.log(`Resetting cleaning task: ${task.title}`);
            const resetPromise = updateDoc(getRestaurantDoc(restaurantId, "closinglist", task.id), {
              done: false,
              completedAt: null,
            });
            resetPromises.push(resetPromise);
          }
        }
      }
      
      if (resetPromises.length > 0) {
        await Promise.all(resetPromises);
        console.log(`Reset ${resetPromises.length} cleaning tasks`);
        
        // Update local state
        setTasks(prevTasks =>
          prevTasks.map(task => {
            if (task.done && task.completedAt) {
              let completedDate;
              if (task.completedAt.toDate) {
                completedDate = task.completedAt.toDate();
              } else if (task.completedAt.seconds) {
                completedDate = new Date(task.completedAt.seconds * 1000);
              } else {
                completedDate = new Date(task.completedAt);
              }
              
              if (completedDate < twentyFourHoursAgo) {
                return { ...task, done: false, completedAt: null };
              }
            }
            return task;
          })
        );
      }
    } catch (error) {
      console.error('Error performing daily reset:', error);
    }
  };

  // Fetch tasks from Firestore
  useEffect(() => {
    const loadTasks = async () => {
      setLoading(true);
      await fetchTasks();
      await performDailyReset(); // Perform daily reset on load
      setLoading(false);
      setRefreshing(false);
    };
    loadTasks();
  }, [restaurantId]);

  // Pull to refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTasks();
    await performDailyReset(); // Perform daily reset on refresh
    setRefreshing(false);
  };

  // Toggle done state in Firestore and locally
  const toggleTaskDone = async (taskId, currentDone) => {
    if (!restaurantId) return;
    
    try {
      // Prepare update data
      const updateData = { done: !currentDone };
      
      // If marking as done, store completion timestamp
      if (!currentDone) {
        updateData.completedAt = serverTimestamp();
      } else {
        // If unmarking as done, clear completion timestamp
        updateData.completedAt = null;
      }
      
      // Update in Firestore
      await updateDoc(getRestaurantDoc(restaurantId, "closinglist", taskId), updateData);
      
      // Update locally
      setTasks(prevTasks =>
        prevTasks.map(task =>
          task.id === taskId 
            ? { 
                ...task, 
                done: !currentDone,
                completedAt: !currentDone ? new Date() : null 
              } 
            : task
        )
      );
    } catch (e) {
      console.error("Error updating cleaning task:", e);
    }
  };

  // Group tasks by day (today/yesterday based on 3 AM cutoff)
  // const { todayTasks, yesterdayTasks } = groupCleaningTasksByDay(tasks);

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
              <Text style={styles.title}>Closing Checklist</Text>
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
              {/* Today's Tasks */}
              {tasks.length > 0 && (
                <>
                  <View style={styles.tasksContainer}>
                    {tasks.map((task) => (
                      <TouchableOpacity 
                        key={task.id} 
                        style={styles.listItem}
                        onPress={() => toggleTaskDone(task.id, task.done)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.checkbox, task.done && styles.checkedBox]}>
                          {task.done && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                        <Text style={[styles.itemText, task.done && styles.completedText]}>
                          {task.title}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
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
  yesterdaySectionTitle: {
    color: Colors.warning, // Orange color for yesterday's tasks
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

  listItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    backgroundColor: Colors.gray50,
    borderRadius: 16,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
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