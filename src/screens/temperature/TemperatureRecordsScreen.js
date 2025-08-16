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
import { getDocs, query, orderBy } from "firebase/firestore";
import { useRestaurant } from "../../contexts/RestaurantContext";
import { getRestaurantCollection } from "../../utils/firestoreHelpers";

const TemperatureRecordsScreen = ({ navigation }) => {
  const { restaurantId } = useRestaurant();
  const [fridgeLogs, setFridgeLogs] = useState([]);
  const [deliveryLogs, setDeliveryLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Date for header
  const today = getFormattedTodayDate();

  const fetchTemperatureRecords = async () => {
    if (!restaurantId) return;
    
    setLoading(true);
    try {
      // Fetch fridge logs
      const fridgeQuery = query(getRestaurantCollection(restaurantId, "fridgelogs"), orderBy("createdAt", "desc"));
      const fridgeSnapshot = await getDocs(fridgeQuery);
      const fridgeItems = fridgeSnapshot.docs.map(doc => ({
        id: doc.id,
        type: 'fridge',
        ...doc.data(),
      }));
      setFridgeLogs(fridgeItems);

      // Fetch delivery logs
      const deliveryQuery = query(getRestaurantCollection(restaurantId, "deliverylogs"), orderBy("createdAt", "desc"));
      const deliverySnapshot = await getDocs(deliveryQuery);
      const deliveryItems = deliverySnapshot.docs.map(doc => ({
        id: doc.id,
        type: 'delivery',
        ...doc.data(),
      }));
      setDeliveryLogs(deliveryItems);
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
        <Text style={styles.recordLocation}>{item.fridge || 'Unknown Fridge'}</Text>
        <Text style={styles.recordDate}>
          {item.createdAt?.seconds 
            ? new Date(item.createdAt.seconds * 1000).toLocaleDateString()
            : 'Unknown Date'
          }
        </Text>
      </View>
      <View style={styles.temperatureContainer}>
        <Text style={styles.temperatureValue}>{item.temperature}°C</Text>
        {item.checked && (
          <Ionicons name="checkmark-circle" size={20} color="#4CAF50" style={{ marginTop: 4 }} />
        )}
      </View>
    </View>
  );

  const renderDeliveryItem = ({ item }) => (
    <View style={styles.recordCard}>
      <View style={styles.recordInfo}>
        <Text style={styles.recordType}>Delivery Temperature</Text>
        <Text style={styles.recordLocation}>{item.supplier || 'Unknown Supplier'}</Text>
        <Text style={styles.recordDate}>
          {item.createdAt?.seconds 
            ? new Date(item.createdAt.seconds * 1000).toLocaleDateString()
            : 'Unknown Date'
          }
        </Text>
      </View>
      <View style={styles.temperatureContainer}>
        <Text style={styles.temperatureValue}>
          {item.temps?.frozen ? `${item.temps.frozen}°C` : '--°C'}
        </Text>
        <Text style={styles.temperatureSubValue}>
          {item.temps?.chilled ? `${item.temps.chilled}°C` : '--°C'}
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
          <Text style={styles.sectionTitle}>Fridge Temperature Logs</Text>
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
          <Text style={styles.sectionTitle}>Delivery Temperature Logs</Text>
        </View>
        
        <FlatList
          data={deliveryLogs} // Show all delivery logs
          keyExtractor={item => `delivery-${item.id}`}
          renderItem={renderDeliveryItem}
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
    paddingTop: Spacing.lg,
  },
  backButton: {
    marginRight: Spacing.md,
    padding: Spacing.xs,
  },
  backArrow: {
    fontSize: 35,
    color: Colors.textPrimary,
    fontWeight: "300",
    marginTop: 5,
  },
  titleContainer: {
    flex: 1,
    marginTop: Spacing.xl,
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
});

export default TemperatureRecordsScreen;
