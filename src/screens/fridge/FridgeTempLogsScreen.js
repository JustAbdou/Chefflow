import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Swipeable } from "react-native-gesture-handler";
import { getDocs, addDoc, serverTimestamp, doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { useRestaurant } from "../../contexts/RestaurantContext";
import { getRestaurantCollection, getRestaurantDoc } from "../../utils/firestoreHelpers";
import { auth } from "../../../firebase";

import { Colors } from "../../constants/Colors";
import { Typography } from "../../constants/Typography";
import { Spacing } from "../../constants/Spacing";
import { getAndroidTitleMargin } from "../../utils/responsive";
import useNavigationBar from "../../hooks/useNavigationBar";

export default function FridgeTempLogsScreen({ navigation }) {
  const { restaurantId } = useRestaurant();
  const [fridgeNames, setFridgeNames] = useState([]);
  const [logs, setLogs] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const updateTimeouts = useRef({});

  // Hide Android navigation bar
  const navigationBar = useNavigationBar();
  navigationBar.useHidden(); // Use hidden mode for complete immersion

  // Date formatting
  const today = new Date();
  const dayName = today.toLocaleDateString(undefined, { weekday: "long" });
  const monthName = today.toLocaleDateString(undefined, { month: "long" });
  const dayNum = today.getDate();
  const todayString = `${dayName}, ${monthName} ${dayNum}`;

  // Fetch fridge names from Firestore
  const fetchFridgeNames = async () => {
    if (!restaurantId) return;
    
    try {
      const fridgesDocRef = getRestaurantDoc(restaurantId, "fridges", "fridges");
      const fridgesDoc = await getDoc(fridgesDocRef);
      
      if (fridgesDoc.exists() && fridgesDoc.data().names) {
        setFridgeNames(fridgesDoc.data().names);
      } else {
        setFridgeNames([]);
      }
    } catch (error) {
      console.error("Error fetching fridge names:", error);
      setFridgeNames([]);
    }
  };

  // Fetch logs from fridgelogs collection
  const fetchLogs = async () => {
    if (!restaurantId) return;
    
    try {
      const fridgeLogsCollection = getRestaurantCollection(restaurantId, 'fridgelogs');
      const logsSnapshot = await getDocs(fridgeLogsCollection);
      
      let allLogs = [];
      logsSnapshot.forEach(docSnap => {
        const data = docSnap.data();
        allLogs.push({
          id: docSnap.id,
          ...data,
        });
      });
      
      // Sort logs by createdAt (newest first)
      allLogs.sort((a, b) => {
        if (a.createdAt && b.createdAt) {
          return b.createdAt.seconds - a.createdAt.seconds;
        }
        return 0;
      });
      
      setLogs(allLogs);
    } catch (error) {
      console.error('Error fetching fridge logs:', error);
    }
  };

  // Fetch data from Firestore
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchFridgeNames(), fetchLogs()]);
      setLoading(false);
      setRefreshing(false);
    };
    loadData();
  }, [restaurantId]);

  // Pull to refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchFridgeNames(), fetchLogs()]);
    setRefreshing(false);
  };

  // Create or update fridge log for a fridge
  const handleCreateOrUpdateLog = async (fridgeName) => {
    if (!restaurantId || !auth.currentUser) return;
    
    try {
      // Check if a log already exists for this fridge today
      const existingLog = logs.find(log => log.fridge === fridgeName);
      
      if (!existingLog) {
        // Create new log
        await addDoc(getRestaurantCollection(restaurantId, "fridgelogs"), {
          fridge: fridgeName,
          createdAt: serverTimestamp(),
          createdBy: auth.currentUser.uid,
          restaurantId: restaurantId,
          temps: { am: "", pm: "" },
        });
        
        // Refresh logs
        await fetchLogs();
      }
    } catch (error) {
      console.error("Error creating fridge log:", error);
    }
  };

  // Get combined fridge data (from fridge names list and existing logs)
  const getCombinedFridgeData = () => {
    const fridgeData = [];
    
    // Add all fridges from the fridge names list
    fridgeNames.forEach(fridgeName => {
      const existingLog = logs.find(log => log.fridge === fridgeName);
      
      if (existingLog) {
        // Use existing log data, ensure temps object exists
        fridgeData.push({
          ...existingLog,
          temps: existingLog.temps || { am: "", pm: "" },
        });
      } else {
        // Create placeholder data for fridge without log
        // Use a consistent ID format that includes the fridge name
        const placeholderId = `placeholder-${fridgeName}`;
        fridgeData.push({
          id: placeholderId,
          fridge: fridgeName,
          createdAt: null,
          temps: { am: "", pm: "" },
          isPlaceholder: true,
        });
      }
    });
    
    return fridgeData;
  };

  // Set temperature handler (updates local state immediately, Firestore with debounce)
  const handleSetTemp = async (fridgeName, logId, type, value) => {
    // If this is a placeholder (no log exists), create the log first
    if (!logId || logId.startsWith('placeholder-')) {
      try {
        // Create new log
        const newLogRef = await addDoc(getRestaurantCollection(restaurantId, "fridgelogs"), {
          fridge: fridgeName,
          createdAt: serverTimestamp(),
          createdBy: auth.currentUser.uid,
          restaurantId: restaurantId,
          temps: { am: type === 'am' ? value : "", pm: type === 'pm' ? value : "" },
        });
        
        // Update local state immediately with the new log instead of refreshing
        const newLog = {
          id: newLogRef.id,
          fridge: fridgeName,
          createdAt: new Date(),
          temps: { am: type === 'am' ? value : "", pm: type === 'pm' ? value : "" },
          isPlaceholder: false,
        };
        
        setLogs(prev => {
          // Remove the placeholder and add the real log
          const filteredLogs = prev.filter(log => log.id !== logId);
          return [...filteredLogs, newLog];
        });
        
        return; // Don't continue with the timeout logic for new logs
      } catch (error) {
        console.error("Error creating fridge log:", error);
        return;
      }
    }
    
    // Update local state immediately with the raw value for responsive UI
    setLogs(prev =>
      prev.map(l =>
        l.id === logId ? { 
          ...l, 
          temps: { ...l.temps, [type]: value } 
        } : l
      )
    );

    // Clear existing timeout for this specific field
    const timeoutKey = `${logId}-${type}`;
    if (updateTimeouts.current[timeoutKey]) {
      clearTimeout(updateTimeouts.current[timeoutKey]);
    }

    // Set new timeout to update Firestore after user stops typing
    updateTimeouts.current[timeoutKey] = setTimeout(async () => {
      if (!restaurantId) return;
      
      try {
        // Process the value for storage (add negative sign if needed)
        let processedValue = value;
        if (value && !value.startsWith('-') && value !== '' && !isNaN(value)) {
          processedValue = '-' + value;
        }
        
        await updateDoc(getRestaurantDoc(restaurantId, "fridgelogs", logId), {
          [`temps.${type}`]: processedValue,
        });
        
        // Update local state with the processed value after successful save
        setLogs(prev =>
          prev.map(l =>
            l.id === logId ? { 
              ...l, 
              temps: { ...l.temps, [type]: processedValue } 
            } : l
          )
        );
        
        console.log(`Updated ${type} temperature for ${logId}: ${processedValue}`);
      } catch (error) {
        console.error("Error updating temperature:", error);
      }
      
      // Clean up the timeout reference
      delete updateTimeouts.current[timeoutKey];
    }, 500); // 500ms delay after user stops typing
  };

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(updateTimeouts.current).forEach(timeout => {
        clearTimeout(timeout);
      });
    };
  }, []);

  // Helper for time display (for existing logs)
  const formatTime = (createdAt) => {
    if (!createdAt) return "--:--";
    const date = new Date(createdAt.seconds * 1000);
    let hours = date.getHours();
    let minutes = date.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${hours}:${minutes.toString().padStart(2, "0")} ${ampm}`;
  };

  // Delete individual log
  const deleteLog = async (logId) => {
    if (!restaurantId) return;
    
    try {
      await deleteDoc(getRestaurantDoc(restaurantId, "fridgelogs", logId));
      setLogs((logs) => logs.filter((log) => log.id !== logId));
    } catch (error) {
      console.error("Error deleting fridge log:", error);
    }
  };

  // Render right action for swipe-to-delete
  const renderRightActions = (logId) => (
    <View style={styles.swipeActionContainer}>
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={() => deleteLog(logId)}
        activeOpacity={0.8}
      >
        <Ionicons name="trash-outline" size={24} color="white" />
        <Text style={styles.deleteActionText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView 
          style={{ flex: 1 }} 
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.backHeader}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
              <Text style={styles.backArrow}>‹</Text>
            </TouchableOpacity>
            <View style={styles.titleContainer}>
              <Text style={styles.title}>Fridge Temperature Logs</Text>
              <Text style={styles.date}>{todayString}</Text>
            </View>
          </View>
        </View>

        {/* Fridges Section */}
        <Text style={styles.fridgesTitle}>Fridges</Text>
        <View style={{ marginTop: 12 }}>
          {loading ? (
            <ActivityIndicator size="large" style={{ marginTop: 40 }} />
          ) : (
            getCombinedFridgeData().map((fridgeData) => (
              <Swipeable
                key={fridgeData.id}
                renderRightActions={() => !fridgeData.isPlaceholder ? renderRightActions(fridgeData.id) : null}
                overshootRight={false}
                containerStyle={styles.swipeableContainer}
              >
                <View style={styles.fridgeCard}>
                  <TouchableOpacity
                    style={styles.fridgeHeader}
                    onPress={() =>
                      setExpanded((prev) => ({
                        ...prev,
                        [fridgeData.id]: !prev[fridgeData.id],
                      }))
                    }
                    activeOpacity={0.8}
                  >
                  <View>
                    <Text style={styles.fridgeName}>{fridgeData.fridge}</Text>
                    <Text style={styles.fridgeTime}>
                      {fridgeData.isPlaceholder ? (
                        "Not logged today"
                      ) : (
                        `Today - ${
                          fridgeData.createdAt
                            ? formatTime(fridgeData.createdAt)
                            : "--:--"
                        }`
                      )}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[styles.tempValue, { color: "#2563eb" }]}>
                      AM: {fridgeData.temps.am
                        ? `${fridgeData.temps.am}°C`
                        : "--°C"}
                    </Text>
                    <Text style={styles.tempValue}>
                      PM: {fridgeData.temps.pm
                        ? `${fridgeData.temps.pm}°C`
                        : "--°C"}
                    </Text>
                  </View>
                </TouchableOpacity>
                {expanded[fridgeData.id] && (
                  <View style={styles.tempInputsContainer}>
                    <View style={styles.tempInputCard}>
                      <Text style={styles.tempInputLabel}>Set Temperature</Text>
                      <Text style={styles.tempInputType}>AM Check</Text>
                      <View style={styles.tempInputRow}>
                        <TextInput
                          style={styles.tempInput}
                          value={fridgeData.temps.am}
                          onChangeText={(val) => handleSetTemp(fridgeData.fridge, fridgeData.id, "am", val)}
                          placeholder="--"
                          placeholderTextColor="#A0A7B3"
                          keyboardType="numeric"
                        />
                        <Text style={styles.tempUnit}>℃</Text>
                      </View>
                    </View>
                    <View style={styles.tempInputCard}>
                      <Text style={styles.tempInputLabel}>Set Temperature</Text>
                      <Text style={styles.tempInputType}>PM Check</Text>
                      <View style={styles.tempInputRow}>
                        <TextInput
                          style={styles.tempInput}
                          value={fridgeData.temps.pm}
                          onChangeText={(val) => handleSetTemp(fridgeData.fridge, fridgeData.id, "pm", val)}
                          placeholder="--"
                          placeholderTextColor="#A0A7B3"
                          keyboardType="numeric"
                        />
                        <Text style={styles.tempUnit}>℃</Text>
                      </View>
                    </View>
                  </View>
                )}
                </View>
              </Swipeable>
            ))
          )}
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  backHeader: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    width: "100%",
    paddingTop: Spacing.lg + getAndroidTitleMargin(),
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
  fridgesTitle: {
    fontSize: 22,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
    marginLeft: Spacing.lg,
    marginTop: Spacing.lg,
    marginBottom: 8,
  },
  fridgeCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  fridgeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fridgeName: {
    fontFamily: Typography.fontBold,
    fontSize: 18,
    color: "#111",
  },
  fridgeTime: {
    fontFamily: Typography.fontRegular,
    fontSize: 16,
    color: "#8B96A5",
    marginTop: 2,
  },
  tempValue: {
    fontFamily: Typography.fontBold,
    fontSize: 18,
    color: "#111",
    textAlign: "right",
  },
  tempInputsContainer: {
    marginTop: 18,
    gap: 12,
  },
  tempInputCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 0,
  },
  tempInputLabel: {
    fontFamily: Typography.fontRegular,
    fontSize: 15,
    color: "#8B96A5",
    marginBottom: 2,
  },
  tempInputType: {
    fontFamily: Typography.fontBold,
    fontSize: 16,
    color: "#222",
    marginBottom: 8,
  },
  tempInputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  tempInput: {
    fontFamily: Typography.fontBold,
    fontSize: 22,
    color: "#111",
    flex: 1,
    marginRight: 8,
  },
  tempUnit: {
    fontFamily: Typography.fontBold,
    fontSize: 22,
    color: "#8B96A5",
  },
  swipeableContainer: {
    backgroundColor: "transparent",
    marginHorizontal: 16,
    marginBottom: 18,
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