import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  FlatList,
  RefreshControl,
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
function AddSupplierModal({ visible, onClose, onAdd, date }) {
  const { restaurantId } = useRestaurant();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState("");
  useEffect(() => {
    const fetchSuppliers = async () => {
      if (!visible || !restaurantId) return;
      setLoading(true);
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
      } finally {
        setLoading(false);
      }
    };
    fetchSuppliers();
  }, [visible, restaurantId]);
  const handleAdd = () => {
    if (selectedSupplier.trim()) {
      onAdd(selectedSupplier.trim());
      setSelectedSupplier("");
      onClose();
    }
  };
  React.useEffect(() => {
    if (!visible) {
      setSelectedSupplier("");
    }
  }, [visible]);
  const renderSupplierItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.supplierOption,
        selectedSupplier === item && styles.supplierOptionSelected
      ]}
      onPress={() => setSelectedSupplier(item)}
      activeOpacity={0.7}
    >
      <Text style={[
        styles.supplierOptionText,
        selectedSupplier === item && styles.supplierOptionTextSelected
      ]}>
        {item}
      </Text>
      {selectedSupplier === item && (
        <Ionicons name="checkmark" size={20} color="#2563eb" />
      )}
    </TouchableOpacity>
  );
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <View style={styles.titleContainer}>
                <Text style={styles.modalTitle}>Select Supplier</Text>
                {date && <Text style={styles.modalDate}>{date}</Text>}
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
                <Text style={styles.closeText}>×</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.suppliersList}>
              {loading ? (
                <ActivityIndicator size="large" color="#2563eb" style={{ marginVertical: 20 }} />
              ) : suppliers.length > 0 ? (
                <FlatList
                  data={suppliers}
                  renderItem={renderSupplierItem}
                  keyExtractor={(item, index) => index.toString()}
                  showsVerticalScrollIndicator={false}
                  style={{ maxHeight: 300 }}
                />
              ) : (
                <Text style={styles.noSuppliersText}>No suppliers found</Text>
              )}
            </View>
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[
                  styles.addButton,
                  !selectedSupplier.trim() && { backgroundColor: Colors.gray200 },
                ]}
                onPress={handleAdd}
                disabled={!selectedSupplier.trim()}
              >
                <Text style={styles.addButtonText}>Add Supplier</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
