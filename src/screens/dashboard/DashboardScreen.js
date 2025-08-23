import React, { useEffect, useState, useCallback } from 'react';
import { getFormattedTodayDate, groupPrepItemsByDay } from '../../utils/dateUtils';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { Colors, Spacing, Typography } from '../../constants';
import { getAndroidTitleMargin } from '../../utils/responsive';
import useNavigationBar from '../../hooks/useNavigationBar';
import { onSnapshot, query, orderBy, limit, where, doc, getDoc, getDocs } from "firebase/firestore";
import { useRestaurant } from "../../contexts/RestaurantContext";
import { getRestaurantCollection } from "../../utils/firestoreHelpers";
import { auth, db } from "../../../firebase";
import { DocumentIcon } from '../../components/icons/NavigationIcons';

const DashboardScreen = ({ navigation }) => {
  const { restaurantId } = useRestaurant();
  const [currentDate, setCurrentDate] = useState('');
  const [chefName, setChefName] = useState('Chef');
  const [prepCount, setPrepCount] = useState(0);
  const [orderCount, setOrderCount] = useState(0);
  const [recipeCount, setRecipeCount] = useState(0);
  const [invoiceCount, setInvoiceCount] = useState(0);
  const [closingChecklistCount, setClosingChecklistCount] = useState(0);
  const [latestFridgeTemp, setLatestFridgeTemp] = useState('--°C');
  const [refreshing, setRefreshing] = useState(false);

  // Hide Android navigation bar
  const navigationBar = useNavigationBar();
  navigationBar.useHidden(); // Use hidden mode for complete immersion

  useEffect(() => {
    if (!restaurantId) return;
    
    setCurrentDate(getFormattedTodayDate());
    
    // Fetch user's name from their profile
    const fetchUserName = async () => {
      try {
        const user = auth.currentUser;
        if (user) {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const fullName = userData.fullName || userData.name || 'Chef';
            // Extract first name (everything before the first space)
            const firstName = fullName.split(' ')[0];
            // Capitalize only the first letter, preserve the rest
            const capitalizedFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1);
            setChefName(capitalizedFirstName);
          }
        }
      } catch (error) {
        console.warn('Error fetching user name:', error);
        setChefName('Chef'); // Fallback
      }
    };

    fetchUserName();
    
    // Real-time listener for prep list with error handling (count items that are not done within 48-hour window)
    const unsubPrep = onSnapshot(
      getRestaurantCollection(restaurantId, "preplist"),
      (snapshot) => {
        // Get all prep items
        const allPrepItems = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Filter items within 48-hour window using the same logic as PrepListsScreen
        const { todayItems, yesterdayItems } = groupPrepItemsByDay(allPrepItems);
        const visibleItems = [...todayItems, ...yesterdayItems];
        
        // Count incomplete items from visible items only
        const incompleteCount = visibleItems.filter(item => !item.done).length;
        setPrepCount(incompleteCount);
      },
      (error) => {
        console.warn('Prep list listener error:', error);
        setPrepCount(0);
      }
    );
    
    // Real-time listener for order list with error handling (only count incomplete items)
    const unsubOrder = onSnapshot(
      query(
        getRestaurantCollection(restaurantId, "orderlist"),
        where("done", "==", false)
      ),
      (snapshot) => {
        setOrderCount(snapshot.size);
      },
      (error) => {
        console.warn('Order list listener error:', error);
        setOrderCount(0);
      }
    );
    
    // Real-time listener for invoices with error handling (count all invoices)
    const unsubInvoices = onSnapshot(
      getRestaurantCollection(restaurantId, "invoices"),
      (snapshot) => {
        setInvoiceCount(snapshot.size);
      },
      (error) => {
        console.warn('Invoices listener error:', error);
        setInvoiceCount(0);
      }
    );
    
    // Real-time listener for closing checklist with error handling (count all closing checklist items)
    const unsubClosingChecklist = onSnapshot(
      getRestaurantCollection(restaurantId, "closinglist"),
      (snapshot) => {
        // needs to check if the task is pending  
        const pendingTasks = snapshot.docs.filter(doc => !doc.data().done);
        setClosingChecklistCount(pendingTasks.length);
      },
      (error) => {
        console.warn('Closing checklist listener error:', error);
        setClosingChecklistCount(0);
      }
    );
    
    // Real-time listener for recipes with error handling (recipes are stored in category subcollections)
    const fetchRecipeCount = async () => {
      try {
        // First get category names
        const categoryNamesDoc = await getDoc(doc(db, 'restaurants', restaurantId, 'recipes', 'categories'));
        let categoryNames = [];
        
        if (categoryNamesDoc.exists()) {
          const data = categoryNamesDoc.data();
          categoryNames = data?.names || [];
        } else {
          categoryNames = ['Desserts', 'Main', 'Starters']; // Fallback categories
        }
        
        // Count recipes across all categories
        let totalRecipes = 0;
        for (const categoryName of categoryNames) {
          const categoryCollection = getRestaurantCollection(restaurantId, `recipes/categories/${categoryName}`);
          const categorySnapshot = await getDocs(categoryCollection);
          totalRecipes += categorySnapshot.size;
        }
        
        setRecipeCount(totalRecipes);
      } catch (error) {
        console.warn('Error fetching recipe count:', error);
        setRecipeCount(0);
      }
    };
    
    // Initial fetch
    fetchRecipeCount();
    
    // Set up periodic refresh for recipe count (since recipes don't change frequently)
    const recipeCountInterval = setInterval(fetchRecipeCount, 30000); // Refresh every 30 seconds
    
    // Real-time listener for latest fridge temperature
    const unsubFridgeTemp = onSnapshot(
      query(
        getRestaurantCollection(restaurantId, "fridgelogs"), 
        orderBy("createdAt", "desc"), 
        limit(1)
      ),
      (snapshot) => {
        if (!snapshot.empty) {
          const latestLog = snapshot.docs[0].data();
          const temp = latestLog.temperature;
          if (temp && temp !== '') {
            setLatestFridgeTemp(`${temp}°C`);
          } else {
            setLatestFridgeTemp('--°C');
          }
        } else {
          setLatestFridgeTemp('--°C');
        }
      },
      (error) => {
        console.warn('Fridge temperature listener error:', error);
        setLatestFridgeTemp('--°C');
      }
    );
    
    return () => {
      unsubPrep();
      unsubOrder();
      unsubInvoices();
      clearInterval(recipeCountInterval);
      unsubFridgeTemp();
    };
  }, [restaurantId]);

  // Update stats array to use real-time counts
  const stats = [
    { 
      title: 'Prep List', 
      value: prepCount.toString(), 
      subtitle: prepCount === 1 ? 'Item pending' : 'Items pending',
      iconUri: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/prep-list-icon-7OGiBj3xTb4oUzsdkEHvYfd6U6uST2.png',
      screen: 'PrepLists',
    },
    { 
      title: 'Order List', 
      value: orderCount.toString(), 
      subtitle: orderCount === 1 ? 'Active order' : 'Active orders',
      iconUri: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/order-list-icon-Z5JTOiHoj7KslxsJDGqVam7GH6o46F.png',
      screen: 'OrderLists',
    },
    { 
      title: 'Invoices', 
      value: invoiceCount.toString(), 
      subtitle: invoiceCount === 1 ? 'Invoice total' : 'Invoices total',
      iconUri: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/invoice-icon.png',
      icon: <Ionicons name="receipt-outline" size={22} color={Colors.primary} />,
      screen: 'Invoices',
    },
    { 
      title: 'Closing Checklist', 
      value: closingChecklistCount.toString(), 
      subtitle: 'Tasks pending',
      iconUri: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/cleaning-icon.png',
      icon: <Ionicons name="shield-checkmark-outline" size={22} color={Colors.primary} />,
      screen: 'CleaningChecklist',
    },
  ];

  const kitchenManagement = [
    {
      title: 'Fridge Temperature',
      subtitle: 'Monitor fridge temperatures',
      icon: 'thermometer-outline',
      iconColor: Colors.primary,
      iconType: 'ionicon',
      screen: 'FridgeTempLogs',
    },
    {
      title: 'Delivery Temperature',
      subtitle: 'Monitor delivery temperatures',
      icon: 'thermometer-outline',
      iconColor: Colors.primary,
      iconType: 'ionicon',
      screen: 'DeliveryTempLogs',
    },
    {
      title: 'Cooling & Reheating',
      subtitle: 'Log food temperature safety',
      icon: 'thermometer-outline',
      iconColor: Colors.primary,
      iconType: 'ionicon',
      screen: 'CoolingReheating',
    },
    {
      title: 'Kitchen Handover',
      subtitle: 'Complete shift handover',
      icon: 'people-outline',
      iconColor: Colors.primary,
      iconType: 'ionicon',
      screen: 'Handover',
    },
  ];

  const downloadables = [
    {
      title: 'Invoices',
      subtitle: `${invoiceCount} invoice${invoiceCount === 1 ? '' : 's'} total`,
      icon: 'document-outline',
      iconColor: Colors.primary,
      iconType: 'ionicon'
    },
    {
      title: 'Temperature Records',
      subtitle: 'Download temperature logs',
      icon: 'thermometer-outline',
      iconColor: Colors.textPrimary,
      iconType: 'ionicon'
    },
    {
      title: 'Shift Handovers',
      subtitle: 'View previous handovers',
      icon: 'people-outline',
      iconColor: Colors.textPrimary,
      iconType: 'ionicon'
    },
  ];

  // Render icon based on type
  const renderIcon = (icon, color, type, size = 24) => {
    if (type === 'ionicon') {
      return <Ionicons name={icon} size={size} color={color} />;
    } else if (type === 'material-community') {
      return <MaterialCommunityIcons name={icon} size={size} color={color} />;
    }
    return <Feather name={icon} size={size} color={color} />;
  };

  // Add a manual refresh function
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // You can re-run your listeners or just set refreshing to false after a short delay
    setTimeout(() => {
      setRefreshing(false);
    }, 500); // Adjust delay as needed
  }, []);

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
          <Text style={styles.appTitle}>ChefFlow</Text>
          <View style={styles.greetingContainer}>
            <Text style={styles.greeting}>Good morning, {chefName}</Text>
            <Text style={styles.date}>{currentDate}</Text>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statsRow}>
            {stats.slice(0, 2).map((stat, index) => (
              <TouchableOpacity
                key={index}
                style={styles.statCard}
                onPress={() => {
                  if (stat.screen) {
                    navigation.navigate(stat.screen);
                  }
                }}
              >
                <View style={styles.statHeader}>
                  <Image 
                    source={{ uri: stat.iconUri }} 
                    style={styles.statIcon}
                    resizeMode="contain"
                  />
                  <Text style={styles.statTitle}>{stat.title}</Text>
                </View>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statSubtitle}>{stat.subtitle}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.statsRow}>
            {stats.slice(2).map((stat, index) => (
              <TouchableOpacity
                key={index + 2}
                style={styles.statCard}
                onPress={() => {
                  if (stat.screen) {
                    navigation.navigate(stat.screen);
                  }
                }}
              >
                <View style={styles.statHeader}>
                  {stat.icon ? (
                    <View style={styles.statIconContainer}>
                      {stat.icon}
                    </View>
                  ) : (
                    <Image 
                      source={{ uri: stat.iconUri }} 
                      style={styles.statIcon}
                      resizeMode="contain"
                    />
                  )}
                  <Text style={styles.statTitle}>{stat.title}</Text>
                </View>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statSubtitle}>{stat.subtitle}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Kitchen Management */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kitchen Management</Text>
          <View style={styles.menuContainer}>
            {kitchenManagement.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.menuItem}
                onPress={() => {
                  if (item.title === 'Fridge Temperature') {
                    navigation.navigate('FridgeTempLogs');
                  } else if (item.title === 'Delivery Temperature') {
                    navigation.navigate('DeliveryTempLogs');
                  } else if (item.title === 'Cooling & Reheating') {
                    navigation.navigate('CoolingReheating');
                  } else if (item.title === 'Invoices') {
                    navigation.navigate('Invoices');
                  } else if (item.title === 'Kitchen Handover') {
                    navigation.navigate('Handover');
                  } else if (item.screen) {
                    navigation.navigate(item.screen);
                  }
                }}
              >
                <View style={styles.menuItemLeft}>
                  <View style={styles.menuItemIcon}>
                    {renderIcon(item.icon, item.iconColor, item.iconType)}
                  </View>
                  <View>
                    <Text style={styles.menuItemTitle}>{item.title}</Text>
                    <Text style={styles.menuItemSubtitle}>{item.subtitle}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.gray400} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Add bottom padding to account for bottom navigation */}
        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg + getAndroidTitleMargin(),
    paddingBottom: Spacing.md,
  },
  appTitle: {
    fontSize: Typography.xxl,
    fontFamily: Typography.fontBold,
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  greetingContainer: {
    marginBottom: Spacing.lg,
  },
  greeting: {
    fontSize: Typography.xl,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  date: {
    fontSize: Typography.base,
    fontFamily: Typography.fontRegular,
    color: Colors.textSecondary,
  },
  statsGrid: {
    flexDirection: 'column',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xl,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  statCard: {
    width: '46%',
    paddingVertical: Spacing.xl,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  statCardCenter: {
    width: '46%',
    paddingVertical: Spacing.xl,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: Spacing.md,
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  statIcon: {
    width: 25,
    height: 25,
    marginRight: Spacing.sm,
  },
  statIconContainer: {
    width: 25,
    height: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  statTitle: {
    fontSize: Typography.base,
    fontFamily: Typography.fontMedium,
    color: Colors.textPrimary,
    flexWrap: 'wrap',
    flex: 1,
  },
  statValue: {
    fontSize: 28,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  statSubtitle: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontRegular,
    color: Colors.textSecondary,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: Typography.lg,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  menuContainer: {
    paddingHorizontal: Spacing.md,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: Spacing.md,
    marginHorizontal: '2%',
    marginBottom: Spacing.sm,
    elevation: 2,
    paddingVertical: Spacing.lg,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuItemIcon: {
    width: 40,
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  menuItemTitle: {
    fontSize: Typography.base,
    fontFamily: Typography.fontMedium,
    color: Colors.textPrimary,
  },
  menuItemSubtitle: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontRegular,
    color: Colors.textSecondary,
    opacity: 0.7,
  },
});

export default DashboardScreen;