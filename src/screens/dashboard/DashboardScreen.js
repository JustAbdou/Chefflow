import React, { useEffect, useState, useCallback, useRef } from 'react';
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
  Alert,
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
import { getTodayWeekdayName, getLocalDateKey, filterTasksForWeekday } from '../../utils/cleaningHelpers';
import RestaurantSwitcherModal from '../../components/RestaurantSwitcherModal';

const DashboardScreen = ({ navigation }) => {
  const { restaurantId, activeRestaurantId, availableRestaurants, switchRestaurant, deleteRestaurant } = useRestaurant();
  const [showRestaurantModal, setShowRestaurantModal] = useState(false);
  const [deletingRestaurantId, setDeletingRestaurantId] = useState(null);
  const [currentDate, setCurrentDate] = useState('');
  const [chefName, setChefName] = useState('Chef');
  const [prepCount, setPrepCount] = useState(0);
  const [orderCount, setOrderCount] = useState(0);
  const [recipeCount, setRecipeCount] = useState(0);
  const [invoiceCount, setInvoiceCount] = useState(0);
  const [taskCount, setTaskCount] = useState(0); // closing checklist pending today
  const [openingTaskCount, setOpeningTaskCount] = useState(0); // opening checklist pending today
  const [latestFridgeTemp, setLatestFridgeTemp] = useState('--°C');
  const [refreshing, setRefreshing] = useState(false);
  const [cleaningTodayTotal, setCleaningTodayTotal] = useState(0);
  const [cleaningTodayDone, setCleaningTodayDone] = useState(0);
  const cleaningScheduledIdsRef = useRef(new Set());
  const cleaningLogsRef = useRef([]);
  const openingTaskIdsRef = useRef(new Set());
  const openingLogsRef = useRef([]);
  const closingTaskIdsRef = useRef(new Set());
  const closingLogsRef = useRef([]);

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

    const dateKey = getLocalDateKey();
    const weekday = getTodayWeekdayName();
    const recountCleaningDone = () => {
      const ids = cleaningScheduledIdsRef.current;
      let done = 0;
      cleaningLogsRef.current.forEach((row) => {
        if (row.completed === true && ids.has(row.taskId)) done += 1;
      });
      setCleaningTodayDone(done);
    };
    const recountOpeningClosing = () => {
      // Opening: pending = total definitions - completed logs for today
      const openingIds = openingTaskIdsRef.current;
      const openingDoneIds = new Set(
        openingLogsRef.current
          .filter((r) => r.completed === true)
          .map((r) => r.taskId)
      );
      let openingDone = 0;
      openingIds.forEach((id) => {
        if (openingDoneIds.has(id)) openingDone += 1;
      });
      const openingPending = Math.max(0, openingIds.size - openingDone);
      setOpeningTaskCount(openingPending);

      // Closing
      const closingIds = closingTaskIdsRef.current;
      const closingDoneIds = new Set(
        closingLogsRef.current
          .filter((r) => r.completed === true)
          .map((r) => r.taskId)
      );
      let closingDone = 0;
      closingIds.forEach((id) => {
        if (closingDoneIds.has(id)) closingDone += 1;
      });
      const closingPending = Math.max(0, closingIds.size - closingDone);
      setTaskCount(closingPending);
    };

    const unsubCleaningTasks = onSnapshot(
      getRestaurantCollection(restaurantId, 'cleaningTasks'),
      (snapshot) => {
        const tasks = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        const scheduled = filterTasksForWeekday(tasks, weekday);
        cleaningScheduledIdsRef.current = new Set(scheduled.map((t) => t.id));
        setCleaningTodayTotal(scheduled.length);
        recountCleaningDone();
      },
      () => {
        setCleaningTodayTotal(0);
        cleaningScheduledIdsRef.current = new Set();
        setCleaningTodayDone(0);
      }
    );
    const unsubCleaningLogs = onSnapshot(
      query(
        getRestaurantCollection(restaurantId, 'cleaningTaskLogs'),
        where('date', '==', dateKey)
      ),
      (snapshot) => {
        cleaningLogsRef.current = snapshot.docs.map((d) => {
          const data = d.data();
          return { taskId: data.taskId, completed: data.completed === true };
        });
        recountCleaningDone();
      },
      () => {
        cleaningLogsRef.current = [];
        setCleaningTodayDone(0);
      }
    );

    // Opening checklist: definitions
    const unsubOpeningTasks = onSnapshot(
      getRestaurantCollection(restaurantId, "openinglist"),
      (snapshot) => {
        const ids = new Set(snapshot.docs.map((d) => d.id));
        openingTaskIdsRef.current = ids;
        recountOpeningClosing();
      },
      (error) => {
        console.warn('Opening checklist listener error:', error);
        openingTaskIdsRef.current = new Set();
        recountOpeningClosing();
      }
    );

    // Opening checklist: today's logs
    const unsubOpeningLogs = onSnapshot(
      query(
        getRestaurantCollection(restaurantId, "openingChecklistLogs"),
        where("date", "==", dateKey)
      ),
      (snapshot) => {
        openingLogsRef.current = snapshot.docs.map((d) => {
          const data = d.data();
          return { taskId: data.taskId, completed: data.completed === true };
        });
        recountOpeningClosing();
      },
      () => {
        openingLogsRef.current = [];
        recountOpeningClosing();
      }
    );

    // Closing checklist: definitions
    const unsubClosingTasks = onSnapshot(
      getRestaurantCollection(restaurantId, "closinglist"),
      (snapshot) => {
        const ids = new Set(snapshot.docs.map((d) => d.id));
        closingTaskIdsRef.current = ids;
        recountOpeningClosing();
      },
      (error) => {
        console.warn('Closing checklist listener error:', error);
        closingTaskIdsRef.current = new Set();
        recountOpeningClosing();
      }
    );

    // Closing checklist: today's logs
    const unsubClosingLogs = onSnapshot(
      query(
        getRestaurantCollection(restaurantId, "closingChecklistLogs"),
        where("date", "==", dateKey)
      ),
      (snapshot) => {
        closingLogsRef.current = snapshot.docs.map((d) => {
          const data = d.data();
          return { taskId: data.taskId, completed: data.completed === true };
        });
        recountOpeningClosing();
      },
      () => {
        closingLogsRef.current = [];
        recountOpeningClosing();
      }
    );

    return () => {
      unsubPrep();
      unsubOrder();
      unsubRecipes();
      unsubFridgeTemp();
      unsubInvoices();
      unsubOpeningTasks();
      unsubOpeningLogs();
      unsubClosingTasks();
      unsubClosingLogs();
      unsubCleaningTasks();
      unsubCleaningLogs();
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
    {
      title: 'Cleaning Checklist',
      subtitle:
        cleaningTodayTotal === 0
          ? 'Recurring tasks by day of week'
          : `${cleaningTodayDone}/${cleaningTodayTotal} done today`,
      icon: 'brush-outline',
      iconColor: Colors.primary,
      iconType: 'ionicon',
      screen: 'CleaningChecklist',
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

  const handleDeleteRestaurant = (restaurant) => {
    if (!restaurant?.id || deletingRestaurantId) {
      return;
    }

    const isActive = restaurant.id === activeRestaurantId;
    const message = isActive && availableRestaurants.length > 1
      ? `Remove "${restaurant.name}" from your account? You'll be switched to another restaurant.`
      : isActive && availableRestaurants.length === 1
        ? `Remove "${restaurant.name}" from your account? You'll stay signed in, but won't have access to any restaurants until an administrator re-adds you.`
        : `Remove "${restaurant.name}" from your account? This only affects your access — the restaurant stays in the system and you can be re-added later.`;

    Alert.alert(
      'Delete Restaurant',
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingRestaurantId(restaurant.id);
            try {
              const { hasNoRestaurantsLeft } = await deleteRestaurant(restaurant.id);

              if (hasNoRestaurantsLeft) {
                setShowRestaurantModal(false);
                Alert.alert(
                  'Restaurant Removed',
                  'You no longer have any restaurants on your account. Contact your administrator to be re-added.'
                );
              }
            } catch (error) {
              console.error('Error deleting restaurant:', error);
              Alert.alert('Error', 'Failed to remove restaurant from your account. Please try again.');
            } finally {
              setDeletingRestaurantId(null);
            }
          },
        },
      ]
    );
  };

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
                  navigation.navigate('ClosingChecklist');
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

        {/* All primary (blue) cards in one stack — vertical gap matches stats grid (Spacing.md) */}
        <View style={styles.highlightStack}>
          <View style={styles.menuContainer}>
            {kitchenManagement.map((item, index) => (
              <TouchableOpacity
                key={`kitchen-${index}`}
                style={styles.highlightedMenuItem}
                onPress={() => item.screen && navigation.navigate(item.screen)}
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
            {maintenanceManagement.map((item, index) => (
              <TouchableOpacity
                key={`maint-${index}`}
                style={styles.highlightedMenuItem}
                onPress={() => item.screen && navigation.navigate(item.screen)}
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
            {shiftManagement.map((item, index) => (
              <TouchableOpacity
                key={`shift-${index}`}
                style={styles.highlightedMenuItem}
                onPress={() => item.screen && navigation.navigate(item.screen)}
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
        onDeleteRestaurant={handleDeleteRestaurant}
        deletingRestaurantId={deletingRestaurantId}
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
  /** Single column of blue cards; same vertical rhythm as statCard rows (marginBottom md) */
  highlightStack: {
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
    marginBottom: Spacing.md,
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