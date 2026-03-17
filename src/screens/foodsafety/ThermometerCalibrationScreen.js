import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getDocs, addDoc, Timestamp, query, orderBy, where } from "firebase/firestore";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { useRestaurant } from "../../contexts/RestaurantContext";
import { getRestaurantCollection } from "../../utils/firestoreHelpers";
import { auth } from "../../../firebase";
import Button from "../../components/ui/Button";

import { Colors } from "../../constants/Colors";
import { Typography } from "../../constants/Typography";
import { Spacing } from "../../constants/Spacing";
import { getAndroidTitleMargin } from "../../utils/responsive";
import useNavigationBar from "../../hooks/useNavigationBar";

const SCREEN_HEIGHT = Dimensions.get('window').height;

export default function ThermometerCalibrationScreen({ navigation }) {
  const { restaurantId } = useRestaurant();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Form state
  const [thermometerId, setThermometerId] = useState("");
  const [temperature, setTemperature] = useState("");
  const [correctiveAction, setCorrectiveAction] = useState("");
  
  // Scrollbar state
  const [scrollPosition, setScrollPosition] = useState(0);
  const [scrollContentHeight, setScrollContentHeight] = useState(0);
  const [scrollViewHeight, setScrollViewHeight] = useState(0);

  // Hide Android navigation bar
  const navigationBar = useNavigationBar();
  navigationBar.useHidden();

  // Fetch logs from thermometerCalibrationLogs collection with date filter
  const fetchLogs = async () => {
    if (!restaurantId) return;

    try {
      console.log('🔍 Fetching thermometer calibration logs for restaurant:', restaurantId);

      // Create date range for the selected date (start and end of day)
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      const startTimestamp = Timestamp.fromDate(startOfDay);
      const endTimestamp = Timestamp.fromDate(endOfDay);

      const calibrationCollection = getRestaurantCollection(restaurantId, 'thermometerCalibrationLogs');
      const q = query(
        calibrationCollection,
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

      // Sort by createdAt timestamp (newest first)
      allLogs.sort((a, b) => {
        const aTime = a.createdAt?.toDate?.() || new Date(0);
        const bTime = b.createdAt?.toDate?.() || new Date(0);
        return bTime - aTime;
      });

      console.log('📋 Fetched thermometer calibration logs:', allLogs.length);
      setLogs(allLogs);
    } catch (error) {
      console.error('❌ Error fetching thermometer calibration logs:', error);
      Alert.alert('Error', 'Failed to load calibration logs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [restaurantId, selectedDate]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLogs();
  };

  const handleSaveLog = async () => {
    if (!thermometerId.trim()) {
      Alert.alert('Error', 'Please enter a thermometer ID');
      return;
    }
    if (!temperature.trim()) {
      Alert.alert('Error', 'Please enter a temperature');
      return;
    }
    
    // Validate temperature is a valid number
    const tempNumber = parseFloat(temperature);
    if (isNaN(tempNumber)) {
      Alert.alert('Error', 'Please enter a valid temperature number');
      return;
    }

    try {
      const calibrationCollection = getRestaurantCollection(restaurantId, 'thermometerCalibrationLogs');
      
      // Set time to start of selected date (same as query)
      const dateForSave = new Date(selectedDate);
      dateForSave.setHours(0, 0, 0, 0);
      const timestampForSave = Timestamp.fromDate(dateForSave);
      
      const logData = {
        thermometerId: thermometerId.trim(),
        temperature: tempNumber,
        correctiveAction: correctiveAction.trim() || null,
        createdAt: timestampForSave,
        createdBy: {
          userId: auth.currentUser?.uid || null,
          email: auth.currentUser?.email || null,
        },
      };
      
      console.log('💾 Saving thermometer calibration log:', {
        thermometerId: logData.thermometerId,
        temperature: logData.temperature,
        createdAt: dateForSave.toISOString(),
        selectedDate: selectedDate.toISOString()
      });
      
      const docRef = await addDoc(calibrationCollection, logData);
      console.log('✅ Thermometer calibration log saved successfully with ID:', docRef.id);
      
      // Reset form
      setThermometerId("");
      setTemperature("");
      setCorrectiveAction("");
      setShowAddModal(false);
      
      // Refresh logs
      await fetchLogs();
    } catch (error) {
      console.error('❌ Error saving thermometer calibration log:', error);
      Alert.alert('Error', `Failed to save calibration log: ${error.message}`);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate?.() || new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate?.() || new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getSelectedDateLogs = () => {
    const selected = new Date(selectedDate);
    selected.setHours(0, 0, 0, 0);
    
    return logs.filter(log => {
      if (!log.createdAt) return false;
      const logDate = log.createdAt.toDate?.() || new Date(log.createdAt);
      logDate.setHours(0, 0, 0, 0);
      return logDate.getTime() === selected.getTime();
    });
  };

  const selectedDateLogs = getSelectedDateLogs();

  // Format the selected date
  const formatSelectedDate = (date) => {
    const dayName = date.toLocaleDateString(undefined, { weekday: "long" });
    const monthName = date.toLocaleDateString(undefined, { month: "long" });
    const dayNum = date.getDate();
    return `${dayName}, ${monthName} ${dayNum}`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading calibration logs...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Thermometer Calibration</Text>
          <Text style={styles.subtitle}>Calibration Logs</Text>
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

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Add New Log Section */}
        <View style={styles.addLogSection}>
          <TouchableOpacity style={styles.addLogCard} onPress={() => setShowAddModal(true)}>
            <Ionicons name="add-circle" size={24} color={Colors.primary} />
            <Text style={styles.addLogText}>Add Log</Text>
          </TouchableOpacity>
        </View>

        {/* Logs List */}
        <View style={styles.logsSection}>
          <Text style={styles.sectionTitle}>Logs for Selected Date ({selectedDateLogs.length})</Text>
          
          {selectedDateLogs.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="thermometer-outline" size={48} color={Colors.textSecondary} />
              <Text style={styles.emptyText}>No calibration logs yet</Text>
              <Text style={styles.emptySubtext}>
                Tap "Add Log" to record your first thermometer calibration
              </Text>
            </View>
          ) : (
            selectedDateLogs.map((log) => (
              <View key={log.id} style={styles.logCard}>
                <View style={styles.logHeader}>
                  <View style={styles.logInfo}>
                    <Text style={styles.logThermometerId}>{log.thermometerId}</Text>
                    <Text style={styles.logDateTime}>
                      {formatDate(log.createdAt)} at {formatTime(log.createdAt)}
                    </Text>
                  </View>
                </View>
                <View style={styles.logDetails}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Temperature:</Text>
                    <Text style={styles.detailValue}>{log.temperature}°C</Text>
                  </View>
                  {log.correctiveAction && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Corrective Action:</Text>
                      <Text style={styles.detailValue}>{log.correctiveAction}</Text>
                    </View>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Add Log Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        presentationStyle={Platform.OS === "ios" ? "overFullScreen" : undefined}
        onRequestClose={() => setShowAddModal(false)}
      >
        <SafeAreaView style={styles.modalSafeArea} edges={['bottom']}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1 }}
            keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
          >
            <View style={styles.overlay}>
              <TouchableOpacity style={styles.backdrop} onPress={() => setShowAddModal(false)} activeOpacity={1} />
              <View style={styles.modal}>
                {/* Header */}
                <View style={styles.modalHeader}>
                  <View style={styles.titleContainer}>
                    <Text style={styles.modalTitle}>Add Calibration Log</Text>
                    <Text style={styles.date}>{formatSelectedDate(selectedDate)}</Text>
                  </View>
                  <TouchableOpacity style={styles.closeButton} onPress={() => setShowAddModal(false)} activeOpacity={0.7}>
                    <Text style={styles.closeText}>×</Text>
                  </TouchableOpacity>
                </View>

                {/* Form - Scrollable */}
                <View style={styles.scrollContainer}>
                  <ScrollView
                    style={styles.modalScrollView}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={styles.modalScrollContent}
                    showsVerticalScrollIndicator={false}
                    onScroll={(event) => {
                      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
                      setScrollPosition(contentOffset.y);
                      setScrollContentHeight(contentSize.height);
                      setScrollViewHeight(layoutMeasurement.height);
                    }}
                    scrollEventThrottle={16}
                  >
                    <Text style={styles.label}>Thermometer ID *</Text>
                    <TextInput
                      style={styles.input}
                      value={thermometerId}
                      onChangeText={setThermometerId}
                      placeholder="Enter thermometer ID"
                      placeholderTextColor={Colors.gray200}
                      autoFocus
                    />
                    
                    <Text style={[styles.label, { marginTop: Spacing.lg }]}>Temperature (°C) *</Text>
                    <TextInput
                      style={styles.input}
                      value={temperature}
                      onChangeText={setTemperature}
                      placeholder="Enter temperature"
                      placeholderTextColor={Colors.gray200}
                      keyboardType="decimal-pad"
                    />
                    
                    <Text style={[styles.label, { marginTop: Spacing.lg }]}>Corrective Action</Text>
                    <TextInput
                      style={[styles.input, styles.multilineInput]}
                      value={correctiveAction}
                      onChangeText={setCorrectiveAction}
                      placeholder="Enter corrective action (optional)"
                      placeholderTextColor={Colors.gray200}
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                    />
                  </ScrollView>
                  {/* Custom Scrollbar */}
                  {scrollContentHeight > scrollViewHeight && (
                    <View style={styles.scrollbarTrack} pointerEvents="none">
                      <View 
                        style={[
                          styles.scrollbarThumb,
                          {
                            height: Math.max(30, (scrollViewHeight / scrollContentHeight) * scrollViewHeight),
                            top: (scrollPosition / (scrollContentHeight - scrollViewHeight)) * (scrollViewHeight - Math.max(30, (scrollViewHeight / scrollContentHeight) * scrollViewHeight)) || 0,
                          }
                        ]} 
                      />
                    </View>
                  )}
                </View>

                {/* Footer - Save Button */}
                <View style={styles.modalFooter}>
                  <Button 
                    onPress={handleSaveLog} 
                    disabled={!thermometerId.trim() || !temperature.trim()} 
                    fullWidth 
                    size="lg"
                  >
                    Save Log
                  </Button>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

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
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: 16,
    color: Colors.textSecondary,
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
  scrollView: {
    flex: 1,
  },
  addLogSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  addLogCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e2e8f0",
    borderStyle: "dashed",
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  addLogText: {
    fontSize: 16,
    fontFamily: Typography.fontMedium,
    color: Colors.primary,
    marginLeft: Spacing.sm,
  },
  logsSection: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 100,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: Typography.fontSemiBold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  logCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: Spacing.md,
  },
  logHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  logInfo: {
    flex: 1,
  },
  logThermometerId: {
    fontSize: 16,
    fontFamily: Typography.fontSemiBold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  logDateTime: {
    fontSize: 14,
    fontFamily: Typography.fontRegular,
    color: Colors.textSecondary,
  },
  logDetails: {
    marginTop: Spacing.xs,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.xs,
  },
  detailLabel: {
    fontSize: 14,
    fontFamily: Typography.fontRegular,
    color: Colors.textSecondary,
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    fontFamily: Typography.fontSemiBold,
    color: Colors.textPrimary,
    flex: 1,
    textAlign: "right",
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
  modalSafeArea: {
    flex: 1,
    justifyContent: "flex-end",
  },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modal: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: "100%",
    maxHeight: SCREEN_HEIGHT * 0.85,
    minHeight: 400,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: 0,
    flexDirection: "column",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.lg,
  },
  titleContainer: {
    flex: 1,
  },
  modalTitle: {
    fontSize: Typography.xl,
    fontWeight: "bold",
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  date: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  closeText: {
    fontSize: 24,
    color: Colors.textSecondary,
    fontWeight: "300",
  },
  scrollContainer: {
    flex: 1,
    position: "relative",
  },
  modalScrollView: {
    flex: 1,
    minHeight: 200,
  },
  modalScrollContent: {
    paddingBottom: Spacing.lg,
  },
  scrollbarTrack: {
    position: "absolute",
    right: 4,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: "rgba(0, 0, 0, 0.1)",
    borderRadius: 2,
    zIndex: 10,
  },
  scrollbarThumb: {
    position: "absolute",
    right: 0,
    width: 4,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    borderRadius: 2,
    minHeight: 30,
  },
  label: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  input: {
    fontSize: Typography.lg,
    fontWeight: "600",
    color: Colors.textPrimary,
    paddingVertical: Spacing.sm,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  multilineInput: {
    minHeight: 100,
    paddingTop: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: 8,
    paddingHorizontal: Spacing.sm,
  },
  modalFooter: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    backgroundColor: Colors.background,
  },
});
