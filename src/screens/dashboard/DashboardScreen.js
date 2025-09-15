import React, { useEffect, useState, useCallback } from 'react';
import { getFormattedTodayDate } from '../../utils/dateUtils';
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
import { onSnapshot, query, orderBy, limit, where, doc, getDoc, collectionGroup } from "firebase/firestore";
import { useRestaurant } from "../../contexts/RestaurantContext";
import { getRestaurantCollection } from "../../utils/firestoreHelpers";
import { auth, db } from "../../../firebase";

const DashboardScreen = ({ navigation }) => {
  const { restaurantId } = useRestaurant();
  const [currentDate, setCurrentDate] = useState('');
  const [chefName, setChefName] = useState('Chef');
  const [prepCount, setPrepCount] = useState(0);
  const [orderCount, setOrderCount] = useState(0);
  const [recipeCount, setRecipeCount] = useState(0);
  const [invoiceCount, setInvoiceCount] = useState(0);
  const [taskCount, setTaskCount] = useState(0);
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
    
    // Real-time listener for prep list with error handling (count items that are not done or don't have done property)
    const unsubPrep = onSnapshot(
      getRestaurantCollection(restaurantId, "preplist"),
      (snapshot) => {
        // Debug: Log all items to see their structure
        console.log(`📊 Dashboard: Analyzing ${snapshot.size} prep items:`);
        
        const pendingItems = [];
        const completedItems = [];
        
        snapshot.docs.forEach((doc, index) => {
          const data = doc.data();
          console.log(`📋 Item ${index + 1}:`, { 
            id: doc.id, 
            name: data.name, 
            done: data.done, 
            typeof_done: typeof data.done 
          });
          
          // Count only items that are explicitly not done (false, undefined, or null)
          if (data.done === true) {
            completedItems.push({ id: doc.id, name: data.name });
          } else {
            pendingItems.push({ id: doc.id, name: data.name });
          }
        });
        
        console.log(`📊 Dashboard: ${pendingItems.length} pending, ${completedItems.length} completed`);
        console.log('📝 Pending items:', pendingItems.map(item => item.name));
        console.log('✅ Completed items:', completedItems.map(item => item.name));
        
        setPrepCount(pendingItems.length);
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
    
    // Real-time listener for recipes with error handling
    // Query the recipes document to get category count
    const unsubRecipes = onSnapshot(
      getRestaurantCollection(restaurantId, "recipes"), 
      (snapshot) => {
        setRecipeCount(snapshot.size);
      },
      (error) => {
        console.warn('Recipes listener error:', error);
        setRecipeCount(0);
      }
    );
    
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
    
    // Real-time listener for invoices with error handling
    const unsubInvoices = onSnapshot(
      getRestaurantCollection(restaurantId, "invoices"), 
      (snapshot) => {
        setInvoiceCount(snapshot.size);
      },
      (error) => {
        console.warn('Invoice listener error:', error);
        setInvoiceCount(0);
      }
    );

    // Real-time listener for tasks (closing checklist) with error handling - show all tasks
    const unsubTasks = onSnapshot(
      getRestaurantCollection(restaurantId, "closinglist"),
      (snapshot) => {
        console.log('📊 Dashboard: Found', snapshot.size, 'closing tasks');
        snapshot.docs.forEach((doc, index) => {
          console.log(`📋 Dashboard Task ${index + 1}:`, doc.data());
        });
        setTaskCount(snapshot.size);
      },
      (error) => {
        console.warn('Closing checklist listener error:', error);
        setTaskCount(0);
      }
    );
    
    return () => {
      unsubPrep();
      unsubOrder();
      unsubRecipes();
      unsubFridgeTemp();
      unsubInvoices();
      unsubTasks();
    };
  }, [restaurantId]);

  // Update stats array to use real-time counts
  const stats = [
    { 
      title: 'Prep List', 
      value: prepCount.toString(), 
      subtitle: prepCount === 1 ? 'Item pending' : 'Items pending',
      icon: 'clipboard',
      iconColor: Colors.primary,
    },
    { 
      title: 'Order List', 
      value: orderCount.toString(), 
      subtitle: orderCount === 1 ? 'Active order' : 'Active orders',
      icon: 'bag',
      iconColor: '#22c55e',
    },
    { 
      title: 'Invoices', 
      value: invoiceCount.toString(), 
      subtitle: 'Invoices total',
      icon: 'document-text-outline',
      iconColor: Colors.primary,
    },
    { 
      title: 'Closing Checklist', 
      value: taskCount.toString(), 
      subtitle: taskCount === 1 ? 'Task total' : 'Tasks total',
      icon: 'shield-checkmark-outline',
      iconColor: Colors.primary,
    },
  ];

  const kitchenManagement = [
    {
      title: 'Fridge Temperature',
      subtitle: 'Monitor and log fridge temps',
      icon: 'thermometer-outline',
      iconColor: Colors.primary,
      iconType: 'ionicon'
    },
    {
      title: 'Delivery Temperature',
      subtitle: 'Log and monitor delivery temps',
      icon: 'thermometer-outline',
      iconColor: Colors.primary,
      iconType: 'ionicon',
      screen: 'DeliveryTempLogs', // This should match the Stack.Screen name in App.js
    },
    {
      title: 'Cooking & Reheating',
      subtitle: 'Temperature safety logs',
      icon: 'flame-outline',
      iconColor: Colors.primary,
      iconType: 'ionicon',
      screen: 'CoolingAndReheating',
    },
  ];

  const shiftManagement = [
    {
      title: 'Shift Handover',
      subtitle: 'Submit shift handover reports',
      icon: 'document-text-outline',
      iconColor: '#FFFFFF',
      iconType: 'ionicon',
      screen: 'Handover',
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
          {stats.map((stat, index) => (
            <TouchableOpacity
              key={index}
              style={styles.statCard}
              onPress={() => {
                if (stat.title === 'Prep List') {
                  navigation.navigate('PrepLists');
                } else if (stat.title === 'Order List') {
                  navigation.navigate('OrderLists');
                } else if (stat.title === 'Invoices') {
                  navigation.navigate('Invoices');
                } else if (stat.title === 'Closing Checklist') {
                  navigation.navigate('CleaningChecklist');
                }
              }}
            >
              <View style={styles.statHeader}>
                <Ionicons 
                  name={stat.icon} 
                  size={24} 
                  color={stat.iconColor}
                  style={styles.statIcon}
                />
                <Text style={styles.statTitle}>{stat.title}</Text>
              </View>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statSubtitle}>{stat.subtitle}</Text>
            </TouchableOpacity>
          ))}
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
                  if (item.title === 'Order Lists') {
                    navigation.navigate('OrderLists');
                  } else if (item.title === 'Prep Lists') {
                    navigation.navigate('PrepLists');
                  } else if (item.title === 'Recipe Library') {
                    navigation.navigate('Recipes');
                  } else if (item.title === 'Fridge Temperature') {
                    navigation.navigate('FridgeTempLogs');
                  } else if (item.title === 'Closing Checklist') {
                    navigation.navigate('CleaningChecklist');
                  } else if (item.title === 'Delivery Temperature') {
                    navigation.navigate('DeliveryTempLogs');
                  } else if (item.title === 'Cooling & Reheating') {
                    navigation.navigate('CoolingAndReheating');
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

        {/* Shift Submission - Highlighted Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shift Submission</Text>
          <View style={styles.menuContainer}>
            {shiftManagement.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.highlightedMenuItem}
                onPress={() => {
                  if (item.screen) {
                    navigation.navigate(item.screen);
                  }
                }}
              >
                <View style={styles.menuItemLeft}>
                  <View style={styles.highlightedMenuItemIcon}>
                    {renderIcon(item.icon, item.iconColor, item.iconType)}
                  </View>
                  <View>
                    <Text style={styles.highlightedMenuItemTitle}>{item.title}</Text>
                    <Text style={styles.highlightedMenuItemSubtitle}>{item.subtitle}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    aspectRatio: 1.2,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    justifyContent: 'space-between',
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
    justifyContent: 'flex-start',
  },
  statIcon: {
    marginRight: Spacing.sm,
  },
  statTitle: {
    fontSize: Typography.base,
    fontFamily: Typography.fontMedium,
    color: Colors.textPrimary,
    flex: 1,
    flexWrap: 'wrap',
  },
  statValue: {
    fontSize: 28,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
    marginTop: Spacing.xs,
    marginLeft: 0,
  },
  statSubtitle: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontRegular,
    color: Colors.textSecondary,
    marginLeft: 0,
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
  highlightedMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primary,
    borderRadius: 16,
    padding: Spacing.md,
    marginHorizontal: '2%',
    marginBottom: Spacing.sm,
    elevation: 4,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    paddingVertical: Spacing.lg,
  },
  highlightedMenuItemIcon: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  highlightedMenuItemTitle: {
    fontSize: Typography.base,
    fontFamily: Typography.fontBold,
    color: '#FFFFFF',
  },
  highlightedMenuItemSubtitle: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontRegular,
    color: '#FFFFFF',
    opacity: 0.9,
  },
});

export default DashboardScreen;