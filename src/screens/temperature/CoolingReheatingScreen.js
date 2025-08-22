import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { Colors, Spacing, Typography } from '../../constants';
import { getAndroidTitleMargin } from '../../utils/responsive';
import useNavigationBar from '../../hooks/useNavigationBar';
import { addDoc, getDocs, deleteDoc, serverTimestamp, query, where, orderBy } from "firebase/firestore";
import { useRestaurant } from "../../contexts/RestaurantContext";
import { getRestaurantCollection } from "../../utils/firestoreHelpers";

const CoolingReheatingScreen = ({ navigation }) => {
  const { restaurantId } = useRestaurant();
  const [logs, setLogs] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [newItem, setNewItem] = useState('');
  const [newType, setNewType] = useState('cooling');
  const [newTemperature, setNewTemperature] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Hide Android navigation bar
  const navigationBar = useNavigationBar();
  navigationBar.useHidden();

  // Date formatting
  const formatSelectedDate = (date) => {
    const dayName = date.toLocaleDateString(undefined, { weekday: "long" });
    const monthName = date.toLocaleDateString(undefined, { month: "long" });
    const dayNum = date.getDate();
    return `${dayName}, ${monthName} ${dayNum}`;
  };

  const todayString = formatSelectedDate(selectedDate);

  // Fetch logs from coolingreheating collection for the selected date
  const fetchLogs = async () => {
    if (!restaurantId) return;
    
    setLoading(true);
    try {
      const coolingReheatingCollection = getRestaurantCollection(restaurantId, 'coolingreheating');
      const logsSnapshot = await getDocs(coolingReheatingCollection);
      
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
      
      setLogs(filteredLogs);
    } catch (error) {
      console.error("Error fetching cooling/reheating logs:", error);
      Alert.alert('Error', 'Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [restaurantId, selectedDate]);

  const handleAddLog = async () => {
    if (!newItem.trim() || !newTemperature.trim()) {
      Alert.alert('Missing Information', 'Please fill in all fields');
      return;
    }

    if (!restaurantId) return;

    try {
      const selectedDateTimestamp = new Date(selectedDate);
      selectedDateTimestamp.setHours(12, 0, 0, 0);

      await addDoc(getRestaurantCollection(restaurantId, "coolingreheating"), {
        item: newItem.trim(),
        type: newType,
        temperature: newTemperature.trim(),
        createdAt: selectedDateTimestamp,
      });

      // Clear form
      setNewItem('');
      setNewTemperature('');
      setNewType('cooling');

      // Refresh logs
      fetchLogs();

      Alert.alert('Success', 'Log added successfully');
    } catch (error) {
      console.error("Error adding cooling/reheating log:", error);
      Alert.alert('Error', 'Failed to add log');
    }
  };

  const deleteLog = async (logId) => {
    if (!restaurantId) return;

    try {
      await deleteDoc(getRestaurantCollection(restaurantId, "coolingreheating", logId));
      fetchLogs();
      Alert.alert('Success', 'Log deleted successfully');
    } catch (error) {
      console.error("Error deleting log:", error);
      Alert.alert('Error', 'Failed to delete log');
    }
  };

  const handleDateConfirm = (selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setSelectedDate(selectedDate);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLogs();
    setRefreshing(false);
  };

  const renderRightActions = (logId) => (
    <TouchableOpacity
      style={styles.deleteButton}
      onPress={() => {
        Alert.alert(
          'Delete Log',
          'Are you sure you want to delete this log?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => deleteLog(logId) }
          ]
        );
      }}
    >
      <Ionicons name="trash-outline" size={24} color={Colors.white} />
    </TouchableOpacity>
  );

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
            <Text style={styles.title}>Cooling & Reheating</Text>
            <Text style={styles.subtitle}>Temperature Safety Logs</Text>
          </View>
          <View style={{ width: 28 }} />
        </View>

        {/* Date Selector */}
        <View style={styles.dateSection}>
          <TouchableOpacity
            style={styles.dateSelector}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
            <Text style={styles.dateText}>{todayString}</Text>
            <Ionicons name="chevron-down" size={16} color={Colors.gray400} />
          </TouchableOpacity>
        </View>

        {/* Input Form */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Add New Log</Text>
          
          {/* Food Item Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Food Item</Text>
            <TextInput
              style={styles.textInput}
              value={newItem}
              onChangeText={setNewItem}
              placeholder="Enter food item name"
              placeholderTextColor={Colors.gray400}
            />
          </View>

          {/* Type Selection */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Type</Text>
            <View style={styles.typeSelector}>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  newType === 'cooling' && styles.typeButtonActive
                ]}
                onPress={() => setNewType('cooling')}
              >
                <Ionicons 
                  name="snow-outline" 
                  size={20} 
                  color={newType === 'cooling' ? Colors.white : Colors.primary} 
                />
                <Text style={[
                  styles.typeButtonText,
                  newType === 'cooling' && styles.typeButtonTextActive
                ]}>
                  Cooling
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  newType === 'reheating' && styles.typeButtonActive
                ]}
                onPress={() => setNewType('reheating')}
              >
                <Ionicons 
                  name="flame-outline" 
                  size={20} 
                  color={newType === 'reheating' ? Colors.white : Colors.primary} 
                />
                <Text style={[
                  styles.typeButtonText,
                  newType === 'reheating' && styles.typeButtonTextActive
                ]}>
                  Reheating
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Temperature Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Temperature (°C)</Text>
            <TextInput
              style={styles.textInput}
              value={newTemperature}
              onChangeText={setNewTemperature}
              placeholder="Enter temperature"
              placeholderTextColor={Colors.gray400}
              keyboardType="numeric"
            />
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleAddLog}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle-outline" size={20} color={Colors.white} />
            <Text style={styles.saveButtonText}>Save Log</Text>
          </TouchableOpacity>
        </View>

        {/* Logs List */}
        <View style={styles.logsSection}>
          <Text style={styles.sectionTitle}>
            Today's Logs ({logs.length})
          </Text>
          
          {logs.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="thermometer-outline" size={48} color={Colors.gray300} />
              <Text style={styles.emptyStateText}>No logs for today</Text>
              <Text style={styles.emptyStateSubtext}>Add your first cooling or reheating log above</Text>
            </View>
          ) : (
            logs.map((log) => (
              <Swipeable
                key={log.id}
                renderRightActions={() => renderRightActions(log.id)}
                rightThreshold={40}
              >
                <View style={styles.logCard}>
                  <View style={styles.logHeader}>
                    <View style={[
                      styles.typeIndicator,
                      { backgroundColor: log.type === 'cooling' ? Colors.blue : Colors.orange }
                    ]}>
                      <Ionicons 
                        name={log.type === 'cooling' ? 'snow-outline' : 'flame-outline'} 
                        size={16} 
                        color={Colors.white} 
                      />
                      <Text style={styles.typeIndicatorText}>
                        {log.type === 'cooling' ? 'Cooling' : 'Reheating'}
                      </Text>
                    </View>
                    <Text style={styles.logTime}>
                      {log.createdAt ? log.createdAt.toDate().toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      }) : '--:--'}
                    </Text>
                  </View>
                  
                  <Text style={styles.logItem}>{log.item}</Text>
                  <Text style={styles.logTemperature}>{log.temperature}°C</Text>
                </View>
              </Swipeable>
            ))
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
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md + getAndroidTitleMargin(),
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray200,
  },
  backButton: {
    padding: Spacing.sm,
    marginLeft: -Spacing.sm,
  },
  backArrow: {
    fontSize: 32,
    color: Colors.textPrimary,
    fontWeight: 'bold',
  },
  headerInfo: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    ...Typography.h3,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  subtitle: {
    ...Typography.body,
    color: Colors.gray400,
    marginTop: 2,
  },
  dateSection: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dateText: {
    ...Typography.h4,
    color: Colors.textPrimary,
    fontWeight: '600',
    marginHorizontal: Spacing.sm,
  },
  formCard: {
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  formTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
    fontWeight: '600',
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  inputLabel: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '500',
    marginBottom: Spacing.sm,
  },
  textInput: {
    borderWidth: 2,
    borderColor: Colors.gray200,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: Typography.base,
    color: Colors.textPrimary,
    backgroundColor: Colors.gray50,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.gray200,
    backgroundColor: Colors.gray50,
    gap: Spacing.xs,
  },
  typeButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  typeButtonText: {
    ...Typography.body,
    color: Colors.primary,
    fontWeight: '500',
  },
  typeButtonTextActive: {
    color: Colors.white,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: 16,
    marginTop: Spacing.md,
    gap: Spacing.sm,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  saveButtonText: {
    ...Typography.body,
    color: Colors.white,
    fontWeight: '600',
  },
  logsSection: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  sectionTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    backgroundColor: Colors.gray50,
    borderRadius: 16,
    marginTop: Spacing.md,
  },
  emptyStateText: {
    ...Typography.h5,
    color: Colors.gray400,
    marginTop: Spacing.sm,
  },
  emptyStateSubtext: {
    ...Typography.body,
    color: Colors.gray400,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  logCard: {
    backgroundColor: Colors.white,
    padding: Spacing.md,
    borderRadius: 16,
    marginBottom: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  typeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 20,
    gap: Spacing.xs,
  },
  typeIndicatorText: {
    ...Typography.sm,
    color: Colors.white,
    fontWeight: '500',
  },
  logTime: {
    ...Typography.sm,
    color: Colors.gray400,
  },
  logItem: {
    ...Typography.h5,
    color: Colors.textPrimary,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  logTemperature: {
    ...Typography.h4,
    color: Colors.primary,
    fontWeight: '700',
  },
  deleteButton: {
    backgroundColor: Colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
  },
});

export default CoolingReheatingScreen; 
