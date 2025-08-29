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
  Modal,
  Alert,
} from "react-native";
import { Ionicons, Feather } from "@expo/vector-icons";
import { getDocs, addDoc, serverTimestamp, query, where, Timestamp, orderBy } from "firebase/firestore";
import { useRestaurant } from "../../contexts/RestaurantContext";
import { getRestaurantCollection } from "../../utils/firestoreHelpers";
import DateTimePickerModal from "react-native-modal-datetime-picker";

import { Colors } from "../../constants/Colors";
import { Typography } from "../../constants/Typography";
import { Spacing } from "../../constants/Spacing";
import { getAndroidTitleMargin } from "../../utils/responsive";
import useNavigationBar from "../../hooks/useNavigationBar";

export default function CoolingAndReheatingScreen({ navigation }) {
  const { restaurantId } = useRestaurant();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Form state
  const [foodItem, setFoodItem] = useState("");
  const [temperature, setTemperature] = useState("");
  const [selectedType, setSelectedType] = useState("cooling");

  // Hide Android navigation bar
  const navigationBar = useNavigationBar();
  navigationBar.useHidden();

  // Fetch logs from coolingreheating collection with date filter
  const fetchLogs = async () => {
    if (!restaurantId) return;

    try {
      console.log('🔍 Fetching cooling & reheating logs for restaurant:', restaurantId);

      // Create date range for the selected date (start and end of day)
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      const startTimestamp = Timestamp.fromDate(startOfDay);
      const endTimestamp = Timestamp.fromDate(endOfDay);

      const coolingReheatingCollection = getRestaurantCollection(restaurantId, 'coolingreheating');
      const q = query(
        coolingReheatingCollection,
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

      console.log('📋 Fetched cooling & reheating logs:', allLogs.length);
      setLogs(allLogs);
    } catch (error) {
      console.error('❌ Error fetching cooling & reheating logs:', error);
      Alert.alert('Error', 'Failed to load temperature logs');
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
    if (!foodItem.trim()) {
      Alert.alert('Error', 'Please enter a food item name');
      return;
    }
    if (!temperature.trim()) {
      Alert.alert('Error', 'Please enter a temperature');
      return;
    }

    try {
      const coolingReheatingCollection = getRestaurantCollection(restaurantId, 'coolingreheating');
      
      await addDoc(coolingReheatingCollection, {
        item: foodItem.trim(),
        temperature: temperature.trim(),
        type: selectedType,
        createdAt: serverTimestamp(),
      });

      console.log('✅ Cooling & reheating log saved successfully');
      
      // Reset form
      setFoodItem("");
      setTemperature("");
      setSelectedType("cooling");
      setShowAddModal(false);
      
      // Refresh logs
      fetchLogs();
    } catch (error) {
      console.error('❌ Error saving cooling & reheating log:', error);
      Alert.alert('Error', 'Failed to save temperature log');
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
          <Text style={styles.loadingText}>Loading temperature logs...</Text>
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
          <Text style={styles.title}>Cooling & Reheating</Text>
          <Text style={styles.subtitle}>Temperature Safety Logs</Text>
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
            <Text style={styles.addLogText}>Add Temperature Log</Text>
          </TouchableOpacity>
        </View>

        {/* Today's Logs */}
        <View style={styles.logsSection}>
          <Text style={styles.sectionTitle}>Logs for Selected Date ({selectedDateLogs.length})</Text>
          
          {selectedDateLogs.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="thermometer-outline" size={48} color={Colors.textSecondary} />
              <Text style={styles.emptyText}>No logs recorded for this date</Text>
              <Text style={styles.emptySubtext}>
                Tap "Add New Log" to record temperature safety data
              </Text>
            </View>
          ) : (
            selectedDateLogs.map((log) => (
              <View key={log.id} style={styles.logCard}>
                <View style={styles.logHeader}>
                  <View style={styles.logInfo}>
                    <Text style={styles.logItemName}>{log.item}</Text>
                    <Text style={styles.logTime}>{formatTime(log.createdAt)}</Text>
                  </View>
                  <View style={styles.logRight}>
                    <View style={[styles.typeBadge, log.type === 'cooling' ? styles.coolingBadge : styles.reheatingBadge]}>
                      <Ionicons 
                        name={log.type === 'cooling' ? 'snow' : 'flame'} 
                        size={12} 
                        color={log.type === 'cooling' ? '#0ea5e9' : '#f97316'} 
                      />
                      <Text style={[styles.typeText, log.type === 'cooling' ? styles.coolingText : styles.reheatingText]}>
                        {log.type === 'cooling' ? 'Cooling' : 'Reheating'}
                      </Text>
                    </View>
                    <Text style={styles.temperatureValue}>{log.temperature}°C</Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Add Log Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Log</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Food Item Input */}
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Food Item</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter food item name"
                value={foodItem}
                onChangeText={setFoodItem}
                placeholderTextColor={Colors.textLight}
              />
            </View>

            {/* Type Selection */}
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Type</Text>
              <View style={styles.typeSelector}>
                <TouchableOpacity
                  style={[styles.typeButton, selectedType === 'cooling' && styles.typeButtonSelected]}
                  onPress={() => setSelectedType('cooling')}
                >
                  <Ionicons name="snow" size={20} color={selectedType === 'cooling' ? '#fff' : '#0ea5e9'} />
                  <Text style={[styles.typeButtonText, selectedType === 'cooling' && styles.typeButtonTextSelected]}>
                    Cooling
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeButton, selectedType === 'reheating' && styles.typeButtonSelected]}
                  onPress={() => setSelectedType('reheating')}
                >
                  <Ionicons name="flame" size={20} color={selectedType === 'reheating' ? '#fff' : '#f97316'} />
                  <Text style={[styles.typeButtonText, selectedType === 'reheating' && styles.typeButtonTextSelected]}>
                    Reheating
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Temperature Input */}
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Temperature (°C)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter temperature"
                value={temperature}
                onChangeText={setTemperature}
                keyboardType="numeric"
                placeholderTextColor={Colors.textLight}
              />
            </View>

            {/* Save Button */}
            <TouchableOpacity style={styles.saveButton} onPress={handleSaveLog}>
              <Ionicons name="add-circle" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>Save Log</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
  },
  logInfo: {
    flex: 1,
  },
  logItemName: {
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
  logRight: {
    alignItems: "flex-end",
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  coolingBadge: {
    backgroundColor: "#eff6ff",
  },
  reheatingBadge: {
    backgroundColor: "#fff7ed",
  },
  typeText: {
    fontSize: 12,
    fontFamily: Typography.fontMedium,
    marginLeft: 4,
  },
  coolingText: {
    color: "#0ea5e9",
  },
  reheatingText: {
    color: "#f97316",
  },
  temperatureValue: {
    fontSize: 16,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    minHeight: 500,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
  },
  inputSection: {
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    fontSize: 16,
    fontFamily: Typography.fontMedium,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  textInput: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: 16,
    fontFamily: Typography.fontRegular,
    color: Colors.textPrimary,
  },
  typeSelector: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  typeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  typeButtonSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  typeButtonText: {
    fontSize: 16,
    fontFamily: Typography.fontMedium,
    color: Colors.textPrimary,
    marginLeft: Spacing.xs,
  },
  typeButtonTextSelected: {
    color: "#fff",
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: Typography.fontSemiBold,
    color: "#fff",
    marginLeft: Spacing.xs,
  },
});
