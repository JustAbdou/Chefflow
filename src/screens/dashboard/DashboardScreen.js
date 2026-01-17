import React, { useEffect, useState, useCallback } from 'react';
import { getFormattedTodayDate } from '../../utils/dateUtils';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, Feather, MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, Typography } from '../../constants';
import { getAndroidTitleMargin, scaleWidth } from '../../utils/responsive';
import useNavigationBar from '../../hooks/useNavigationBar';
import { onSnapshot, query, orderBy, limit, where, doc, getDoc, collectionGroup } from "firebase/firestore";
import { useRestaurant } from "../../contexts/RestaurantContext";
import { getRestaurantCollection } from "../../utils/firestoreHelpers";
import { auth, db } from "../../../firebase";
import { groupPrepItemsByDay } from '../../utils/dateUtils';
import RestaurantSwitcherModal from '../../components/RestaurantSwitcherModal';

const DashboardScreen = ({ navigation }) => {
  const { restaurantId, activeRestaurantId, availableRestaurants, switchRestaurant } = useRestaurant();
  const [showRestaurantModal, setShowRestaurantModal] = useState(false);
  const [currentDate, setCurrentDate] = useState('');
  const [chefName, setChefName] = useState('Chef');
  const [prepCount, setPrepCount] = useState(0);
  const [orderCount, setOrderCount] = useState(0);
  const [recipeCount, setRecipeCount] = useState(0);
  const [invoiceCount, setInvoiceCount] = useState(0);
  const [taskCount, setTaskCount] = useState(0);
  const [openingTaskCount, setOpeningTaskCount] = useState(0);
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
    
    // Real-time listener for prep list with error handling (count items that are not done AND within 48-hour window)
    const unsubPrep = onSnapshot(
      getRestaurantCollection(restaurantId, "preplist"),
      (snapshot) => {
        // Get all prep items from Firestore
        const allPrepItems = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Group items by day using the same logic as PrepListsScreen
        const { todayItems, yesterdayItems } = groupPrepItemsByDay(allPrepItems);
        
        // Combine today and yesterday items (48-hour window)
        const recentItems = [...todayItems, ...yesterdayItems];
        
        // Count only items that are explicitly not done within the 48-hour window
        const pendingItems = recentItems.filter(item => item.done !== true);
        const completedItems = recentItems.filter(item => item.done === true);
        
        console.log(`📊 Dashboard: Analyzed ${snapshot.size} total prep items`);
        console.log(`📊 Dashboard: ${recentItems.length} items in 48-hour window`);
        console.log(`📊 Dashboard: ${pendingItems.length} pending, ${completedItems.length} completed (in window)`);
        console.log('📝 Recent pending items:', pendingItems.map(item => item.name));
        
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
        // set the pending tasks that marks not done
        const pendingTasks = snapshot.docs.filter(doc => !doc.data().done);
        setTaskCount(pendingTasks.length);
      },
      (error) => {
        console.warn('Closing checklist listener error:', error);
        setTaskCount(0);
      }
    );

    // Real-time listener for opening checklist with error handling
    const unsubOpeningTasks = onSnapshot(
      getRestaurantCollection(restaurantId, "openinglist"),
      (snapshot) => {
        console.log('📊 Dashboard: Found', snapshot.size, 'opening tasks');
        snapshot.docs.forEach((doc, index) => {
          console.log(`📋 Dashboard Opening Task ${index + 1}:`, doc.data());
        });
        // set the pending tasks that marks not done
        const pendingOpeningTasks = snapshot.docs.filter(doc => !doc.data().done);
        setOpeningTaskCount(pendingOpeningTasks.length);
      },
      (error) => {
        console.warn('Opening checklist listener error:', error);
        setOpeningTaskCount(0);
      }
    );

    return () => {
      unsubPrep();
      unsubOrder();
      unsubRecipes();
      unsubFridgeTemp();
      unsubInvoices();
      unsubTasks();
      unsubOpeningTasks();
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
      title: 'Opening Checklist',
      value: openingTaskCount.toString(),
      subtitle: openingTaskCount === 1 ? 'Task pending' : 'Tasks pending',
      icon: 'sunny-outline',
      iconColor: '#f59e0b',
    },
    {
      title: 'Closing Checklist',
      value: taskCount.toString(),
      subtitle: taskCount === 1 ? 'Task pending' : 'Tasks pending',
      icon: 'moon-outline',
      iconColor: '#8b5cf6',
    },
  ];

  const kitchenManagement = [
    {
      title: 'Food Safety Monitoring',
      subtitle: 'Temperature control and safety logs',
      icon: 'shield-checkmark-outline',
      iconColor: Colors.primary,
      iconType: 'ionicon',
      screen: 'FoodSafetyMonitoring',
    },
  ];

  const maintenanceManagement = [
    {
      title: 'Maintenance and Incidents',
      subtitle: 'Track and manage maintenance issues',
      icon: 'construct-outline',
      iconColor: Colors.primary,
      iconType: 'ionicon',
      screen: 'MaintenanceIssues',
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

  // Handle restaurant switching
  const handleSelectRestaurant = async (newRestaurantId) => {
    if (newRestaurantId === activeRestaurantId) {
      setShowRestaurantModal(false);
      return;
    }
    
    try {
      await switchRestaurant(newRestaurantId);
      setShowRestaurantModal(false);
    } catch (error) {
      console.error('Error switching restaurant:', error);
      Alert.alert('Error', 'Failed to switch restaurant. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <View style={styles.greetingContainer}>
              <Text style={styles.greeting}>{chefName}</Text>
            </View>
            {/* Active Restaurant Dropdown - Top Right */}
            {availableRestaurants.length > 1 && activeRestaurantId && (() => {
              const activeRestaurant = availableRestaurants.find(r => r.id === activeRestaurantId);
              const restaurantName = activeRestaurant?.name || activeRestaurantId;
              return (
                <TouchableOpacity
                  style={styles.restaurantDropdown}
                  onPress={() => setShowRestaurantModal(true)}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="store" size={18} color={Colors.primary} />
                  <Text style={styles.restaurantDropdownText} numberOfLines={1}>
                    {restaurantName}
                  </Text>
                  <MaterialIcons name="keyboard-arrow-down" size={20} color={Colors.primary} />
                </TouchableOpacity>
              );
            })()}
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
                } else if (stat.title === 'Opening Checklist') {
                  navigation.navigate('OpeningChecklist');
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
          <View style={styles.menuContainer}>
            {kitchenManagement.map((item, index) => (
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
                    {renderIcon(item.icon, '#FFFFFF', item.iconType)}
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

        {/* Maintenance and Incidents */}
        <View style={styles.section}>
          <View style={styles.menuContainer}>
            {maintenanceManagement.map((item, index) => (
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
                    {renderIcon(item.icon, '#FFFFFF', item.iconType)}
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

        {/* Admin Panel Button - placed just below with matching style */}
        <View style={styles.section}>
          <View style={styles.menuContainer}>
            <TouchableOpacity
              style={styles.highlightedMenuItem}
              onPress={() => Linking.openURL('https://admin.chefflowapp.net/signin')}
            >
              <View style={styles.menuItemLeft}>
                <View style={styles.highlightedMenuItemIcon}>
                  {renderIcon('settings-outline', '#FFFFFF', 'ionicon')}
                </View>
                <View>
                  <Text style={styles.highlightedMenuItemTitle}>Admin Panel</Text>
                  <Text style={styles.highlightedMenuItemSubtitle}>Access web dashboard</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Shift Submission - Highlighted Section */}
        <View style={styles.section}>
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

        {/* Invoices Section */}
        <View style={styles.section}>
          <View style={styles.menuContainer}>
            <TouchableOpacity
              style={styles.highlightedMenuItem}
              onPress={() => navigation.navigate('Invoices')}
            >
              <View style={styles.menuItemLeft}>
                <View style={styles.highlightedMenuItemIcon}>
                  <Ionicons name="document-text-outline" size={24} color="#FFFFFF" />
                </View>
                <View>
                  <Text style={styles.highlightedMenuItemTitle}>Invoices</Text>
                  <Text style={styles.highlightedMenuItemSubtitle}>View and manage invoices ({invoiceCount})</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Add bottom padding to account for bottom navigation */}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Restaurant Switcher Modal */}
      <RestaurantSwitcherModal
        visible={showRestaurantModal}
        onClose={() => setShowRestaurantModal(false)}
        availableRestaurants={availableRestaurants}
        activeRestaurantId={activeRestaurantId}
        onSelectRestaurant={handleSelectRestaurant}
      />
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
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  greetingContainer: {
    flex: 1,
    marginRight: Spacing.md,
  },
  greeting: {
    fontSize: Typography.xl,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
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
    marginBottom: Spacing.md,
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
    marginBottom: Spacing.xs,
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
  restaurantDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gray50,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    maxWidth: 150,
  },
  restaurantDropdownText: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontMedium,
    color: Colors.primary,
    marginLeft: Spacing.xs,
    marginRight: Spacing.xs,
    flexShrink: 1,
  },
});

export default DashboardScreen;