export default function DeliveryTempLogsScreen({ navigation }) {
  const { restaurantId } = useRestaurant();
  const [modalVisible, setModalVisible] = useState(false);
  const [logs, setLogs] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigationBar = useNavigationBar();
  navigationBar.useHidden();
  const today = new Date();
  const dayName = today.toLocaleDateString(undefined, { weekday: "long" });
  const monthName = today.toLocaleDateString(undefined, { month: "long" });
  const dayNum = today.getDate();
  const todayString = `${dayName}, ${monthName} ${dayNum}`;
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
    fetched.sort((a, b) => b.createdAt - a.createdAt);
    setLogs(fetched);
  };
  useEffect(() => {
    const loadLogs = async () => {
      setLoading(true);
      await fetchLogs();
      setLoading(false);
      setRefreshing(false);
    };
    loadLogs();
  }, [restaurantId]);
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLogs();
    setRefreshing(false);
  };
  const handleAddSupplier = async (supplierName) => {
    if (!restaurantId || !auth.currentUser) return;
    try {
      await addDoc(getRestaurantCollection(restaurantId, "deliverylogs"), {
        supplier: supplierName,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser.uid,
        restaurantId: restaurantId,
        temps: { frozen: "", chilled: "" },
      });
      await fetchLogs();
    } catch (error) {
      console.error("Error adding delivery log:", error);
    }
  };
  const handleSetTemp = async (logId, type, value) => {
    if (!restaurantId) return;
    const log = logs.find(l => l.id === logId);
    if (!log) return;
    const newTemps = { ...log.temps, [type]: value };
    await updateDoc(getRestaurantDoc(restaurantId, "deliverylogs", logId), {
      temps: newTemps,
    });
    setLogs(prev =>
      prev.map(l =>
        l.id === logId ? { ...l, temps: newTemps } : l
      )
    );
  };
  const deleteLog = async (logId) => {
    if (!restaurantId) return;
    try {
      await deleteDoc(getRestaurantDoc(restaurantId, "deliverylogs", logId));
      setLogs((logs) => logs.filter((log) => log.id !== logId));
    } catch (error) {
      console.error("Error deleting delivery log:", error);
    }
  };
  const renderRightActions = (logId) => (
    <View style={{ flex: 1, justifyContent: "center" }}>
      <TouchableOpacity
        style={{
          backgroundColor: "#FF3B30",
          justifyContent: "center",
          alignItems: "center",
          width: 90,
          height: "80%",
          borderRadius: 16,
          marginVertical: 8,
          alignSelf: "flex-end",
        }}
        onPress={() => deleteLog(logId)}
        activeOpacity={0.8}
      >
        <Text style={{ color: "white", fontWeight: "bold", fontSize: 16 }}>Delete</Text>
      </TouchableOpacity>
    </View>
  );
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
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
        <Text style={styles.suppliersTitle}>Suppliers</Text>
        <View style={{ marginTop: 12 }}>
          {loading ? (
            <ActivityIndicator size="large" style={{ marginTop: 40 }} />
          ) : (
            logs.map((log) => (
              <Swipeable
                key={log.id}
                renderRightActions={() => renderRightActions(log.id)}
                overshootRight={false}
                containerStyle={{ backgroundColor: "transparent" }}
              >
                <View style={styles.supplierCard}>
                  <TouchableOpacity
                    style={styles.supplierHeader}
                    onPress={() =>
                      setExpanded((prev) => ({
                        ...prev,
                        [log.id]: !prev[log.id],
                      }))
                    }
                    activeOpacity={0.8}
                  >
                    <View>
                      <Text style={styles.supplierName}>{log.supplier}</Text>
                      <Text style={styles.supplierTime}>
                        Today -{" "}
                        {log.createdAt
                          ? log.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                          : "--:--"}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={[styles.tempValue, { color: "#2563eb" }]}>
                        {log.temps.frozen
                          ? `${log.temps.frozen}°C`
                          : "--°C"}
                      </Text>
                      <Text style={styles.tempValue}>
                        {log.temps.chilled
                          ? `${log.temps.chilled}°C`
                          : "--°C"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  {expanded[log.id] && (
                    <View style={styles.tempInputsContainer}>
                      <View style={styles.tempInputCard}>
                        <Text style={styles.tempInputLabel}>Set Temperature</Text>
                        <Text style={styles.tempInputType}>Frozen Items</Text>
                        <View style={styles.tempInputRow}>
                          <TextInput
                            style={styles.tempInput}
                            value={log.temps.frozen}
                            onChangeText={(val) => handleSetTemp(log.id, "frozen", val)}
                            placeholder="--"
                            placeholderTextColor="#A0A7B3"
                            keyboardType="decimal-pad"
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
                            value={log.temps.chilled}
                            onChangeText={(val) => handleSetTemp(log.id, "chilled", val)}
                            placeholder="--"
                            placeholderTextColor="#A0A7B3"
                            keyboardType="decimal-pad"
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
      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Ionicons name="add" size={38} color="#fff" />
      </TouchableOpacity>
      <AddSupplierModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onAdd={handleAddSupplier}
        date={todayString}
      />
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
    marginHorizontal: 16,
    marginBottom: 18,
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
  fab: {
    position: "absolute",
    right: 40,
    bottom: 70,
    width: 72,
    height: 72,
    borderRadius: 50,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
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
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    minHeight: 400,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.xl,
  },
  modalTitle: {
    fontSize: Typography.xl,
    fontWeight: "bold",
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  modalDate: {
    fontSize: Typography.md,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  closeText: {
    fontSize: 24,
    color: Colors.textSecondary,
    fontWeight: "300",
  },
  suppliersList: {
    flex: 1,
    marginBottom: Spacing.xl,
  },
  supplierOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: "#f8fafc",
  },
  supplierOptionSelected: {
    backgroundColor: "#e0f2fe",
    borderColor: "#2563eb",
    borderWidth: 1,
  },
  supplierOptionText: {
    fontSize: Typography.base,
    color: Colors.textPrimary,
    fontWeight: "500",
  },
  supplierOptionTextSelected: {
    color: "#2563eb",
    fontWeight: "600",
  },
  noSuppliersText: {
    textAlign: "center",
    fontSize: Typography.base,
    color: Colors.textSecondary,
    marginVertical: 20,
  },
  form: {
    marginBottom: Spacing.xl,
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
  addButton: {
    backgroundColor: "#2563eb",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonText: {
    color: "#fff",
    fontFamily: Typography.fontBold,
    fontSize: 20,
  },
});
