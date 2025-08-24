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
      // Fetch fridge logs using the same approach as FridgeScreen
      const fridgeLogsCollection = getRestaurantCollection(restaurantId, 'fridgelogs');
      const fridgeLogsSnapshot = await getDocs(fridgeLogsCollection);
      
      let allFridgeLogs = [];
      fridgeLogsSnapshot.forEach(docSnap => {
        const data = docSnap.data();
        allFridgeLogs.push({
          id: docSnap.id,
          type: 'fridge',
          ...data,
        });
      });
      
      // Sort fridge logs by createdAt (newest first)
      allFridgeLogs.sort((a, b) => {
        if (a.createdAt && b.createdAt) {
          return b.createdAt.seconds - a.createdAt.seconds;
        }
        return 0;
      });
      
      setFridgeLogs(allFridgeLogs);

      // Fetch delivery logs using the same approach as DeliveryScreen
      const deliveryLogsCollection = getRestaurantCollection(restaurantId, 'deliverylogs');
      const deliveryLogsSnapshot = await getDocs(deliveryLogsCollection);
      
      let allDeliveryLogs = [];
      deliveryLogsSnapshot.forEach(docSnap => {
        const data = docSnap.data();
        allDeliveryLogs.push({
          id: docSnap.id,
          type: 'delivery',
          ...data,
        });
      });
      
      // Sort delivery logs by createdAt (newest first)
      allDeliveryLogs.sort((a, b) => {
        if (a.createdAt && b.createdAt) {
          return b.createdAt.seconds - a.createdAt.seconds;
        }
        return 0;
      });
      
      setDeliveryLogs(allDeliveryLogs);
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

  const renderFridgeItem = ({ item }) => {
    return (
      <View style={styles.recordCard}>
        <View style={styles.recordInfo}>
          <Text style={styles.recordType}>Fridge Temperature</Text>
          <Text style={styles.recordLocation}>{item.fridgeName || 'Unknown Fridge'}</Text>
          <Text style={styles.recordDate}>
            {item.date || (item.createdAt?.seconds 
              ? new Date(item.createdAt.seconds * 1000).toLocaleDateString()
              : 'Unknown Date')
            }
          </Text>
        </View>
        <View style={styles.temperatureContainer}>
          {item.temperatureAM && (
            <Text style={styles.temperatureValue}>AM: {item.temperatureAM}°C</Text>
          )}
          {item.temperaturePM && (
            <Text style={styles.temperatureSubValue}>PM: {item.temperaturePM}°C</Text>
          )}
          {!item.temperatureAM && !item.temperaturePM && (
            <Text style={styles.temperatureValue}>--°C</Text>
          )}
          {item.done && (
            <Ionicons name="checkmark-circle" size={20} color="#4CAF50" style={{ marginTop: 4 }} />
          )}
        </View>
      </View>
    );
  };

  const renderDeliveryItem = ({ item }) => (
    <View style={styles.recordCard}>
      <View style={styles.recordInfo}>
        <Text style={styles.recordType}>Delivery Temperature</Text>
        <Text style={styles.recordLocation}>{item.supplierName || item.supplier || 'Unknown Supplier'}</Text>
        <Text style={styles.recordDate}>
          {item.date || (item.createdAt?.seconds 
            ? new Date(item.createdAt.seconds * 1000).toLocaleDateString()
            : 'Unknown Date')
          }
        </Text>
      </View>
      <View style={styles.temperatureContainer}>
        {item.frozen && (
          <Text style={styles.temperatureValue}>Frozen: {item.frozen}°C</Text>
        )}
        {item.chilled && (
          <Text style={styles.temperatureSubValue}>Chilled: {item.chilled}°C</Text>
        )}
        {!item.frozen && !item.chilled && (
          <Text style={styles.temperatureValue}>--°C</Text>
        )}
        {item.done && (
          <Ionicons name="checkmark-circle" size={20} color="#4CAF50" style={{ marginTop: 4 }} />
        )}
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
