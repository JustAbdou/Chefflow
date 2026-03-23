import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, Feather } from "@expo/vector-icons";
import { getDocs, addDoc, serverTimestamp, doc, updateDoc, Timestamp } from "firebase/firestore";
import { useRestaurant } from "../../contexts/RestaurantContext";
import { getRestaurantCollection, getRestaurantDoc } from "../../utils/firestoreHelpers";
import { fetchFridgeListFromFridgelogs } from "../../utils/fridgeHelpers";
import { auth } from "../../../firebase";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { 
  getCachedFridgeLogs, 
  cacheFridgeLogsOffline,
  addFridgeLogOffline,
  offlineCapableUpdate,
} from "../../utils/offlineSync";
import { addNetworkListener, getNetworkStatus } from '../../utils/networkMonitor';

import { Colors } from "../../constants/Colors";
import { Typography } from "../../constants/Typography";
import { Spacing } from "../../constants/Spacing";
import { getAndroidTitleMargin } from "../../utils/responsive";
import useNavigationBar from "../../hooks/useNavigationBar";
import { useFocusEffect } from "@react-navigation/native";

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
  const [bulkSaving, setBulkSaving] = useState(false);
  const isInitialFocus = useRef(true);

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
      
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      const [masterFridges, allLogsSnapshot] = await Promise.all([
        fetchFridgeListFromFridgelogs(restaurantId, null),
        getDocs(getRestaurantCollection(restaurantId, 'fridgelogs')),
      ]);
      
      const logsByFridgeName = new Map();
      allLogsSnapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        const logDate = data.createdAt;
        const fridgeName = data.fridgeName || data.name || 'Unknown Fridge';
        const fridgeKey = fridgeName.toLowerCase();
        let include = false;
        if (!logDate) {
          include = true;
        } else {
          try {
            let logDateTime;
            if (typeof logDate.toDate === 'function') logDateTime = logDate.toDate();
            else if (logDate instanceof Date) logDateTime = logDate;
            else logDateTime = new Date(logDate);
            include = !isNaN(logDateTime.getTime()) && logDateTime >= startOfDay && logDateTime <= endOfDay;
          } catch {
            include = true;
          }
        }
        if (include) {
          const hasData = (data.temperatureAM && String(data.temperatureAM).trim() !== '') || 
                         (data.temperaturePM && String(data.temperaturePM).trim() !== '') || data.done === true;
          const existing = logsByFridgeName.get(fridgeKey);
          if (!existing || (hasData && !existing.hasData)) {
            logsByFridgeName.set(fridgeKey, {
              id: docSnap.id,
              fridgeName,
              fridgeId: data.fridgeId || docSnap.id,
              fridgeType: data.fridgeType || 'fridge',
              temperatureAM: data.temperatureAM || '',
              temperaturePM: data.temperaturePM || '',
              createdAt: data.createdAt,
              done: data.done || false,
              isNew: false,
              hasData,
            });
          }
        }
      });
      
      const filteredLogsForDate = masterFridges.map((fridge) => {
        const key = (fridge.fridgeName || '').toLowerCase();
        const logForDate = logsByFridgeName.get(key);
        if (logForDate) {
          const { hasData, ...log } = logForDate;
          return log;
        }
        return {
          id: fridge.id,
          fridgeName: fridge.fridgeName,
          fridgeId: fridge.fridgeId || fridge.id,
          fridgeType: fridge.fridgeType || 'fridge',
          temperatureAM: '',
          temperaturePM: '',
          createdAt: null,
          done: false,
          isNew: true,
        };
      });
      filteredLogsForDate.sort((a, b) => (a.fridgeName || '').toLowerCase().localeCompare((b.fridgeName || '').toLowerCase()));

      setLogs(filteredLogsForDate);
      await cacheFridgeLogsOffline(filteredLogsForDate);
      
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
    isInitialFocus.current = true;
    const loadInitialData = async () => {
      setLoading(true);
      await fetchLogs();
      setLoading(false);
    };
    
    loadInitialData();
  }, [restaurantId, selectedDate]);

  useFocusEffect(
    useCallback(() => {
      if (!restaurantId) return;
      if (isInitialFocus.current) {
        isInitialFocus.current = false;
        return;
      }
      fetchLogs();
    }, [restaurantId, selectedDate])
  );

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

  /** Calendar bounds for the selected logging day */
  const getSelectedDayBounds = () => {
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);
    return { startOfDay, endOfDay };
  };

  /**
   * Find a fridgelogs document for the same fridge name on the selected calendar day.
   * Matches existing single-save behavior (same fridge + same day => update).
   */
  const findExistingLogForFridgeAndDate = (allDocs, fridgeName, startOfDay, endOfDay) => {
    for (const docSnap of allDocs) {
      const data = docSnap.data();
      const logDate = data.createdAt;
      if (data.fridgeName !== fridgeName || !logDate) continue;
      try {
        let logDateTime;
        if (typeof logDate.toDate === "function") logDateTime = logDate.toDate();
        else if (logDate instanceof Date) logDateTime = logDate;
        else if (logDate && typeof logDate.seconds === "number")
          logDateTime = new Date(logDate.seconds * 1000);
        else logDateTime = new Date(logDate);
        if (
          !isNaN(logDateTime.getTime()) &&
          logDateTime >= startOfDay &&
          logDateTime <= endOfDay
        ) {
          return { docSnap, data };
        }
      } catch (e) {
        console.warn("Error parsing date for existing log:", docSnap.id, e);
      }
    }
    return null;
  };

  /** Merge inputs with stored row values; skip row if nothing to persist */
  const mergeFridgeTemps = (fridgeDoc, amRaw, pmRaw) => {
    const existingAM = (fridgeDoc.temperatureAM || "").toString().trim();
    const existingPM = (fridgeDoc.temperaturePM || "").toString().trim();
    const am = (amRaw || "").toString().trim();
    const pm = (pmRaw || "").toString().trim();
    const finalAM = am !== "" ? am : existingAM;
    const finalPM = pm !== "" ? pm : existingPM;
    if (finalAM === "" && finalPM === "") return null;
    return { finalAM, finalPM, existingAM, existingPM };
  };

  const validateTempField = (label, value) => {
    if (!value || value.trim() === "") return null;
    const n = parseFloat(value);
    if (isNaN(n)) return `${label} (“${value}”) is not a valid number`;
    return null;
  };

  /** Build Firestore payload for one fridge (shared shape with previous saveCompleteLog) */
  const buildSavePayload = (fridgeDoc, finalAM, finalPM) => ({
    fridgeName: fridgeDoc.fridgeName,
    fridgeId: fridgeDoc.fridgeId,
    fridgeType: fridgeDoc.fridgeType || "fridge",
    done: true,
    createdAt: Timestamp.fromDate(selectedDate),
    temperatureAM: finalAM,
    temperaturePM: finalPM,
    loggedBy: {
      userId: auth.currentUser.uid,
      email: auth.currentUser.email,
    },
  });

  /**
   * Save all visible fridge rows in one action. Skips rows with no AM/PM to save.
   * Invalid numeric fields are reported without failing the whole batch for other fridges—
   * we collect errors and only persist valid rows; if any errors, user is alerted.
   */
  const saveAllFridgeLogs = async () => {
    if (!restaurantId || !auth.currentUser) {
      console.warn("Cannot save: missing restaurant or sign-in.");
      return;
    }
    if (filteredLogs.length === 0) return;

    const { startOfDay, endOfDay } = getSelectedDayBounds();
    const validationErrors = [];
    const pending = [];

    for (const fridgeDoc of filteredLogs) {
      const amRaw = tempInputs[`${fridgeDoc.id}_AM`];
      const pmRaw = tempInputs[`${fridgeDoc.id}_PM`];
      const merged = mergeFridgeTemps(fridgeDoc, amRaw, pmRaw);
      if (!merged) continue;

      const errAM = validateTempField(`${fridgeDoc.fridgeName} AM`, merged.finalAM);
      const errPM = validateTempField(`${fridgeDoc.fridgeName} PM`, merged.finalPM);
      if (errAM) validationErrors.push(errAM);
      if (errPM) validationErrors.push(errPM);
      if (errAM || errPM) continue;

      pending.push({
        fridgeDoc,
        finalAM: merged.finalAM,
        finalPM: merged.finalPM,
      });
    }

    if (validationErrors.length > 0) {
      console.warn("Save all: fix temperature values:", validationErrors);
      return;
    }

    if (pending.length === 0) {
      return;
    }

    setBulkSaving(true);
    try {
      if (isOffline) {
        const fridgeLogsCollection = getRestaurantCollection(restaurantId, "fridgelogs");
        let allDocs = [];
        try {
          const snap = await getDocs(fridgeLogsCollection);
          allDocs = snap.docs;
        } catch (_) {
          allDocs = [];
        }

        const cachedAsDocs = (await getCachedFridgeLogs()).map((row) => ({
          id: row.id,
          data: () => row,
        }));

        const docList = allDocs.length ? allDocs : cachedAsDocs;
        let updatedLogs = logs.map((log) => ({ ...log }));

        for (const { fridgeDoc, finalAM, finalPM } of pending) {
          const base = buildSavePayload(fridgeDoc, finalAM, finalPM);
          const payload = { ...base, recordedAt: serverTimestamp() };
          const match = findExistingLogForFridgeAndDate(
            docList,
            fridgeDoc.fridgeName,
            startOfDay,
            endOfDay
          );

          if (match && !String(match.docSnap.id).startsWith("offline_")) {
            await offlineCapableUpdate(
              restaurantId,
              "fridgelogs",
              match.docSnap.id,
              payload,
              false
            );
          } else {
            await addFridgeLogOffline(restaurantId, payload);
          }

          const idx = updatedLogs.findIndex(
            (l) =>
              l.fridgeName === fridgeDoc.fridgeName ||
              l.id === fridgeDoc.id
          );
          if (idx >= 0) {
            updatedLogs[idx] = {
              ...updatedLogs[idx],
              temperatureAM: finalAM,
              temperaturePM: finalPM,
              done: true,
              isOffline: true,
            };
          }
        }

        setLogs(updatedLogs);
        await cacheFridgeLogsOffline(updatedLogs);
      } else {
        const fridgeLogsCollection = getRestaurantCollection(restaurantId, "fridgelogs");
        const allLogsSnapshot = await getDocs(fridgeLogsCollection);

        for (const { fridgeDoc, finalAM, finalPM } of pending) {
          const base = buildSavePayload(fridgeDoc, finalAM, finalPM);
          const match = findExistingLogForFridgeAndDate(
            allLogsSnapshot.docs,
            fridgeDoc.fridgeName,
            startOfDay,
            endOfDay
          );

          if (match) {
            await updateDoc(doc(fridgeLogsCollection, match.docSnap.id), {
              ...base,
              temperatureAM: finalAM,
              temperaturePM: finalPM,
              recordedAt: serverTimestamp(),
            });
          } else {
            await addDoc(fridgeLogsCollection, {
              ...base,
              recordedAt: serverTimestamp(),
            });
          }
        }
        await fetchLogs();
      }
    } catch (error) {
      console.error("❌ Bulk save error:", error);
    } finally {
      setBulkSaving(false);
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

        <TouchableOpacity
          style={styles.manageBtn}
          onPress={() => navigation.navigate("ManageFridges")}
          activeOpacity={0.85}
        >
          <Ionicons name="settings-outline" size={22} color={Colors.primary} />
          <Text style={styles.manageBtnText}>Manage Fridges</Text>
          <Ionicons name="chevron-forward" size={20} color={Colors.gray400} style={{ marginLeft: "auto" }} />
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

                      </View>
                    )}
                  </View>
                );
              })
            )
          )}
        </View>

        {!loading && filteredLogs.length > 0 && (
          <View style={styles.saveAllSection}>
            <TouchableOpacity
              style={[
                styles.saveAllButton,
                bulkSaving && styles.saveAllButtonDisabled,
              ]}
              onPress={saveAllFridgeLogs}
              disabled={bulkSaving}
              activeOpacity={0.85}
            >
              {bulkSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={22} color="#fff" />
                  <Text style={styles.saveAllButtonText}>Save all</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
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
  saveAllSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  saveAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    minHeight: 52,
  },
  saveAllButtonDisabled: {
    opacity: 0.7,
  },
  saveAllButtonText: {
    fontSize: 17,
    fontFamily: Typography.fontSemiBold,
    color: "#fff",
    marginLeft: 10,
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