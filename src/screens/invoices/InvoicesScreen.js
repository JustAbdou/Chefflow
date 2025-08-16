import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography } from '../../constants';
import { getAndroidTitleMargin } from '../../utils/responsive';
import useNavigationBar from '../../hooks/useNavigationBar';
import { getFormattedTodayDate } from '../../utils/dateUtils';
import { getDocs, query, orderBy } from "firebase/firestore";
import { useRestaurant } from "../../contexts/RestaurantContext";
import { getRestaurantCollection } from "../../utils/firestoreHelpers";

const InvoicesScreen = ({ navigation }) => {
  const { restaurantId } = useRestaurant();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false); // <-- Add this

  // Hide Android navigation bar
  const navigationBar = useNavigationBar();
  navigationBar.useHidden(); // Use hidden mode for complete immersion

  // Date for header
  const today = getFormattedTodayDate();

  const fetchInvoices = async () => {
    if (!restaurantId) return;
    
    setLoading(true);
    try {
      const q = query(getRestaurantCollection(restaurantId, "invoices"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setInvoices(items);
    } catch (error) {
      console.error("Error fetching invoices:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [restaurantId]);

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchInvoices();
    setRefreshing(false);
  }, []);

  const renderItem = ({ item }) => (
    <View style={styles.invoiceCard}>
      <View>
        <Text style={styles.invoiceNumber}>{item.invoiceNumber}</Text>
        {/* Optionally, add a subtitle or date here */}
      </View>
      <Text style={styles.amount}>£{item.amount}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
    
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Invoices</Text>
          <Text style={styles.date}>{today}</Text>
        </View>
      </View>
      {/* Section Title */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Invoices</Text>
        <TouchableOpacity onPress={() => navigation.navigate('InvoicesDownloads')}>
          <Text style={styles.download}>Download</Text>
        </TouchableOpacity>
      </View>
      {/* Invoice List */}
      <FlatList
        data={invoices}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={handleRefresh}
      />
      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('InvoiceUpload')}
      >
        <Ionicons name="add" size={36} color="#fff" />
      </TouchableOpacity>
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
  dateRangeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gray100,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: Spacing.lg,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    justifyContent: 'space-between',
  },
  dateRangeText: {
    ...Typography.body,
    color: Colors.gray400,
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
    paddingBottom: 100,
  },
  invoiceCard: {
    backgroundColor: Colors.gray100,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  invoiceNumber: {
    ...Typography.h4,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  amount: {
    ...Typography.h4,
    color: Colors.textPrimary,
    fontWeight: '500',
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

export default InvoicesScreen;