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
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons, Feather } from "@expo/vector-icons";
import { getDocs, addDoc, serverTimestamp, query, where, Timestamp, orderBy } from "firebase/firestore";
import { useRestaurant } from "../../contexts/RestaurantContext";
import { getRestaurantCollection } from "../../utils/firestoreHelpers";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import Button from "../../components/ui/Button";

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
  const [selectedType, setSelectedType] = useState("cooking");

  // Hide Android navigation bar
  const navigationBar = useNavigationBar();
  navigationBar.useHidden();

  // Fetch logs from coolingreheating collection with date filter
  const fetchLogs = async () => {
    if (!restaurantId) return;

    try {
      console.log('🔍 Fetching cooking & reheating logs for restaurant:', restaurantId);

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

      console.log('📋 Fetched cooking & reheating logs:', allLogs.length);
      setLogs(allLogs);
    } catch (error) {
      console.error('❌ Error fetching cooking & reheating logs:', error);
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

      console.log('✅ Cooking & reheating log saved successfully');
      
      // Reset form
      setFoodItem("");
      setTemperature("");
      setSelectedType("cooking");
      setShowAddModal(false);
      
      // Refresh logs
      fetchLogs();
    } catch (error) {
      console.error('❌ Error saving cooking & reheating log:', error);
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
          <Text style={styles.title}>Cooking & Reheating</Text>
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
                    <View style={[styles.typeBadge, log.type === 'cooking' ? styles.cookingBadge : styles.reheatingBadge]}>
                      <Ionicons 
                        name={log.type === 'cooking' ? 'restaurant' : 'flame'} 
                        size={12} 
                        color={log.type === 'cooking' ? '#22c55e' : '#f97316'} 
                      />
                      <Text style={[styles.typeText, log.type === 'cooking' ? styles.cookingText : styles.reheatingText]}>
                        {log.type === 'cooking' ? 'Cooking' : 'Reheating'}
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
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.backdrop} onPress={() => setShowAddModal(false)} activeOpacity={1} />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.modalContainer}
          >
            <View style={styles.modal}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <View style={styles.titleContainer}>
                  <Text style={styles.modalTitle}>Add Temperature Log</Text>
                  <Text style={styles.date}>{formatSelectedDate(selectedDate)}</Text>
                </View>
                <TouchableOpacity style={styles.closeButton} onPress={() => setShowAddModal(false)} activeOpacity={0.7}>
                  <Text style={styles.closeText}>×</Text>
                </TouchableOpacity>
              </View>

              {/* Scrollable Form */}
              <ScrollView
                style={styles.formScrollView}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.form}>
                  <Text style={styles.label}>Food Item</Text>
                  <TextInput
                    style={styles.input}
                    value={foodItem}
                    onChangeText={setFoodItem}
                    placeholder="Enter food item name"
                    placeholderTextColor={Colors.gray200}
                    autoFocus
                  />

                  {/* Type Selection */}
                  <Text style={[styles.label, { marginTop: Spacing.lg }]}>Type</Text>
                  <View style={styles.typeSelector}>
                    <TouchableOpacity
                      style={[
                        styles.typeChip,
                        selectedType === 'cooking' && styles.activeTypeChip,
                      ]}
                      onPress={() => setSelectedType('cooking')}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="restaurant" size={16} color={selectedType === 'cooking' ? '#fff' : '#22c55e'} />
                      <Text
                        style={[
                          styles.typeText,
                          selectedType === 'cooking' && styles.activeTypeText,
                        ]}
                      >
                        Cooking
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.typeChip,
                        selectedType === 'reheating' && styles.activeTypeChip,
                      ]}
                      onPress={() => setSelectedType('reheating')}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="flame" size={16} color={selectedType === 'reheating' ? '#fff' : '#f97316'} />
                      <Text
                        style={[
                          styles.typeText,
                          selectedType === 'reheating' && styles.activeTypeText,
                        ]}
                      >
                        Reheating
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.label, { marginTop: Spacing.lg }]}>Temperature (°C)</Text>
                  <TextInput
                    style={styles.input}
                    value={temperature}
                    onChangeText={setTemperature}
                    placeholder="Enter temperature"
                    placeholderTextColor={Colors.gray200}
                    keyboardType="numeric"
                  />
                </View>
              </ScrollView>

              {/* Save Button */}
              <View style={styles.buttonContainer}>
                <Button onPress={handleSaveLog} disabled={!foodItem.trim() || !temperature.trim()} fullWidth size="lg">
                  Save Log
                </Button>
              </View>
            </View>
          </KeyboardAvoidingView>
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
  cookingBadge: {
    backgroundColor: "#f0fdf4",
  },
  reheatingBadge: {
    backgroundColor: "#fff7ed",
  },
  typeText: {
    fontSize: 12,
    fontFamily: Typography.fontMedium,
    marginLeft: 4,
  },
  cookingText: {
    color: "#22c55e",
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
  modalContainer: {
    maxHeight: '80%',
  },
  modal: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    maxHeight: '100%',
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.xl,
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
  title: {
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
  formScrollView: {
    flexGrow: 0,
  },
  form: {
    paddingBottom: Spacing.md,
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
  buttonContainer: {
    marginTop: "auto",
  },
  typeSelector: {
    flexDirection: "row",
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  typeChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.gray100,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  activeTypeChip: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  typeText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.medium,
    marginLeft: Spacing.xs,
  },
  activeTypeText: {
    color: Colors.background,
  },
});
