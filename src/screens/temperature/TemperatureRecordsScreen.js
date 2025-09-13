import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography } from '../../constants';
import { getFormattedTodayDate } from '../../utils/dateUtils';
import { getAndroidTitleMargin } from '../../utils/responsive';
import { getDocs, query, orderBy } from "firebase/firestore";
import { useRestaurant } from "../../contexts/RestaurantContext";
import { getRestaurantCollection } from "../../utils/firestoreHelpers";

const TemperatureRecordsScreen = ({ navigation }) => {
  const { restaurantId } = useRestaurant();
  const [fridgeLogs, setFridgeLogs] = useState([]);
  const [deliveryLogs, setDeliveryLogs] = useState([]);
  const [coolingReheatingLogs, setCoolingReheatingLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Date for header
  const today = getFormattedTodayDate();

  const fetchTemperatureRecords = async () => {
    if (!restaurantId) return;
    
    setLoading(true);
    try {
      // Fetch fridge logs from /restaurants/{restaurantId}/fridgelogs
      const fridgeQuery = query(getRestaurantCollection(restaurantId, "fridgelogs"), orderBy("createdAt", "desc"));
      const fridgeSnapshot = await getDocs(fridgeQuery);
      const fridgeItems = fridgeSnapshot.docs.map(doc => ({
        id: doc.id,
        type: 'fridge',
        ...doc.data(),
      }));
      setFridgeLogs(fridgeItems);

      // Fetch delivery logs from /restaurants/{restaurantId}/deliverylogs
      const deliveryQuery = query(getRestaurantCollection(restaurantId, "deliverylogs"), orderBy("createdAt", "desc"));
      const deliverySnapshot = await getDocs(deliveryQuery);
      const deliveryItems = deliverySnapshot.docs.map(doc => ({
        id: doc.id,
        type: 'delivery',
        ...doc.data(),
      }));
      setDeliveryLogs(deliveryItems);

      // Fetch cooling and reheating logs from /restaurants/{restaurantId}/coolingreheating
      const coolingReheatingQuery = query(getRestaurantCollection(restaurantId, "coolingreheating"), orderBy("createdAt", "desc"));
      const coolingReheatingSnapshot = await getDocs(coolingReheatingQuery);
      const coolingReheatingItems = coolingReheatingSnapshot.docs.map(doc => ({
        id: doc.id,
        type: 'coolingreheating',
        ...doc.data(),
      }));
      setCoolingReheatingLogs(coolingReheatingItems);
    } catch (error) {
      console.error("Error fetching temperature records:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemperatureRecords();
  }, [restaurantId]);

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTemperatureRecords();
    setRefreshing(false);
  }, []);

  const renderFridgeItem = ({ item }) => (
    <View style={styles.recordCard}>
      <View style={styles.recordInfo}>
        <Text style={styles.recordType}>Fridge Temperature</Text>
        <Text style={styles.recordLocation}>{item.fridgeName || 'Unknown Fridge'}</Text>
        <Text style={styles.recordDate}>
          {item.date || (item.createdAt?.seconds 
            ? new Date(item.createdAt.seconds * 1000).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
            : 'Unknown Date')}
        </Text>
      </View>
      <View style={styles.temperatureContainer}>
        <Text style={styles.temperatureValue}>
          AM: {item.temperatureAM || '--'}°C
        </Text>
        <Text style={styles.temperatureSubValue}>
          PM: {item.temperaturePM || '--'}°C
        </Text>
        {item.done && (
          <Ionicons name="checkmark-circle" size={20} color="#4CAF50" style={{ marginTop: 4 }} />
        )}
      </View>
    </View>
  );

    const renderDeliveryItem = ({ item }) => (
    <View style={styles.recordCard}>
      <View style={styles.recordInfo}>
        <Text style={styles.recordType}>Delivery Temperature</Text>
        <Text style={styles.recordLocation}>{item.supplierName || 'Unknown Supplier'}</Text>
        <Text style={styles.recordDate}>
          {item.date || (item.createdAt?.seconds 
            ? new Date(item.createdAt.seconds * 1000).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
            : 'Unknown Date')}
        </Text>
      </View>
      <View style={styles.temperatureContainer}>
        <Text style={styles.temperatureValue}>
          Frozen: {item.frozen || '--'}°C
        </Text>
        <Text style={styles.temperatureSubValue}>
          Chilled: {item.chilled || '--'}°C
        </Text>
        {item.done && (
          <Ionicons name="checkmark-circle" size={20} color="#4CAF50" style={{ marginTop: 4 }} />
        )}
      </View>
    </View>
  );

  const renderCoolingReheatingItem = ({ item }) => (
    <View style={styles.recordCard}>
      <View style={styles.recordInfo}>
        <Text style={styles.recordType}>
          {item.type === 'cooling' ? 'Cooling' : 'Reheating'} Temperature
        </Text>
        <Text style={styles.recordLocation}>{item.item || 'Unknown Item'}</Text>
        <Text style={styles.recordDate}>
          {item.createdAt?.seconds 
            ? new Date(item.createdAt.seconds * 1000).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
            : 'Unknown Date'}
        </Text>
      </View>
      <View style={styles.temperatureContainer}>
        <View style={[styles.typeBadge, item.type === 'cooling' ? styles.coolingBadge : styles.reheatingBadge]}>
          <Ionicons 
            name={item.type === 'cooling' ? 'snow' : 'flame'} 
            size={12} 
            color={item.type === 'cooling' ? '#0ea5e9' : '#f97316'} 
          />
          <Text style={[styles.typeText, item.type === 'cooling' ? styles.coolingText : styles.reheatingText]}>
            {item.type === 'cooling' ? 'Cooling' : 'Reheating'}
          </Text>
        </View>
        <Text style={styles.temperatureValue}>
          {item.temperature || '--'}°C
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Temperature Records</Text>
          <Text style={styles.date}>{today}</Text>
        </View>
      </View>

      {/* Section Headers and Lists */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Fridge Temperature Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Fridge Temperature Logs ({fridgeLogs.length})</Text>
          <TouchableOpacity onPress={() => navigation.navigate('TemperatureDownloads')}>
            <Text style={styles.download}>Download</Text>
          </TouchableOpacity>
        </View>
        
        <FlatList
          data={fridgeLogs} // Show all fridge logs
          keyExtractor={item => `fridge-${item.id}`}
          renderItem={renderFridgeItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          scrollEnabled={false} // Disable internal scrolling since we're using ScrollView
          nestedScrollEnabled={true}
        />

        {/* Delivery Temperature Section */}
        <View style={[styles.sectionHeader, { marginTop: Spacing.xl }]}>
          <Text style={styles.sectionTitle}>Delivery Temperature Logs ({deliveryLogs.length})</Text>
        </View>
        
        <FlatList
          data={deliveryLogs} // Show all delivery logs
          keyExtractor={item => `delivery-${item.id}`}
          renderItem={renderDeliveryItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          scrollEnabled={false} // Disable internal scrolling since we're using ScrollView
          nestedScrollEnabled={true}
        />

        {/* Cooling & Reheating Temperature Section */}
        <View style={[styles.sectionHeader, { marginTop: Spacing.xl }]}>
          <Text style={styles.sectionTitle}>Cooling & Reheating Logs ({coolingReheatingLogs.length})</Text>
        </View>
        
        <FlatList
          data={coolingReheatingLogs} // Show all cooling & reheating logs
          keyExtractor={item => `coolingreheating-${item.id}`}
          renderItem={renderCoolingReheatingItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          scrollEnabled={false} // Disable internal scrolling since we're using ScrollView
          nestedScrollEnabled={true}
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundPrimary,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
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
  titleContainer: {
    flex: 1,
  },
  title: {
    fontFamily: Typography.fontBold,
    fontSize: Typography.xl,
    color: Colors.textPrimary,
    fontWeight: 'bold',
  },
  date: {
    ...Typography.body,
    color: Colors.gray400,
    marginTop: 2,
  },
  content: {
    flex: 1,
    paddingBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.md,
  },
  sectionTitle: {
    fontFamily: Typography.fontBold,
    fontSize: Typography.lg,
    color: Colors.textPrimary,
    fontWeight: 'bold',
  },
  download: {
    fontFamily: Typography.fontMedium,
    color: Colors.primary,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
  },
  recordCard: {
    backgroundColor: Colors.gray100,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  recordInfo: {
    flex: 1,
  },
  recordType: {
    ...Typography.h4,
    color: Colors.textPrimary,
    fontWeight: '600',
    marginBottom: 4,
  },
  recordLocation: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginBottom: 2,
  },
  recordDate: {
    fontSize: Typography.sm,
    color: Colors.gray400,
  },
  temperatureContainer: {
    alignItems: 'flex-end',
  },
  temperatureValue: {
    ...Typography.h4,
    color: Colors.primary,
    fontWeight: '600',
  },
  temperatureSubValue: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginTop: 2,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  coolingBadge: {
    backgroundColor: '#eff6ff',
  },
  reheatingBadge: {
    backgroundColor: '#fff7ed',
  },
  typeText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  coolingText: {
    color: '#0ea5e9',
  },
  reheatingText: {
    color: '#f97316',
  },
});

export default TemperatureRecordsScreen;
