import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from "react-native";
import { Ionicons, Feather } from "@expo/vector-icons";
import { getDocs, addDoc, serverTimestamp, doc, getDoc, updateDoc, query, where, Timestamp, orderBy } from "firebase/firestore";
import { useRestaurant } from "../../contexts/RestaurantContext";
import { getRestaurantCollection, getRestaurantDoc } from "../../utils/firestoreHelpers";
import { auth } from "../../../firebase";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { 
  getCachedFridgeLogs, 
  cacheFridgeLogsOffline,
  addFridgeLogOffline
} from "../../utils/offlineSync";
import { addNetworkListener, getNetworkStatus } from '../../utils/networkMonitor';

import { Colors } from "../../constants/Colors";
import { Typography } from "../../constants/Typography";
import { Spacing } from "../../constants/Spacing";
import { getAndroidTitleMargin } from "../../utils/responsive";
import useNavigationBar from "../../hooks/useNavigationBar";

export default function FridgeTempLogsScreen({ navigation }) {
  const { restaurantId } = useRestaurant();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedCards, setExpandedCards] = useState(new Set());
  const [tempInputs, setTempInputs] = useState({});
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [isLoadingFromCache, setIsLoadingFromCache] = useState(false);

  // Hide Android navigation bar
  const navigationBar = useNavigationBar();
  navigationBar.useHidden(); // Use hidden mode for complete immersion
  const [refreshing, setRefreshing] = useState(false);

  // Monitor network status
  useEffect(() => {
    if (!restaurantId) return;

    // Set initial network status
    setIsOffline(!getNetworkStatus());

    // Add network listener
    const removeNetworkListener = addNetworkListener((isOnline) => {
      setIsOffline(!isOnline);
      console.log(`🌐 Fridge logs network status updated: ${isOnline ? 'Online' : 'Offline'}`);
    });

    return removeNetworkListener;
  }, [restaurantId]);

  // Fetch logs from fridgelogs collection with date filter
  const fetchLogs = async () => {
    if (!restaurantId) return;
    
    try {
      // Try to load from cache first for instant display
      setIsLoadingFromCache(true);
      const cachedLogs = await getCachedFridgeLogs();
      if (cachedLogs && cachedLogs.length > 0) {
        console.log(`📱 Loaded ${cachedLogs.length} fridge logs from cache`);
        setLogs(cachedLogs);
        setIsLoadingFromCache(false);
        
        // Initialize temp inputs with cached values
        const initialInputs = {};
        cachedLogs.forEach(log => {
          initialInputs[`${log.id}_AM`] = log.temperatureAM || '';
          initialInputs[`${log.id}_PM`] = log.temperaturePM || '';
        });
        setTempInputs(initialInputs);
      } else {
        setIsLoadingFromCache(false);
      }
      
      // If offline, only show cached data
      if (isOffline) {
        console.log('� Offline mode: showing cached fridge logs only');
        return;
      }
      
      console.log('�🔍 Fetching fridge logs for restaurant:', restaurantId);
      
      // Create date range for the selected date (start and end of day)
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      // Get existing logs from fridgelogs collection
      const fridgeLogsCollection = getRestaurantCollection(restaurantId, 'fridgelogs');
      const allLogsSnapshot = await getDocs(fridgeLogsCollection);
      
      let logsForDate = [];
      
      allLogsSnapshot.forEach(docSnap => {
        const data = docSnap.data();
        const logDate = data.createdAt;
        
        // Include logs for the selected date OR legacy logs without createdAt
        if (!logDate) {
          // Legacy log without createdAt - include for all dates
          logsForDate.push({
            id: docSnap.id,
            fridgeName: data.fridgeName || data.name || 'Unknown Fridge',
            fridgeId: data.fridgeId || docSnap.id,
            temperatureAM: data.temperatureAM || '',
            temperaturePM: data.temperaturePM || '',
            createdAt: data.createdAt,
            done: data.done || false,
            isNew: false,
            fridgeType: data.fridgeType || 'fridge'
          });
        } else {
          // Safely handle date conversion
          try {
            let logDateTime;
            if (typeof logDate.toDate === 'function') {
              logDateTime = logDate.toDate();
            } else if (logDate instanceof Date) {
              logDateTime = logDate;
            } else {
              logDateTime = new Date(logDate);
            }
            
            // Validate the date and check if it's in range
            if (!isNaN(logDateTime.getTime()) && logDateTime >= startOfDay && logDateTime <= endOfDay) {
              // Log within the selected date range
              logsForDate.push({
                id: docSnap.id,
                fridgeName: data.fridgeName || data.name || 'Unknown Fridge',
                fridgeId: data.fridgeId || docSnap.id,
                temperatureAM: data.temperatureAM || '',
                temperaturePM: data.temperaturePM || '',
                createdAt: data.createdAt,
                done: data.done || false,
                isNew: false,
                fridgeType: data.fridgeType || 'fridge'
              });
            }
          } catch (error) {
            console.warn('Error parsing date for fridge log:', docSnap.id, error);
            // Include log anyway for backward compatibility
            logsForDate.push({
              id: docSnap.id,
              fridgeName: data.fridgeName || data.name || 'Unknown Fridge',
              fridgeId: data.fridgeId || docSnap.id,
              temperatureAM: data.temperatureAM || '',
              temperaturePM: data.temperaturePM || '',
              createdAt: data.createdAt,
              done: data.done || false,
              isNew: false,
              fridgeType: data.fridgeType || 'fridge'
            });
          }
        }
      });
      
      // Remove empty/duplicate entries when there are actual temperature logs
      const filteredLogsForDate = [];
      const fridgeNameTracker = new Map(); // Track which fridges have actual temperature data
      
      // First pass: identify fridges with actual temperature data
      logsForDate.forEach(log => {
        const hasActualData = (log.temperatureAM && log.temperatureAM.trim() !== '') || 
                             (log.temperaturePM && log.temperaturePM.trim() !== '') ||
                             log.done === true;
        
        if (hasActualData) {
          const fridgeKey = log.fridgeName.toLowerCase();
          if (!fridgeNameTracker.has(fridgeKey) || 
              fridgeNameTracker.get(fridgeKey).priority < 2) {
            fridgeNameTracker.set(fridgeKey, { log, priority: 2 }); // Priority 2 for logs with data
          }
        }
      });
      
      // Second pass: add empty logs only if no actual data exists for that fridge
      logsForDate.forEach(log => {
        const fridgeKey = log.fridgeName.toLowerCase();
        const hasActualData = (log.temperatureAM && log.temperatureAM.trim() !== '') || 
                             (log.temperaturePM && log.temperaturePM.trim() !== '') ||
                             log.done === true;
        
        if (!hasActualData && !fridgeNameTracker.has(fridgeKey)) {
          fridgeNameTracker.set(fridgeKey, { log, priority: 1 }); // Priority 1 for empty logs
        }
      });
      
      // Extract the final filtered logs and sort them
      fridgeNameTracker.forEach(({ log }) => {
        filteredLogsForDate.push(log);
      });
      
      // Sort logs by fridgeName for consistent display
      filteredLogsForDate.sort((a, b) => {
        const nameA = a.fridgeName.toLowerCase();
        const nameB = b.fridgeName.toLowerCase();
        return nameA.localeCompare(nameB);
      });
      
      console.log(`✅ Fetched ${logsForDate.length} raw fridge logs, filtered to ${filteredLogsForDate.length} for ${selectedDate.toDateString()}`);
      console.log('📋 Logs to display:', filteredLogsForDate.map(log => ({ name: log.fridgeName, id: log.id, hasData: (log.temperatureAM || log.temperaturePM || log.done) })));
      setLogs(filteredLogsForDate);
      
      // Cache the fetched logs
      await cacheFridgeLogsOffline(logsForDate);
      
      // Initialize temp inputs with current values
      const initialInputs = {};
      filteredLogsForDate.forEach(log => {
        initialInputs[`${log.id}_AM`] = log.temperatureAM || '';
        initialInputs[`${log.id}_PM`] = log.temperaturePM || '';
      });
      setTempInputs(initialInputs);
    } catch (error) {
      console.error('❌ Error fetching fridge logs:', error);
      
      // On error, try to load from cache
      const cachedLogs = await getCachedFridgeLogs();
      if (cachedLogs && cachedLogs.length > 0) {
        console.log('📱 Fallback to cached fridge logs after error');
        setLogs(cachedLogs);
      } else {
        setLogs([]);
      }
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      await fetchLogs();
      setLoading(false);
    };
    
    loadInitialData();
  }, [restaurantId, selectedDate]); // Add selectedDate as dependency

  // Handle pull-to-refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchLogs();
    setRefreshing(false);
  };

  // Helper for time display
  const formatTime = (createdAt) => {
    if (!createdAt) return "New Entry";
    
    try {
      let date;
      if (typeof createdAt.toDate === 'function') {
        date = createdAt.toDate();
      } else if (createdAt instanceof Date) {
        date = createdAt;
      } else if (createdAt.seconds) {
        date = new Date(createdAt.seconds * 1000);
      } else {
        date = new Date(createdAt);
      }
      
      // Validate the date
      if (isNaN(date.getTime())) {
        return "Invalid Date";
      }
      
      let hours = date.getHours();
      let minutes = date.getMinutes();
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12 || 12;
      return `${hours}:${minutes.toString().padStart(2, "0")} ${ampm}`;
    } catch (error) {
      console.warn('Error formatting time:', error);
      return "Invalid Time";
    }
  };

  // Helper to check if fridge has been logged
  const isLogged = (log) => {
    return (log.temperatureAM && log.temperatureAM.trim() !== '') || 
           (log.temperaturePM && log.temperaturePM.trim() !== '') ||
           log.done === true;
  };

  const getPeriodStatus = (log, period) => {
    const key = period === 'AM' ? 'temperatureAM' : 'temperaturePM';
    const savedValue = (log[key] || '').toString().trim();
    const inputValue = (tempInputs[`${log.id}_${period}`] || '').toString().trim();

    const hasSavedValue = savedValue !== '';
    const hasUnsavedInput = inputValue !== '' && inputValue !== savedValue;

    if (hasSavedValue) {
      return {
        text: `${period} logged`,
        color: '#059669',
        icon: 'checkmark-circle',
      };
    }

    if (hasUnsavedInput) {
      return {
        text: `${period} pending`,
        color: '#dc2626',
        icon: 'alert-circle',
      };
    }

    return {
      text: `${period} pending`,
      color: '#6b7280',
      icon: 'time-outline',
    };
  };

  // Toggle card expansion
  const toggleCardExpansion = (logId) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  // Handle temperature input change with automatic negative sign for freezers
  const handleTempInputChange = (logId, period, value) => {
    const key = `${logId}_${period}`;

    // Find the fridge type for this log
    const fridgeLog = logs.find(log => log.id === logId);
    const fridgeType = fridgeLog?.fridgeType || 'fridge';

    // Debug logging
    console.log(`🌡️ Temperature input for ${logId} (${period}): value="${value}", fridgeType="${fridgeType}"`);

    // Process the input value
    let processedValue = value;

    if (fridgeType === 'freezer') {
      // For freezers, ensure the value is always negative
      // Remove any existing negative signs first
      processedValue = value.replace(/^-+/, '');

      // Only add negative sign if there's actual numeric content
      if (processedValue && processedValue.trim() !== '' && !isNaN(parseFloat(processedValue))) {
        processedValue = '-' + processedValue;
        console.log(`❄️ Freezer temp processed: "${value}" → "${processedValue}"`);
      } else if (processedValue && processedValue.trim() !== '') {
        // If user is still typing (like just "." or partial number), add the negative sign
        processedValue = '-' + processedValue;
        console.log(`❄️ Freezer temp (partial): "${value}" → "${processedValue}"`);
      }
    }

    setTempInputs(prev => ({
      ...prev,
      [key]: processedValue
    }));
  };

  // Save temperature for a specific period
  const saveCompleteLog = async (logId) => {
    if (!restaurantId || !auth.currentUser) {
      console.error('❌ Missing restaurant ID or user authentication');
      return;
    }

    const amTempValue = tempInputs[`${logId}_AM`];
    const pmTempValue = tempInputs[`${logId}_PM`];

    // Validate that at least one temperature is provided
    if ((!amTempValue || amTempValue.trim() === '') && (!pmTempValue || pmTempValue.trim() === '')) {
      console.error('❌ At least one temperature value must be provided');
      return;
    }

    // Validate temperature values if they are provided
    if (amTempValue && amTempValue.trim() !== '') {
      const amTempNumber = parseFloat(amTempValue);
      if (isNaN(amTempNumber)) {
        console.error('❌ Invalid AM temperature value:', amTempValue);
        return;
      }
    }

    if (pmTempValue && pmTempValue.trim() !== '') {
      const pmTempNumber = parseFloat(pmTempValue);
      if (isNaN(pmTempNumber)) {
        console.error('❌ Invalid PM temperature value:', pmTempValue);
        return;
      }
    }

    try {
      console.log(`📝 Saving complete log for ${logId}:`, { AM: amTempValue, PM: pmTempValue });
      
      const fridgeDoc = logs.find(log => log.id === logId);
      if (!fridgeDoc) {
        console.error('❌ Fridge document not found:', logId);
        return;
      }

      // Check if this log already has saved data that we need to preserve
      const existingAM = fridgeDoc.temperatureAM || '';
      const existingPM = fridgeDoc.temperaturePM || '';

      // Prepare data for saving - preserve existing values if not updating
      const saveData = {
        fridgeName: fridgeDoc.fridgeName,
        fridgeId: fridgeDoc.fridgeId,
        fridgeType: fridgeDoc.fridgeType || 'fridge',
        done: true,
        createdAt: Timestamp.fromDate(selectedDate), // Use selected date
        loggedBy: {
          userId: auth.currentUser.uid,
          email: auth.currentUser.email
        }
      };

      // Preserve existing values and only update what's being changed
      saveData.temperatureAM = (amTempValue && amTempValue.trim() !== '') ? amTempValue.trim() : existingAM;
      saveData.temperaturePM = (pmTempValue && pmTempValue.trim() !== '') ? pmTempValue.trim() : existingPM;

      console.log(`📝 Preserving existing temps - AM: "${existingAM}" → "${saveData.temperatureAM}", PM: "${existingPM}" → "${saveData.temperaturePM}"`);

      // Use offline-capable function
      if (isOffline) {
        console.log('📱 Offline mode: adding fridge log to pending queue');
        await addFridgeLogOffline(restaurantId, saveData);

        // Update local state immediately for instant feedback
        const updatedLogs = logs.map(log =>
          log.id === logId
            ? { ...log, temperatureAM: saveData.temperatureAM, temperaturePM: saveData.temperaturePM, done: true, isOffline: true }
            : log
        );
        setLogs(updatedLogs);
        await cacheFridgeLogsOffline(updatedLogs);
      } else {
        // Online: Check if a log already exists for this fridge and date
        const fridgeLogsCollection = getRestaurantCollection(restaurantId, 'fridgelogs');

        // Simple approach: get all logs and filter in JavaScript to avoid Firestore query limitations
        const allLogsSnapshot = await getDocs(fridgeLogsCollection);

        // Look for existing log for this fridge on this date
        const startOfDay = new Date(selectedDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(selectedDate);
        endOfDay.setHours(23, 59, 59, 999);

        let existingLogDoc = null;
        let existingData = null;

        // Find matching log by filtering in JavaScript
        for (const docSnap of allLogsSnapshot.docs) {
          const data = docSnap.data();
          const logDate = data.createdAt;

          // Check if this is the same fridge
          if (data.fridgeName === fridgeDoc.fridgeName && logDate) {
            try {
              let logDateTime;
              if (typeof logDate.toDate === 'function') {
                logDateTime = logDate.toDate();
              } else if (logDate instanceof Date) {
                logDateTime = logDate;
              } else {
                logDateTime = new Date(logDate);
              }

              // Check if it's the same date
              if (!isNaN(logDateTime.getTime()) && logDateTime >= startOfDay && logDateTime <= endOfDay) {
                existingLogDoc = docSnap;
                existingData = data;
                break;
              }
            } catch (error) {
              console.warn('Error parsing date for existing log:', docSnap.id, error);
            }
          }
        }

        if (existingLogDoc && existingData) {
          // Update existing log
          const updateData = {
            ...saveData,
            temperatureAM: (amTempValue && amTempValue.trim() !== '') ? amTempValue.trim() : (existingData.temperatureAM || ''),
            temperaturePM: (pmTempValue && pmTempValue.trim() !== '') ? pmTempValue.trim() : (existingData.temperaturePM || ''),
            recordedAt: serverTimestamp()
          };

          await updateDoc(doc(fridgeLogsCollection, existingLogDoc.id), updateData);
          console.log('✅ Updated existing fridge log successfully');
        } else {
          // Create new log
          saveData.recordedAt = serverTimestamp();
          await addDoc(fridgeLogsCollection, saveData);
          console.log('✅ New fridge log created successfully');
        }

        // Refresh logs
        await fetchLogs();
      }
    } catch (error) {
      console.error('❌ Error saving complete log:', error);
    }
  };

  // Filter logs - show all logs for now
  const filteredLogs = logs;

  // Format the selected date
  const formatSelectedDate = (date) => {
    const dayName = date.toLocaleDateString(undefined, { weekday: "long" });
    const monthName = date.toLocaleDateString(undefined, { month: "long" });
    const dayNum = date.getDate();
    return `${dayName}, ${monthName} ${dayNum}`;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      >


        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Text style={styles.backArrow}>‹</Text>
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Fridge Temperature</Text>
              {isOffline && (
                <View style={styles.offlineIndicator}>
                  <Ionicons name="cloud-offline-outline" size={16} color="#dc2626" />
                  <Text style={styles.offlineText}>Offline</Text>
                </View>
              )}
            </View>
            <Text style={styles.subtitle}>Daily Temperature Logs</Text>
          </View>
        </View>

        {/* Date Selector */}
        <TouchableOpacity style={styles.dateSelector} onPress={() => setShowDatePicker(true)}>
          <View style={styles.dateLeft}>
            <Ionicons name="calendar-outline" size={24} color="#2563eb" />
            <View style={styles.dateInfo}>
              <Text style={styles.dateLabel}>Selected Date</Text>
              <Text style={styles.dateValue}>{formatSelectedDate(selectedDate)}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#6B7280" />
        </TouchableOpacity>

        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Fridge Temperature Logs ({filteredLogs.length})</Text>
        </View>

        {/* Logs */}
        <View style={styles.logsContainer}>
          {loading ? (
            <ActivityIndicator size="large" style={{ marginTop: 40 }} />
          ) : (
            filteredLogs.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="thermometer-outline" size={48} color="#CBD5E1" />
                <Text style={styles.emptyText}>No fridges configured</Text>
                <Text style={styles.emptySubtext}>Configure fridges in restaurant settings to start logging temperatures</Text>
              </View>
            ) : (
              filteredLogs.map((log, idx) => {
                const isExpanded = expandedCards.has(log.id);
                return (
                  <View key={log.id} style={styles.logCard}>
                    <TouchableOpacity 
                      style={styles.logContent} 
                      onPress={() => toggleCardExpansion(log.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.logIcon}>
                        {log.fridgeType === 'fridge' ? (
                          <Ionicons name="thermometer" size={24} color="#2563eb" />
                        ) : (
                          <Ionicons name="snow" size={24} color="#2563eb" />
                        )}
                      </View>
                      <View style={styles.logInfo}>
                        <Text style={styles.logName}>{log.fridgeName || log.id}</Text>
                        <Text style={styles.logTime}>
                          {log.createdAt ? formatTime(log.createdAt) : 'No time set'}
                        </Text>
                      </View>
                      <View style={styles.logStatus}>
                        <View style={styles.periodStatusContainer}>
                          {['AM', 'PM'].map((period) => {
                            const periodStatus = getPeriodStatus(log, period);
                            const isLast = period === 'PM';
                            return (
                              <View
                                key={`${log.id}_${period}`}
                                style={[
                                  styles.periodBadge,
                                  { backgroundColor: `${periodStatus.color}20` },
                                  !isLast && styles.periodBadgeSpacing,
                                ]}
                              >
                                <Ionicons
                                  name={periodStatus.icon}
                                  size={14}
                                  color={periodStatus.color}
                                />
                                <Text
                                  style={[
                                    styles.periodBadgeText,
                                    { color: periodStatus.color },
                                  ]}
                                >
                                  {periodStatus.text}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                        <Ionicons 
                          name={isExpanded ? "chevron-up" : "chevron-down"} 
                          size={20} 
                          color="#6B7280" 
                        />
                      </View>
                    </TouchableOpacity>
                    
                    {isExpanded && (
                      <View style={styles.temperatureInfo}>
                        {/* AM Temperature Input */}
                        <View style={styles.tempInputRow}>
                          <Text style={styles.temperatureLabel}>
                            AM Temperature{log.fridgeType === 'freezer' ? ' (Freezer)' : ''}:
                          </Text>
                          <View style={styles.tempInputContainer}>
                            <TextInput
                              style={styles.tempInput}
                              value={tempInputs[`${log.id}_AM`] || ''}
                              onChangeText={(value) => handleTempInputChange(log.id, 'AM', value)}
                              placeholder="--"
                              placeholderTextColor="#9CA3AF"
                              keyboardType="numeric"
                              maxLength={6}
                            />
                            <Text style={styles.tempUnit}>℃</Text>
                          </View>
                        </View>

                        {/* PM Temperature Input */}
                        <View style={styles.tempInputRow}>
                          <Text style={styles.temperatureLabel}>
                            PM Temperature{log.fridgeType === 'freezer' ? ' (Freezer)' : ''}:
                          </Text>
                          <View style={styles.tempInputContainer}>
                            <TextInput
                              style={styles.tempInput}
                              value={tempInputs[`${log.id}_PM`] || ''}
                              onChangeText={(value) => handleTempInputChange(log.id, 'PM', value)}
                              placeholder="--"
                              placeholderTextColor="#9CA3AF"
                              keyboardType="numeric"
                              maxLength={6}
                            />
                            <Text style={styles.tempUnit}>℃</Text>
                          </View>
                        </View>

                        {/* Save Log Button */}
                        <TouchableOpacity
                          style={styles.saveLogButton}
                          onPress={() => saveCompleteLog(log.id)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="save-outline" size={20} color="#fff" />
                          <Text style={styles.saveLogButtonText}>Save Log</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })
            )
          )}
        </View>
      </ScrollView>

      {/* Date Picker Modal */}
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
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg + getAndroidTitleMargin(),
    paddingBottom: Spacing.md,
  },
  backButton: {
    padding: Spacing.xs,
    marginRight: Spacing.md,
  },
  backArrow: {
    fontSize: 32,
    color: Colors.textPrimary,
    fontWeight: "300",
  },
  headerContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  title: {
    fontSize: 24,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
    flex: 1,
  },
  offlineIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fca5a5",
  },
  offlineText: {
    fontSize: 12,
    fontFamily: Typography.fontMedium,
    color: "#dc2626",
    marginLeft: 4,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: Typography.fontRegular,
    color: Colors.textSecondary,
  },
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
  dateLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  dateInfo: {
    marginLeft: Spacing.md,
  },
  dateLabel: {
    fontSize: 14,
    fontFamily: Typography.fontRegular,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  dateValue: {
    fontSize: 16,
    fontFamily: Typography.fontSemiBold,
    color: Colors.textPrimary,
  },
  sectionHeader: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: Typography.fontSemiBold,
    color: Colors.textPrimary,
  },
  logsContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 100,
  },
  logCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  logContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
  },
  logIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  logInfo: {
    flex: 1,
  },
  logName: {
    fontSize: 16,
    fontFamily: Typography.fontSemiBold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  logTime: {
    fontSize: 14,
    fontFamily: Typography.fontRegular,
    color: Colors.textSecondary,
  },
  logStatus: {
    alignItems: "flex-end",
  },
  periodStatusContainer: {
    flexDirection: "column",
    alignItems: "flex-end",
    marginBottom: 4,
  },
  periodBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  periodBadgeSpacing: {
    marginBottom: 4,
  },
  periodBadgeText: {
    fontSize: 12,
    fontFamily: Typography.fontMedium,
    marginLeft: 4,
  },
  temperatureInfo: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    backgroundColor: "#f8fafc",
  },
  tempInputRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  temperatureLabel: {
    fontSize: 14,
    fontFamily: Typography.fontMedium,
    color: Colors.textSecondary,
    flex: 1,
  },
  tempInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    minWidth: 80,
  },
  tempInput: {
    fontSize: 16,
    fontFamily: Typography.fontMedium,
    color: Colors.textPrimary,
    textAlign: "center",
    minWidth: 40,
    paddingVertical: 0,
  },
  tempUnit: {
    fontSize: 14,
    fontFamily: Typography.fontRegular,
    color: Colors.textSecondary,
    marginLeft: 4,
  },
  saveLogButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: Spacing.md,
  },
  saveLogButtonText: {
    fontSize: 16,
    fontFamily: Typography.fontSemiBold,
    color: "#fff",
    marginLeft: 8,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontFamily: Typography.fontSemiBold,
    color: Colors.textPrimary,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: Typography.fontRegular,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
});