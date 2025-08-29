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

  // Hide Android navigation bar
  const navigationBar = useNavigationBar();
  navigationBar.useHidden(); // Use hidden mode for complete immersion
  const [refreshing, setRefreshing] = useState(false);

  // Fetch logs from fridgelogs collection with date filter
  const fetchLogs = async () => {
    if (!restaurantId) return;
    
    try {
      console.log('🔍 Fetching fridge logs for restaurant:', restaurantId);
      
      // Create date range for the selected date (start and end of day)
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      const startTimestamp = Timestamp.fromDate(startOfDay);
      const endTimestamp = Timestamp.fromDate(endOfDay);
      
      const fridgeLogsCollection = getRestaurantCollection(restaurantId, 'fridgelogs');
      const q = query(
        fridgeLogsCollection,
        where("createdAt", ">=", startTimestamp),
        where("createdAt", "<=", endTimestamp),
        orderBy("createdAt", "desc")
      );
      const logsSnapshot = await getDocs(q);
      
      let allLogs = [];
      logsSnapshot.forEach(docSnap => {
        const data = docSnap.data();
        allLogs.push({
          id: docSnap.id,
          ...data,
        });
      });
      
      // Sort logs by fridgeName for consistent display
      allLogs.sort((a, b) => {
        if (a.fridgeName && b.fridgeName) {
          return a.fridgeName.localeCompare(b.fridgeName);
        }
        return 0;
      });
      
      console.log(`✅ Fetched ${allLogs.length} fridge logs`);
      setLogs(allLogs);
      
      // Initialize temp inputs with current values
      const initialInputs = {};
      allLogs.forEach(log => {
        initialInputs[`${log.id}_AM`] = log.temperatureAM || '';
        initialInputs[`${log.id}_PM`] = log.temperaturePM || '';
      });
      setTempInputs(initialInputs);
    } catch (error) {
      console.error('❌ Error fetching fridge logs:', error);
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
    if (!createdAt) return "--:--";
    const date = new Date(createdAt.seconds * 1000);
    let hours = date.getHours();
    let minutes = date.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${hours}:${minutes.toString().padStart(2, "0")} ${ampm}`;
  };

  // Helper to check if fridge has been logged
  const isLogged = (log) => {
    return (log.temperatureAM && log.temperatureAM.trim() !== '') || 
           (log.temperaturePM && log.temperaturePM.trim() !== '') ||
           log.done === true;
  };

  // Helper to get status text
  const getStatusText = (log) => {
    // Check if there are pending changes (input values different from saved values)
    const amInput = tempInputs[`${log.id}_AM`] || '';
    const pmInput = tempInputs[`${log.id}_PM`] || '';
    const amSaved = log.temperatureAM || '';
    const pmSaved = log.temperaturePM || '';
    
    const hasPendingChanges = amInput !== amSaved || pmInput !== pmSaved;
    
    if (hasPendingChanges && (amInput.trim() !== '' || pmInput.trim() !== '')) {
      return 'Pending';
    }
    
    if (log.done) return 'Logged';
    if (log.temperatureAM && log.temperaturePM) return 'Logged';
    if (log.temperatureAM || log.temperaturePM) return 'Partial';
    return 'Pending';
  };

  // Helper to get status color
  const getStatusColor = (log) => {
    const status = getStatusText(log);
    switch (status) {
      case 'Logged':
        return '#059669';
      case 'Partial':
        return '#d97706';
      case 'Pending':
        // Check if there are unsaved changes
        const amInput = tempInputs[`${log.id}_AM`] || '';
        const pmInput = tempInputs[`${log.id}_PM`] || '';
        const amSaved = log.temperatureAM || '';
        const pmSaved = log.temperaturePM || '';
        
        const hasPendingChanges = amInput !== amSaved || pmInput !== pmSaved;
        return hasPendingChanges && (amInput.trim() !== '' || pmInput.trim() !== '') ? '#dc2626' : '#6b7280';
      default:
        return '#6b7280';
    }
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

  // Handle temperature input change
  const handleTempInputChange = (logId, period, value) => {
    const key = `${logId}_${period}`;
    setTempInputs(prev => ({
      ...prev,
      [key]: value
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

      // Prepare update data
      const updateData = {
        done: true // Always set done to true when saving log
      };

      // Only update temperatures that have values
      if (amTempValue && amTempValue.trim() !== '') {
        updateData.temperatureAM = amTempValue.trim();
      }
      if (pmTempValue && pmTempValue.trim() !== '') {
        updateData.temperaturePM = pmTempValue.trim();
      }

      // Update the document
      const fridgeDocRef = getRestaurantDoc(restaurantId, 'fridgelogs', logId);
      await updateDoc(fridgeDocRef, updateData);

      console.log('✅ Complete log saved successfully');
      
      // Refresh logs
      await fetchLogs();
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
            <Text style={styles.title}>Fridge Temperature</Text>
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
                <Text style={styles.emptyText}>No temperature logs for today</Text>
                <Text style={styles.emptySubtext}>Temperature logs will appear here when fridges are configured</Text>
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
                        <Ionicons name="thermometer" size={24} color="#2563eb" />
                      </View>
                      <View style={styles.logInfo}>
                        <Text style={styles.logName}>{log.fridgeName || log.id}</Text>
                        <Text style={styles.logTime}>
                          {log.createdAt ? formatTime(log.createdAt) : 'No time set'}
                        </Text>
                      </View>
                      <View style={styles.logStatus}>
                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(log) + '20' }]}>
                          <Ionicons 
                            name={isLogged(log) ? "checkmark" : "time-outline"} 
                            size={16} 
                            color={getStatusColor(log)} 
                          />
                          <Text style={[styles.statusText, { color: getStatusColor(log) }]}>
                            {getStatusText(log)}
                          </Text>
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
                          <Text style={styles.temperatureLabel}>AM Temperature:</Text>
                          <View style={styles.tempInputContainer}>
                            <TextInput
                              style={styles.tempInput}
                              value={tempInputs[`${log.id}_AM`] || ''}
                              onChangeText={(value) => handleTempInputChange(log.id, 'AM', value)}
                              placeholder="--"
                              keyboardType="numeric"
                              maxLength={5}
                            />
                            <Text style={styles.tempUnit}>℃</Text>
                          </View>
                        </View>
                        
                        {/* PM Temperature Input */}
                        <View style={styles.tempInputRow}>
                          <Text style={styles.temperatureLabel}>PM Temperature:</Text>
                          <View style={styles.tempInputContainer}>
                            <TextInput
                              style={styles.tempInput}
                              value={tempInputs[`${log.id}_PM`] || ''}
                              onChangeText={(value) => handleTempInputChange(log.id, 'PM', value)}
                              placeholder="--"
                              keyboardType="numeric"
                              maxLength={5}
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
        onConfirm={(date) => {
          setSelectedDate(date);
          setShowDatePicker(false);
        }}
        onCancel={() => setShowDatePicker(false)}
        maximumDate={new Date()}
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
  title: {
    fontSize: 24,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
    marginBottom: 2,
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
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  statusText: {
    fontSize: 12,
    fontFamily: Typography.fontMedium,
    color: "#059669",
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