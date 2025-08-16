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

export default function DeliveryTempLogsScreen({ navigation }) {
  const { restaurantId } = useRestaurant();
  const [suppliers, setSuppliers] = useState([]);
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
    
    const snapshot = await getDocs(getRestaurantCollection(restaurantId, "deliverylogs"));
    const fetched = snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        supplier: data.supplier,
        createdAt: data.createdAt?.seconds
          ? new Date(data.createdAt.seconds * 1000)
          : new Date(),
        temps: data.temps || { frozen: "", chilled: "" },
      };
    });
    // Sort by createdAt descending
    fetched.sort((a, b) => b.createdAt - a.createdAt);
    setLogs(fetched);
  };

  // Fetch data from Firestore
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchSuppliers(), fetchLogs()]);
      setLoading(false);
      setRefreshing(false);
    };
    loadData();
  }, [restaurantId]);

  // Pull to refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchSuppliers(), fetchLogs()]);
    setRefreshing(false);
  };

  // Create or update delivery log for a supplier
  const handleCreateOrUpdateLog = async (supplierName) => {
    if (!restaurantId || !auth.currentUser) return;
    
    try {
      // Check if a log already exists for this supplier today
      const existingLog = logs.find(log => log.supplier === supplierName);
      
      if (!existingLog) {
        // Create new log
        await addDoc(getRestaurantCollection(restaurantId, "deliverylogs"), {
          supplier: supplierName,
          createdAt: serverTimestamp(),
          createdBy: auth.currentUser.uid,
          restaurantId: restaurantId,
          temps: { frozen: "", chilled: "" },
        });
        
        // Refresh logs
        await fetchLogs();
      }
    } catch (error) {
      console.error("Error creating delivery log:", error);
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

  // Set temperature handler (updates local state immediately, Firestore with debounce)
  const handleSetTemp = async (supplierName, logId, type, value) => {
    // Ensure the value is negative or empty
    let processedValue = value;
    if (value && !value.startsWith('-') && value !== '') {
      processedValue = '-' + value;
    }
    
    // If this is a placeholder (no log exists), create the log first
    if (!logId || logId.startsWith('placeholder-')) {
      await handleCreateOrUpdateLog(supplierName);
      // Refresh to get the new log ID
      await fetchLogs();
      return;
    }
    
    // Update local state immediately for responsive UI
    setLogs(prev =>
      prev.map(l =>
        l.id === logId ? { ...l, temps: { ...l.temps, [type]: processedValue } } : l
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
        await updateDoc(getRestaurantDoc(restaurantId, "deliverylogs", logId), {
          [`temps.${type}`]: processedValue,
        });
        console.log(`Updated ${type} temperature for ${logId}: ${processedValue}`);
      } catch (error) {
        console.error("Error updating temperature:", error);
        // Optionally revert the local state on error
        // fetchLogs(); // Uncomment if you want to revert on error
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
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
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
              <Text style={styles.title}>Delivery Temp Logs</Text>
              <Text style={styles.date}>{todayString}</Text>
            </View>
          </View>
        </View>

        {/* Suppliers Section */}
        <Text style={styles.suppliersTitle}>Suppliers</Text>
        <View style={{ marginTop: 12 }}>
          {loading ? (
            <ActivityIndicator size="large" style={{ marginTop: 40 }} />
          ) : (
            getCombinedSupplierData().map((supplierData) => (
              <Swipeable
                key={supplierData.id}
                renderRightActions={() => !supplierData.isPlaceholder ? renderRightActions(supplierData.id) : null}
                overshootRight={false}
                containerStyle={styles.swipeableContainer}
              >
                <View style={styles.supplierCard}>
                  <TouchableOpacity
                    style={styles.supplierHeader}
                    onPress={() =>
                      setExpanded((prev) => ({
                        ...prev,
                        [supplierData.id]: !prev[supplierData.id],
                      }))
                    }
                    activeOpacity={0.8}
                  >
                  <View>
                    <Text style={styles.supplierName}>{supplierData.supplier}</Text>
                    <Text style={styles.supplierTime}>
                      {supplierData.isPlaceholder ? (
                        "Not logged today"
                      ) : (
                        `Today - ${
                          supplierData.createdAt
                            ? supplierData.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                            : "--:--"
                        }`
                      )}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[styles.tempValue, { color: "#2563eb" }]}>
                      {supplierData.temps.frozen
                        ? `${supplierData.temps.frozen}°C`
                        : "--°C"}
                    </Text>
                    <Text style={styles.tempValue}>
                      {supplierData.temps.chilled
                        ? `${supplierData.temps.chilled}°C`
                        : "--°C"}
                    </Text>
                  </View>
                </TouchableOpacity>
                {expanded[supplierData.id] && (
                  <View style={styles.tempInputsContainer}>
                    <View style={styles.tempInputCard}>
                      <Text style={styles.tempInputLabel}>Set Temperature</Text>
                      <Text style={styles.tempInputType}>Frozen Items</Text>
                      <View style={styles.tempInputRow}>
                        <TextInput
                          style={styles.tempInput}
                          value={supplierData.temps.frozen}
                          onChangeText={(val) => handleSetTemp(supplierData.supplier, supplierData.id, "frozen", val)}
                          placeholder="--"
                          placeholderTextColor="#A0A7B3"
                          keyboardType="numeric"
                        />
                        <Text style={styles.tempUnit}>℃</Text>
                      </View>
                    </View>
                    <View style={styles.tempInputCard}>
                      <Text style={styles.tempInputLabel}>Set Temperature</Text>
                      <Text style={styles.tempInputType}>Chilled Items</Text>
                      <View style={styles.tempInputRow}>
                        <TextInput
                          style={styles.tempInput}
                          value={supplierData.temps.chilled}
                          onChangeText={(val) => handleSetTemp(supplierData.supplier, supplierData.id, "chilled", val)}
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
  safeArea: { flex: 1, backgroundColor: "#fff" },
  appTitle: {
    fontFamily: Typography.fontBold,
    fontSize: 28,
    color: "#2563eb",
    textAlign: "center",
    marginTop: 12,
    marginBottom: 8,
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
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  suppliersTitle: {
    fontSize: 22,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
    marginLeft: Spacing.lg,
    marginTop: Spacing.lg,
    marginBottom: 8,
  },
  supplierCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  supplierHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  supplierName: {
    fontFamily: Typography.fontBold,
    fontSize: 18,
    color: "#111",
  },
  supplierTime: {
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
