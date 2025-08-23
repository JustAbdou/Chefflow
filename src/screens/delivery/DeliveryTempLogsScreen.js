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
import { Colors } from "../../constants/Colors";
import { Typography } from "../../constants/Typography";
import { Spacing } from "../../constants/Spacing";
import { getAndroidTitleMargin } from "../../utils/responsive";
import useNavigationBar from "../../hooks/useNavigationBar";
import { addDoc, getDocs, updateDoc, serverTimestamp, doc, getDoc, deleteDoc } from "firebase/firestore";
import { useRestaurant } from "../../contexts/RestaurantContext";
import { getRestaurantCollection, getRestaurantDoc } from "../../utils/firestoreHelpers";
import { auth } from "../../../firebase";
import DateTimePickerModal from "react-native-modal-datetime-picker";

export default function DeliveryTempLogsScreen({ navigation }) {
  const { restaurantId } = useRestaurant();
  const [suppliers, setSuppliers] = useState([]);
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

  // Fetch suppliers from Firestore
  const fetchSuppliers = async () => {
    if (!restaurantId) return;
    
    try {
      const suppliersDocRef = getRestaurantDoc(restaurantId, "suppliers", "suppliers");
      const suppliersDoc = await getDoc(suppliersDocRef);
      
      if (suppliersDoc.exists() && suppliersDoc.data().names) {
        setSuppliers(suppliersDoc.data().names);
      } else {
        setSuppliers([]);
      }
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      setSuppliers([]);
    }
  };

  // Reusable function to fetch logs
  const fetchLogs = async () => {
    if (!restaurantId) return;
    
    try {
      const deliveryLogsCollection = getRestaurantCollection(restaurantId, 'deliverylogs');
      const logsSnapshot = await getDocs(deliveryLogsCollection);
      
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
        const isInRange = logDate >= selectedDateStart && logDate <= selectedDateEnd;
        return isInRange;
      });
      
      // Sort by createdAt descending
      filteredLogs.sort((a, b) => {
        if (!a.createdAt || !b.createdAt) return 0;
        const dateA = a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt.seconds * 1000);
        const dateB = b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt.seconds * 1000);
        return dateB - dateA;
      });
      
      setLogs(filteredLogs);
    } catch (error) {
      console.error("Error fetching delivery logs:", error);
    }
  };

  // Initialize input values when logs change
  useEffect(() => {
    const newInputValues = {};
    logs.forEach(log => {
      if (log.temps?.frozen !== undefined) {
        newInputValues[`${log.id}-frozen`] = log.temps.frozen;
      }
      if (log.temps?.chilled !== undefined) {
        newInputValues[`${log.id}-chilled`] = log.temps.chilled;
      }
    });
    // Replace completely instead of merging to avoid stale values
    setInputValues(newInputValues);
  }, [logs]);

  // Clear input values when date changes
  useEffect(() => {
    setInputValues({});
  }, [selectedDate]);

  // Initialize animation values when suppliers are loaded
  useEffect(() => {
    suppliers.forEach(supplierName => {
      getAnimationValue(supplierName);
    });
  }, [suppliers]);

  // Fetch data from Firestore
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchSuppliers(), fetchLogs()]);
      setLoading(false);
      setRefreshing(false);
    };
    loadData();
  }, [restaurantId, selectedDate]);

  // Pull to refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchSuppliers(), fetchLogs()]);
    setRefreshing(false);
  };

  // Create or update delivery log for a supplier
  const handleCreateOrUpdateLog = async (supplierName) => {
    if (!restaurantId || !auth.currentUser) return null;
    
    try {
      // Check if a log already exists for this supplier today
      const existingLog = logs.find(log => log.supplier === supplierName);
      
      if (!existingLog) {
        // Create new log
        const selectedDateTimestamp = new Date(selectedDate);
        selectedDateTimestamp.setHours(12, 0, 0, 0);
        
        const newLogRef = await addDoc(getRestaurantCollection(restaurantId, "deliverylogs"), {
          supplier: supplierName,
          createdAt: selectedDateTimestamp,
          createdBy: auth.currentUser.uid,
          restaurantId: restaurantId,
          temps: { frozen: "", chilled: "" },
        });
        
        // Add the new log to local state immediately
        const newLog = {
          id: newLogRef.id,
          supplier: supplierName,
          createdAt: selectedDateTimestamp,
          temps: { frozen: "", chilled: "" },
          isPlaceholder: false,
        };
        
        setLogs(prev => [...prev, newLog]);
        
        return newLogRef.id; // Return the new log ID
      }
      
      return existingLog.id; // Return existing log ID
    } catch (error) {
      console.error("Error creating delivery log:", error);
      return null;
    }
  };

  // Get combined supplier data (from suppliers list and existing logs)
  const getCombinedSupplierData = () => {
    const supplierData = [];
    
    // Add all suppliers from the suppliers list
    suppliers.forEach(supplierName => {
      const existingLog = logs.find(log => log.supplier === supplierName);
      
      if (existingLog) {
        // Use existing log data
        supplierData.push(existingLog);
      } else {
        // Create placeholder data for supplier without log
        supplierData.push({
          id: `placeholder-${supplierName}`,
          supplier: supplierName,
          createdAt: null,
          temps: { frozen: "", chilled: "" },
          isPlaceholder: true,
        });
      }
    });
    
    return supplierData;
  };

  // Utility function for individual temperature updates (if needed elsewhere)
  const handleSetTemp = async (supplierName, logId, type, value) => {
    if (!supplierName || !type || !restaurantId || !logId || logId === 'new') {
      return;
    }
    
    try {
      await updateDoc(getRestaurantDoc(restaurantId, "deliverylogs", logId), {
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

  // Delete individual supplier log
  const deleteSupplierLog = async (logId) => {
    if (!restaurantId) return;
    
    try {
      await deleteDoc(getRestaurantDoc(restaurantId, "deliverylogs", logId));
      setLogs((logs) => logs.filter((log) => log.id !== logId));
    } catch (error) {
      console.error("Error deleting delivery log:", error);
    }
  };

  // Render right action for swipe-to-delete
  const renderRightActions = (logId) => (
    <View style={styles.swipeActionContainer}>
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={() => deleteSupplierLog(logId)}
        activeOpacity={0.8}
      >
        <Ionicons name="trash-outline" size={24} color="white" />
        <Text style={styles.deleteActionText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  const handleDateConfirm = (date) => {
    setSelectedDate(date);
    setShowDatePicker(false);
  };

  // Get or create animation value for a supplier
  const getAnimationValue = (supplierName) => {
    if (!animationRefs.current[supplierName]) {
      animationRefs.current[supplierName] = new Animated.Value(0);
    }
    return animationRefs.current[supplierName];
  };

  // Toggle supplier expansion with animation
  const toggleSupplierExpansion = (supplierName) => {
    const isCurrentlyExpanded = expanded[supplierName];
    const animationValue = getAnimationValue(supplierName);
    
    setExpanded(prev => ({ ...prev, [supplierName]: !isCurrentlyExpanded }));
    
    Animated.timing(animationValue, {
      toValue: isCurrentlyExpanded ? 0 : 1,
      duration: 250,
      useNativeDriver: false,
    }).start();
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
            <Text style={styles.title}>Delivery Temperature</Text>
            <Text style={styles.subtitle}>Monitor Delivery Temps</Text>
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

        {/* Suppliers List */}
        <View style={styles.suppliersSection}>
          <Text style={styles.sectionTitle}>
            Delivery Temperature Logs ({suppliers.length})
          </Text>
          
          {suppliers.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="thermometer-outline" size={48} color={Colors.gray300} />
              <Text style={styles.emptyStateText}>No suppliers configured</Text>
              <Text style={styles.emptyStateSubtext}>Please add supplier names in settings</Text>
            </View>
          ) : (
            suppliers.map((supplierName, index) => {
              const log = logs.find(l => l.supplier === supplierName);
              const isExpanded = expanded[supplierName];
              
              return (
                <TouchableOpacity 
                  key={index} 
                  style={styles.supplierCard}
                  onPress={() => toggleSupplierExpansion(supplierName)}
                  activeOpacity={0.8}
                >
                  {/* Supplier Header */}
                  <View style={styles.supplierHeader}>
                    <View style={styles.supplierInfo}>
                                                  <Ionicons name="car-outline" size={24} color={Colors.primary} />
                      <Text style={styles.supplierName}>{supplierName}</Text>
                    </View>
                    <View style={styles.supplierStatus}>
                      {log && log.temps && (log.temps.frozen || log.temps.chilled) ? (
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
                        height: getAnimationValue(supplierName).interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, 380], // Height for delivery temp inputs with current values
                        }),
                        opacity: getAnimationValue(supplierName),
                        overflow: 'hidden',
                      }
                    ]}
                    onStartShouldSetResponder={() => true}
                  >
                      {/* Frozen Items Temperature */}
                      <View style={styles.tempInputGroup}>
                        <Text style={styles.tempLabel}>Frozen Items Temperature</Text>
                        <View style={styles.tempInputContainer}>
                          <TextInput
                            style={styles.tempInput}
                            value={inputValues[`${log?.id || `placeholder-${supplierName}`}-frozen`] !== undefined ? inputValues[`${log?.id || `placeholder-${supplierName}`}-frozen`] : (log?.temps?.frozen || '')}
                            onChangeText={(value) => {
                              // Only allow numbers, decimal point, and negative sign
                              const numericValue = value.replace(/[^0-9.-]/g, '');
                              const inputKey = `${log?.id || `placeholder-${supplierName}`}-frozen`;
                              console.log('Frozen input changed:', { value: numericValue, inputKey, logId: log?.id, supplierName });
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

                      {/* Chilled Items Temperature */}
                      <View style={styles.tempInputGroup}>
                        <Text style={styles.tempLabel}>Chilled Items Temperature</Text>
                        <View style={styles.tempInputContainer}>
                          <TextInput
                            style={styles.tempInput}
                            value={inputValues[`${log?.id || `placeholder-${supplierName}`}-chilled`] !== undefined ? inputValues[`${log?.id || `placeholder-${supplierName}`}-chilled`] : (log?.temps?.chilled || '')}
                            onChangeText={(value) => {
                              // Only allow numbers, decimal point, and negative sign
                              const numericValue = value.replace(/[^0-9.-]/g, '');
                              const inputKey = `${log?.id || `placeholder-${supplierName}`}-chilled`;
                              console.log('Chilled input changed:', { value: numericValue, inputKey, logId: log?.id, supplierName });
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
                          const frozenValue = inputValues[`${log?.id || `placeholder-${supplierName}`}-frozen`] || '';
                          const chilledValue = inputValues[`${log?.id || `placeholder-${supplierName}`}-chilled`] || '';
                          
                          // Get original values for comparison
                          const originalFrozen = log?.temps?.frozen || '';
                          const originalChilled = log?.temps?.chilled || '';
                          
                          // Check if any values have actually changed
                          const frozenChanged = frozenValue !== originalFrozen;
                          const chilledChanged = chilledValue !== originalChilled;
                          
                          // Allow saving if there are any changes OR if we're creating a new log
                          if (frozenChanged || chilledChanged || !log?.id) {
                            try {
                              let currentLogId = log?.id;
                              
                              // If no existing log, create one first
                              if (!currentLogId) {
                                currentLogId = await handleCreateOrUpdateLog(supplierName);
                              }
                              
                              // Update both values in a single operation to avoid race conditions
                              const updateData = {};
                              if (frozenChanged) {
                                const processedFrozenValue = frozenValue !== '' ? (frozenValue.startsWith('-') ? frozenValue : `-${frozenValue}`) : '';
                                updateData['temps.frozen'] = processedFrozenValue;
                              }
                              if (chilledChanged) {
                                updateData['temps.chilled'] = chilledValue;
                              }
                              
                              if (Object.keys(updateData).length > 0 && currentLogId) {
                                await updateDoc(getRestaurantDoc(restaurantId, "deliverylogs", currentLogId), updateData);
                                
                                // Update local state
                                setLogs(prev =>
                                  prev.map(l =>
                                    l.id === currentLogId ? { 
                                      ...l, 
                                      temps: { 
                                        ...l.temps, 
                                        ...(frozenChanged ? { frozen: frozenValue !== '' ? (frozenValue.startsWith('-') ? frozenValue : `-${frozenValue}`) : '' } : {}),
                                        ...(chilledChanged ? { chilled: chilledValue !== '' ? chilledValue : '' } : {})
                                      } 
                                    } : l
                                  )
                                );
                              }
                              
                              // Clear input values
                              setInputValues(prev => {
                                const newValues = { ...prev };
                                const keyBase = currentLogId || `placeholder-${supplierName}`;
                                delete newValues[`${keyBase}-frozen`];
                                delete newValues[`${keyBase}-chilled`];
                                return newValues;
                              });
                            } catch (error) {
                              console.error("Error saving delivery log:", error);
                            }
                          }
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.saveButtonText}>Save Log</Text>
                      </TouchableOpacity>

                      {/* Current Values Display */}
                      {(log?.temps?.frozen || log?.temps?.chilled) && (
                        <View style={styles.currentValues}>
                          <Text style={styles.currentValuesTitle}>Current Values:</Text>
                          <View style={styles.valuesRow}>
                            {log.temps?.frozen && (
                              <View style={styles.valueChip}>
                                <Text style={styles.valueChipLabel}>Frozen</Text>
                                <Text style={styles.valueChipTemp}>-{log.temps.frozen}°C</Text>
                              </View>
                            )}
                            {log.temps?.chilled && (
                              <View style={styles.valueChip}>
                                <Text style={styles.valueChipLabel}>Chilled</Text>
                                <Text style={styles.valueChipTemp}>{log.temps.chilled}°C</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      )}
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
  container: { flex: 1, backgroundColor: "#fff" },
  scrollView: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    paddingTop: Spacing.lg + getAndroidTitleMargin(),
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
    fontSize: 22,
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
  suppliersSection: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 22,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  supplierCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  supplierHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  supplierInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  supplierName: {
    fontFamily: Typography.fontBold,
    fontSize: 18,
    color: "#111",
    marginLeft: Spacing.sm,
  },
  supplierStatus: {
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
    color: "#8B96A5",
    marginBottom: 2,
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
    marginTop: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  currentValuesTitle: {
    fontFamily: Typography.fontBold,
    fontSize: 16,
    color: "#222",
    marginBottom: 8,
  },
  valuesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  valueChip: {
    backgroundColor: "#e0f2fe",
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  valueChipLabel: {
    fontFamily: Typography.fontBold,
    fontSize: 14,
    color: "#111",
  },
  valueChipTemp: {
    fontFamily: Typography.fontBold,
    fontSize: 14,
    color: "#2563eb",
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
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    backgroundColor: "#f0f2f5",
    borderRadius: 16,
    marginTop: 12,
  },
  emptyStateText: {
    fontFamily: Typography.fontBold,
    fontSize: 20,
    color: "#222",
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontFamily: Typography.fontRegular,
    fontSize: 16,
    color: "#8B96A5",
    marginTop: 4,
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
