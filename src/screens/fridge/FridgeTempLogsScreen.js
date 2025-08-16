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
} from "react-native";
import { Ionicons, Feather } from "@expo/vector-icons";
import { Swipeable } from "react-native-gesture-handler";
import { getDocs, addDoc, serverTimestamp, doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { useRestaurant } from "../../contexts/RestaurantContext";
import { getRestaurantCollection, getRestaurantDoc } from "../../utils/firestoreHelpers";
import { auth } from "../../../firebase";
import { Colors } from "../../constants/Colors";
import { Typography } from "../../constants/Typography";
import { Spacing } from "../../constants/Spacing";
import { getAndroidTitleMargin } from "../../utils/responsive";
import useNavigationBar from "../../hooks/useNavigationBar";
import AddFridgeTempModal from "./AddFridgeTempModal";
export default function FridgeTempLogsScreen({ navigation }) {
  const { restaurantId } = useRestaurant();
  const [selectedTab, setSelectedTab] = useState("AM");
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const navigationBar = useNavigationBar();
  navigationBar.useHidden();
  const [fridgeNames, setFridgeNames] = useState([]);
  const [loadingFridges, setLoadingFridges] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const fetchLogs = async () => {
    if (!restaurantId) return;
    try {
      console.log('🔍 Fetching fridge logs for restaurant:', restaurantId);
      const fridgeLogsCollection = getRestaurantCollection(restaurantId, 'fridgelogs');
      const logsSnapshot = await getDocs(fridgeLogsCollection);
      let allLogs = [];
      logsSnapshot.forEach(docSnap => {
        const data = docSnap.data();
        allLogs.push({
          id: docSnap.id,
          ...data,
        });
      });
      allLogs.sort((a, b) => {
        if (a.createdAt && b.createdAt) {
          return b.createdAt.seconds - a.createdAt.seconds;
        }
        return 0;
      });
      console.log(`Fetched ${allLogs.length} fridge logs`);
      setLogs(allLogs);
    } catch (error) {
      console.error('Error fetching fridge logs:', error);
    }
  };
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      await fetchLogs();
      setLoading(false);
    };
    loadInitialData();
  }, [selectedTab, restaurantId]);
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchLogs();
    setRefreshing(false);
  };
  useEffect(() => {
    const fetchFridges = async () => {
      if (!restaurantId) return;
      setLoadingFridges(true);
      try {
        console.log('🔍 Fetching fridges array from restaurant:', restaurantId);
        const fridgesDocRef = getRestaurantDoc(restaurantId, 'fridges', 'fridges');
        const fridgesDoc = await getDoc(fridgesDocRef);
        if (fridgesDoc.exists()) {
          const data = fridgesDoc.data();
          const fridgesArray = data.names || [];
          console.log('Fetched fridges:', fridgesArray);
          setFridgeNames(fridgesArray);
        } else {
          console.log('Fridges document not found, no fridges available');
          setFridgeNames([]);
        }
      } catch (error) {
        console.error('Error fetching fridges:', error);
        setFridgeNames([]);
      } finally {
        setLoadingFridges(false);
      }
    };
    fetchFridges();
  }, [restaurantId]);
  const formatTime = (createdAt) => {
    if (!createdAt) return "--:--";
    const date = new Date(createdAt.seconds * 1000);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
  const handleSaveTemp = async (fridgeName, tempValue) => {
    if (!restaurantId || !auth.currentUser) {
      console.error('Missing restaurant ID or user authentication');
      return;
    }
    try {
      console.log('Saving fridge temperature log...');
      console.log('Received temperature value:', tempValue, 'Type:', typeof tempValue);
      if (!tempValue || tempValue.trim() === '') {
        console.error('Empty temperature value');
        return;
      }
      const tempNumber = parseFloat(tempValue);
      if (isNaN(tempNumber)) {
        console.error('Invalid temperature value:', tempValue);
        return;
      }
      console.log('Temperature string to save:', tempValue);
      const fridgeLogData = {
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser.uid,
        temperature: tempValue,
        fridge: fridgeName,
        restaurantId: restaurantId,
      };
      console.log('Fridge log data:', fridgeLogData);
      const fridgeLogsCollection = getRestaurantCollection(restaurantId, 'fridgelogs');
      const docRef = await addDoc(fridgeLogsCollection, fridgeLogData);
      console.log('Fridge log saved with ID:', docRef.id);
      await fetchLogs();
      setModalVisible(false);
    } catch (error) {
      console.error('Error saving fridge log:', error);
    }
  };
  const deleteLog = async (logId) => {
    if (!restaurantId) return;
    try {
      await deleteDoc(getRestaurantDoc(restaurantId, "fridgelogs", logId));
      setLogs((logs) => logs.filter((log) => log.id !== logId));
    } catch (error) {
      console.error("Error deleting fridge log:", error);
    }
  };
  const getPeriod = (createdAt) => {
    if (!createdAt) return null;
    const date = new Date(createdAt.seconds * 1000);
    const hour = date.getHours();
    return hour < 12 ? "AM" : "PM";
  };
  const filteredLogs = logs.filter(
    (log) => getPeriod(log.createdAt) === selectedTab
  );
  const today = new Date();
  const dayName = today.toLocaleDateString(undefined, { weekday: "long" });
  const monthName = today.toLocaleDateString(undefined, { month: "long" });
  const dayNum = today.getDate();
  const todayString = `${dayName}, ${monthName} ${dayNum}`;
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
        <View style={styles.header}>
          <View style={styles.backHeader}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
              <Text style={styles.backArrow}>‹</Text>
            </TouchableOpacity>
            <View style={styles.titleContainer}>
              <Text style={styles.title}>Fridge Temperature Logs</Text>
              <Text style={styles.date}>{todayString}</Text>
            </View>
          </View>
        </View>
        <View style={styles.tabsRow}>
          <TouchableOpacity onPress={() => setSelectedTab("AM")}>
            <Text style={[styles.tabText, selectedTab === "AM" && styles.tabTextActive]}>
              AM
            </Text>
            {selectedTab === "AM" && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setSelectedTab("PM")}>
            <Text style={[styles.tabText, selectedTab === "PM" && styles.tabTextActive]}>
              PM
            </Text>
            {selectedTab === "PM" && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
        </View>
        <View style={{ marginTop: 12 }}>
          {loading ? (
            <ActivityIndicator size="large" style={{ marginTop: 40 }} />
          ) : (
            filteredLogs.length === 0 ? (
              <Text style={{ textAlign: "center", color: "#888", marginTop: 40 }}>No logs found.</Text>
            ) : (
              filteredLogs.map((log, idx) => (
                <Swipeable
                  key={log.id}
                  renderRightActions={() => renderRightActions(log.id)}
                  overshootRight={false}
                  containerStyle={{ backgroundColor: "transparent" }}
                >
                  <View style={styles.logCard}>
                    <View style={styles.logLeft}>
                      <View>
                        <Text style={styles.logName}>{log.fridge}</Text>
                        <Text style={styles.logTime}>{formatTime(log.createdAt)}</Text>
                      </View>
                    </View>
                    <View style={styles.logRight}>
                      <Text style={styles.logTemp}>
                        {log.temperature ? `${log.temperature}℃` : "--℃"}
                      </Text>
                    </View>
                  </View>
                </Swipeable>
              ))
            )
          )}
        </View>
      </ScrollView>
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={38} color="#fff" />
      </TouchableOpacity>
      <AddFridgeTempModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSave={handleSaveTemp}
        fridgeNames={fridgeNames}
        loadingFridges={loadingFridges}
      />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  appTitle: {
    fontFamily: Typography.fontBold,
    fontSize: 28,
    color: "#2563eb",
    textAlign: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg + getAndroidTitleMargin(),
    paddingBottom: Spacing.md,
  },
  backHeader: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    width: "100%",
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
  titleContainer: {
    flex: 1,
  },
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
  tabsRow: {
    flexDirection: "row",
    marginLeft: 30,
    marginTop: 16,
    marginBottom: 8,
    gap: 32,
  },
  tabText: {
    fontFamily: Typography.fontMedium,
    fontSize: 18,
    color: "#6B7280",
  },
  tabTextActive: {
    color: "#2563eb",
  },
  tabUnderline: {
    height: 3,
    backgroundColor: "#2563eb",
    borderRadius: 2,
    marginTop: 2,
    width: 28,
    alignSelf: "center",
  },
  logCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
    justifyContent: "space-between",
  },
  logLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  logName: {
    fontFamily: Typography.fontMedium,
    fontSize: 18,
    color: "#111",
  },
  logTime: {
    fontFamily: Typography.fontRegular,
    fontSize: 16,
    color: "#8B96A5",
    marginTop: 2,
  },
  logRight: {
    alignItems: "flex-end",
    minWidth: 60,
  },
  logTemp: {
    fontFamily: Typography.fontBold,
    fontSize: 16,
    color: "#111",
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
});