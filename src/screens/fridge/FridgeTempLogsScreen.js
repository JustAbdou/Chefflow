import React, { useState, useEffect, useRef } from "react";
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
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Swipeable } from "react-native-gesture-handler";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { Colors } from "../../constants/Colors";
import { Typography } from "../../constants/Typography";
import { Spacing } from "../../constants/Spacing";
import { getAndroidTitleMargin } from "../../utils/responsive";
import useNavigationBar from "../../hooks/useNavigationBar";
import { addDoc, getDocs, updateDoc, serverTimestamp, doc, getDoc, deleteDoc } from "firebase/firestore";
import { useRestaurant } from "../../contexts/RestaurantContext";
import { getRestaurantCollection, getRestaurantDoc } from "../../utils/firestoreHelpers";
import { auth } from "../../../firebase";

export default function FridgeTempLogsScreen({ navigation }) {
  const { restaurantId } = useRestaurant();
  const [fridgeNames, setFridgeNames] = useState([]);
  const [logs, setLogs] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [inputValues, setInputValues] = useState({});
  const animationRefs = useRef({});

  // Hide Android navigation bar
  const navigationBar = useNavigationBar();
  navigationBar.useHidden(); // Use hidden mode for complete immersion

  // Date formatting
  const formatSelectedDate = (date) => {
    const dayName = date.toLocaleDateString(undefined, { weekday: "long" });
    const monthName = date.toLocaleDateString(undefined, { month: "long" });
    const dayNum = date.getDate();
    return `${dayName}, ${monthName} ${dayNum}`;
  };

  const todayString = formatSelectedDate(selectedDate);

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

  // Fetch logs from fridgelogs collection for the selected date
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
      
      // Filter logs for the selected date
      const selectedDateStart = new Date(selectedDate);
      selectedDateStart.setHours(0, 0, 0, 0);
      const selectedDateEnd = new Date(selectedDate);
      selectedDateEnd.setHours(23, 59, 59, 999);
      
      const filteredLogs = allLogs.filter(log => {
        if (!log.createdAt) return false;
        const logDate = log.createdAt.toDate ? log.createdAt.toDate() : new Date(log.createdAt.seconds * 1000);
        return logDate >= selectedDateStart && logDate <= selectedDateEnd;
      });
      
      // Sort logs by createdAt (newest first)
      filteredLogs.sort((a, b) => {
        if (a.createdAt && b.createdAt) {
          return b.createdAt.seconds - a.createdAt.seconds;
        }
        return 0;
      });
      
      setLogs(filteredLogs);
    } catch (error) {
      console.error('Error fetching fridge logs:', error);
    }
  };

  // Date picker handlers
  const handleDateConfirm = (date) => {
    setSelectedDate(date);
    setShowDatePicker(false);
  };

  const handleDateCancel = () => {
    setShowDatePicker(false);
  };

  const openDatePicker = () => {
    setShowDatePicker(true);
  };

  // Get or create animation value for a fridge
  const getAnimationValue = (fridgeName) => {
    if (!animationRefs.current[fridgeName]) {
      animationRefs.current[fridgeName] = new Animated.Value(0);
    }
    return animationRefs.current[fridgeName];
  };

  // Toggle fridge expansion with animation
  const toggleFridgeExpansion = (fridgeName) => {
    const isCurrentlyExpanded = expanded[fridgeName];
    const animationValue = getAnimationValue(fridgeName);
    
    setExpanded(prev => ({ ...prev, [fridgeName]: !isCurrentlyExpanded }));
    
    Animated.timing(animationValue, {
      toValue: isCurrentlyExpanded ? 0 : 1,
      duration: 250,
      useNativeDriver: false,
    }).start();
  };

  // Initialize input values when logs change
  useEffect(() => {
    const newInputValues = {};
    logs.forEach(log => {
      if (log.temps?.am !== undefined) {
        newInputValues[`${log.id}-am`] = log.temps.am;
      }
      if (log.temps?.pm !== undefined) {
        newInputValues[`${log.id}-pm`] = log.temps.pm;
      }
    });
    // Replace completely instead of merging to avoid stale values
    setInputValues(newInputValues);
  }, [logs]);

  // Clear input values when date changes
  useEffect(() => {
    setInputValues({});
  }, [selectedDate]);

  // Initialize animation values when fridges are loaded
  useEffect(() => {
    fridgeNames.forEach(fridgeName => {
      getAnimationValue(fridgeName);
    });
  }, [fridgeNames]);

  // Fetch data from Firestore
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchFridgeNames(), fetchLogs()]);
      setLoading(false);
      setRefreshing(false);
    };
    loadData();
  }, [restaurantId, selectedDate]);

  // Pull to refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchFridgeNames(), fetchLogs()]);
    setRefreshing(false);
  };

  // Get combined fridge data (from fridge names list and existing logs for selected date)
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
        // Create placeholder data for fridge without log on selected date
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

  // Utility function for individual temperature updates (if needed elsewhere)
  const handleSetTemp = async (fridgeName, logId, type, value) => {
    if (!fridgeName || !type || !restaurantId || !logId || logId === 'new') {
      return;
    }
    
    try {
      await updateDoc(getRestaurantDoc(restaurantId, "fridgelogs", logId), {
        [`temps.${type}`]: value,
      });
      
      // Update local state
      setLogs(prev =>
        prev.map(l =>
          l.id === logId ? { ...l, temps: { ...l.temps, [type]: value } } : l
        )
      );
    } catch (error) {
      console.error("Error updating temperature:", error);
    }
  };

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

  // Helper to format temperature (fridges are not freezers, so no "-" symbol)
  const formatTemperature = (temp) => {
    if (!temp || temp === "") return "--°C";
    const numTemp = parseFloat(temp);
    if (isNaN(numTemp)) return "--°C";
    
    // For fridges, just return the temperature as is (no "-" symbol)
    return `${temp}°C`;
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


  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backArrow}>‹</Text>
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.title}>Fridge Temperature</Text>
            <Text style={styles.subtitle}>Daily Temperature Logs</Text>
          </View>
          <View style={{ width: 28 }} />
        </View>

        {/* Date Selector */}
        <View style={styles.dateSection}>
          <TouchableOpacity
            style={styles.dateSelector}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.7}
          >
            <View style={styles.dateIconContainer}>
              <Ionicons name="calendar" size={22} color={Colors.primary} />
            </View>
            <View style={styles.dateContent}>
              <Text style={styles.dateLabel}>Selected Date</Text>
              <Text style={styles.dateText}>{todayString}</Text>
            </View>
            <View style={styles.chevronContainer}>
              <Ionicons name="chevron-forward" size={20} color={Colors.gray400} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Fridge List */}
        <View style={styles.fridgeSection}>
          <Text style={styles.sectionTitle}>
            Fridge Temperature Logs ({fridgeNames.length})
          </Text>
          
          {fridgeNames.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="thermometer-outline" size={48} color={Colors.gray300} />
              <Text style={styles.emptyStateText}>No fridges configured</Text>
              <Text style={styles.emptyStateSubtext}>Please add fridge names in admin panel</Text>
            </View>
          ) : (
            fridgeNames.map((fridgeName, index) => {
              const log = logs.find(l => l.fridge === fridgeName);
              const isExpanded = expanded[fridgeName];
              
              return (
                <TouchableOpacity 
                  key={index} 
                  style={styles.fridgeCard}
                  onPress={() => toggleFridgeExpansion(fridgeName)}
                  activeOpacity={0.8}
                >
                  {/* Fridge Header */}
                  <View style={styles.fridgeHeader}>
                    <View style={styles.fridgeInfo}>
                      <Ionicons name="thermometer-outline" size={24} color={Colors.primary} />
                      <Text style={styles.fridgeName}>{fridgeName}</Text>
                    </View>
                    <View style={styles.fridgeStatus}>
                      {log && (log.temps?.am || log.temps?.pm) ? (
                        <View style={styles.statusIndicator}>
                          <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                          <Text style={styles.statusText}>Logged</Text>
                        </View>
                      ) : (
                        <View style={styles.statusIndicator}>
                          <Ionicons name="alert-circle" size={20} color={Colors.warning} />
                          <Text style={styles.statusText}>Pending</Text>
                        </View>
                      )}
                      <Ionicons 
                        name={isExpanded ? "chevron-up" : "chevron-down"} 
                        size={20} 
                        color={Colors.gray400} 
                      />
                    </View>
                  </View>

                  {/* Expanded Temperature Inputs */}
                  <Animated.View 
                    style={[
                      styles.temperatureInputs,
                      {
                        height: getAnimationValue(fridgeName).interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, 320], // Universal height that works on all devices
                        }),
                        opacity: getAnimationValue(fridgeName),
                        overflow: 'hidden',
                      }
                    ]}
                    onStartShouldSetResponder={() => true}
                  >
                      {/* AM Temperature */}
                      <View style={styles.tempInputGroup}>
                        <Text style={styles.tempLabel}>AM Temperature</Text>
                        <View style={styles.tempInputContainer}>
                          <TextInput
                            style={styles.tempInput}
                            value={inputValues[`${log?.id || `placeholder-${fridgeName}`}-am`] !== undefined ? inputValues[`${log?.id || `placeholder-${fridgeName}`}-am`] : (log?.temps?.am || '')}
                            onChangeText={(value) => {
                              // Only allow numbers and decimal point
                              const numericValue = value.replace(/[^0-9.-]/g, '');
                              const inputKey = `${log?.id || `placeholder-${fridgeName}`}-am`;
                              console.log('AM input changed:', { value: numericValue, inputKey, logId: log?.id, fridgeName });
                              setInputValues(prev => ({ ...prev, [inputKey]: numericValue }));
                            }}
                            placeholder="0"
                            placeholderTextColor={Colors.gray400}
                            keyboardType="decimal-pad"
                            inputMode="decimal"
                          />
                          <Text style={styles.tempUnit}>°C</Text>
                        </View>
                      </View>

                      {/* PM Temperature */}
                      <View style={styles.tempInputGroup}>
                        <Text style={styles.tempLabel}>PM Temperature</Text>
                        <View style={styles.tempInputContainer}>
                          <TextInput
                            style={styles.tempInput}
                            value={inputValues[`${log?.id || `placeholder-${fridgeName}`}-pm`] !== undefined ? inputValues[`${log?.id || `placeholder-${fridgeName}`}-pm`] : (log?.temps?.pm || '')}
                            onChangeText={(value) => {
                              // Only allow numbers and decimal point
                              const numericValue = value.replace(/[^0-9.-]/g, '');
                              const inputKey = `${log?.id || `placeholder-${fridgeName}`}-pm`;
                              console.log('PM input changed:', { value: numericValue, inputKey, logId: log?.id, fridgeName });
                              setInputValues(prev => ({ ...prev, [inputKey]: numericValue }));
                            }}
                            placeholder="0"
                            placeholderTextColor={Colors.gray400}
                            keyboardType="decimal-pad"
                            inputMode="decimal"
                          />
                          <Text style={styles.tempUnit}>°C</Text>
                        </View>
                      </View>

                      {/* Save Button */}
                      <TouchableOpacity
                        style={styles.saveButton}
                        onPress={async (e) => {
                          e.stopPropagation();
                          const amValue = inputValues[`${log?.id || `placeholder-${fridgeName}`}-am`] || '';
                          const pmValue = inputValues[`${log?.id || `placeholder-${fridgeName}`}-pm`] || '';
                          
                          // Get original values for comparison
                          const originalAm = log?.temps?.am || '';
                          const originalPm = log?.temps?.pm || '';
                          
                          // Check if any values have actually changed
                          const amChanged = amValue !== originalAm;
                          const pmChanged = pmValue !== originalPm;
                          
                          // Allow saving if there are any changes OR if we're creating a new log
                          if (amChanged || pmChanged || !log?.id) {
                            try {
                              let currentLogId = log?.id;
                              
                              // If no existing log, create one first
                              if (!currentLogId) {
                                const selectedDateTimestamp = new Date(selectedDate);
                                selectedDateTimestamp.setHours(12, 0, 0, 0);
                                
                                const newLogRef = await addDoc(getRestaurantCollection(restaurantId, "fridgelogs"), {
                                  fridge: fridgeName,
                                  createdAt: selectedDateTimestamp,
                                  createdBy: auth.currentUser.uid,
                                  restaurantId: restaurantId,
                                  temps: { am: "", pm: "" },
                                });
                                
                                currentLogId = newLogRef.id;
                                
                                // Add the new log to local state
                                const newLog = {
                                  id: newLogRef.id,
                                  fridge: fridgeName,
                                  createdAt: selectedDateTimestamp,
                                  temps: { am: "", pm: "" },
                                  isPlaceholder: false,
                                };
                                
                                setLogs(prev => [...prev, newLog]);
                              }
                              
                              // Use handleSetTemp for each changed value
                              if (amChanged && currentLogId) {
                                await handleSetTemp(fridgeName, currentLogId, 'am', amValue);
                              }
                              
                              if (pmChanged && currentLogId) {
                                await handleSetTemp(fridgeName, currentLogId, 'pm', pmValue);
                              }
                              
                              // Clear input values
                              setInputValues(prev => {
                                const newValues = { ...prev };
                                const keyBase = currentLogId || `placeholder-${fridgeName}`;
                                delete newValues[`${keyBase}-am`];
                                delete newValues[`${keyBase}-pm`];
                                return newValues;
                              });
                            } catch (error) {
                              console.error("Error saving fridge log:", error);
                            }
                          }
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.saveButtonText}>Save Log</Text>
                      </TouchableOpacity>

                      {/* Current Values Display For Debuggine Purposes
                      {(log?.temps?.am || log?.temps?.pm) && (
                        <View style={styles.currentValues}>
                          <Text style={styles.currentValuesTitle}>Current Values:</Text>
                          <View style={styles.valuesRow}>
                            {log.temps?.am && (
                              <View style={styles.valueChip}>
                                <Text style={styles.valueChipLabel}>AM</Text>
                                <Text style={styles.valueChipTemp}>{log.temps.am}°C</Text>
                              </View>
                            )}
                            {log.temps?.pm && (
                              <View style={styles.valueChip}>
                                <Text style={styles.valueChipLabel}>PM</Text>
                                <Text style={styles.valueChipTemp}>{log.temps.pm}°C</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      )} */}
                  </Animated.View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Date Picker Modal */}
        <DateTimePickerModal
          isVisible={showDatePicker}
          mode="date"
          onConfirm={handleDateConfirm}
          onCancel={() => setShowDatePicker(false)}
          date={selectedDate}
          maximumDate={new Date()}
          themeVariant="light"
        />
      </ScrollView>
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
  titleContainer: { flex: 1 },
  title: {
    fontSize: 22,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
  },
  date: {
    fontSize: Typography.md,
    color: Colors.textPrimary,
    fontWeight: '500',
    marginTop: Spacing.xs,
  },

  calendarIcon: {
    marginLeft: Spacing.xs,
    color: Colors.primary,
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
    marginLeft: Spacing.sm,
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
  tempInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
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
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg + getAndroidTitleMargin(),
    paddingBottom: Spacing.md,
  },
  backButton: {
    padding: Spacing.xs,
  },
  backArrow: {
    fontSize: 35,
    color: Colors.textPrimary,
    fontWeight: "300",
  },
  headerInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  title: {
    fontSize: 24,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: Typography.md,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  dateSection: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  dateSelector: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  dateIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  dateContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  dateLabel: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontFamily: Typography.fontRegular,
    marginBottom: 2,
  },
  dateText: {
    fontSize: Typography.lg,
    color: Colors.textPrimary,
    fontFamily: Typography.fontBold,
  },
  chevronContainer: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  fridgeSection: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
    backgroundColor: Colors.gray100,
    borderRadius: 16,
    marginTop: Spacing.md,
  },
  emptyStateText: {
    fontSize: Typography.lg,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
    marginTop: Spacing.md,
  },
  emptyStateSubtext: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  fridgeCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  fridgeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fridgeInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  fridgeName: {
    fontFamily: Typography.fontBold,
    fontSize: 18,
    color: "#111",
    marginLeft: Spacing.sm,
  },
  fridgeStatus: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff3cd",
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: Spacing.sm,
  },
  statusText: {
    fontFamily: Typography.fontBold,
    fontSize: 14,
    color: "#856404",
    marginLeft: Spacing.xs,
  },
  temperatureInputs: {
    marginTop: 18,
    gap: 12,
  },
  tempInputGroup: {
    marginBottom: 12,
  },
  tempLabel: {
    fontFamily: Typography.fontRegular,
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  tempInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
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
  currentValues: {
    marginTop: 12,
    backgroundColor: Colors.gray100,
    borderRadius: 12,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  currentValuesTitle: {
    fontFamily: Typography.fontBold,
    fontSize: 16,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  valuesRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  valueChip: {
    alignItems: "center",
    backgroundColor: Colors.gray200,
    borderRadius: 20,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  valueChipLabel: {
    fontFamily: Typography.fontRegular,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  valueChipTemp: {
    fontFamily: Typography.fontBold,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: "center",
    marginTop: 18,
  },
  saveButtonText: {
    color: "white",
    fontFamily: Typography.fontBold,
    fontSize: 16,
  },
});
