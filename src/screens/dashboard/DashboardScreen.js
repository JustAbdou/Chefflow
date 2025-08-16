import React, { useEffect, useState } from 'react';
import { getFormattedTodayDate } from '../../utils/dateUtils';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { Colors, Spacing, Typography } from '../../constants';
import { HomeIcon, TasksIcon, RecipesIcon, SettingsIcon } from "../../components/icons/NavigationIcons";
import { db, auth } from '../../../firebase'; 

const DashboardScreen = ({ navigation }) => {
  const [currentDate, setCurrentDate] = useState('');
  const [chefName, setChefName] = useState('Chef Marux'); 

  useEffect(() => {
    setCurrentDate(getFormattedTodayDate());

  }, []);

  const stats = [
    { 
      title: 'Prep List', 
      value: '4', 
      subtitle: 'Items pending',
      iconUri: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/prep-list-icon-7OGiBj3xTb4oUzsdkEHvYfd6U6uST2.png', 
    },
    { 
      title: 'Order List', 
      value: '6', 
      subtitle: 'Active orders',
      iconUri: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/order-list-icon-Z5JTOiHoj7KslxsJDGqVam7GH6o46F.png', 
    },
    { 
      title: 'No', 
      value: '5', 
      subtitle: 'Items out of stock',
      iconUri: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/no-icon-9zxU9sOjqWRMb9cgGz3VATbjlf16ju.png', 
    },
    { 
      title: 'Low', 
      value: '12', 
      subtitle: 'Items running low',
      iconUri: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/low-icon-e749TPuEdLD4QjbWBeK8Yr5mlSRfAl.png', 
    },
  ];

  const kitchenManagement = [
    {
      title: 'Prep Lists',
      subtitle: '4 items pending',
      icon: 'clipboard-outline',
      iconColor: Colors.primary,
      iconType: 'ionicon'
    },
    {
      title: 'Order Lists',
      subtitle: '6 active orders',
      icon: 'fast-food-outline',
      iconColor: Colors.primary,
      iconType: 'ionicon'
    },
    {
      title: 'Fridge Temperature',
      subtitle: '3.3°C',
      icon: 'thermometer-outline',
      iconColor: Colors.primary,
      iconType: 'ionicon'
    },
    {
      title: 'Delivery Temperature',
      subtitle: 'Chilled | Frozen',
      icon: 'thermometer-outline',
      iconColor: Colors.primary,
      iconType: 'ionicon'
    },
    {
      title: 'Recipe Library',
      subtitle: '156 recipes',
      icon: 'restaurant-outline',
      iconColor: Colors.primary,
      iconType: 'ionicon'
    },
  ];

  const downloadables = [
    {
      title: 'Invoices',
      icon: 'document-outline',
      iconColor: Colors.textPrimary,
      iconType: 'ionicon'
    },
    {
      title: 'Temperature Records',
      icon: 'thermometer-outline',
      iconColor: Colors.textPrimary,
      iconType: 'ionicon'
    },
    {
      title: 'Shift Handovers',
      icon: 'people-outline',
      iconColor: Colors.textPrimary,
      iconType: 'ionicon'
    },
  ];

  const renderIcon = (icon, color, type, size = 24) => {
    if (type === 'ionicon') {
      return <Ionicons name={icon} size={size} color={color} />;
    } else if (type === 'material-community') {
      return <MaterialCommunityIcons name={icon} size={size} color={color} />;
    }
    return <Feather name={icon} size={size} color={color} />;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.appTitle}>ChefFlow</Text>
          <View style={styles.greetingContainer}>
            <Text style={styles.greeting}>Good morning, {chefName}</Text>
            <Text style={styles.date}>{currentDate}</Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          {stats.map((stat, index) => (
            <TouchableOpacity key={index} style={styles.statCard}>
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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Downloadables</Text>
          <View style={styles.menuContainer}>
            {downloadables.map((item, index) => (
              <TouchableOpacity key={index} style={styles.menuItem}>
                <View style={styles.menuItemLeft}>
                  <View style={styles.menuItemIcon}>
                    {renderIcon(item.icon, item.iconColor, item.iconType)}
                  </View>
                  <Text style={styles.menuItemTitle}>{item.title}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.gray400} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

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
    paddingTop: Spacing.lg,
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
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xl,
  },
  statCard: {
    width: '46%',
    paddingVertical: Spacing.xl,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: Spacing.md,
    marginHorizontal: '2%',
    marginBottom: Spacing.md,
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
  statTitle: {
    fontSize: Typography.base,
    fontFamily: Typography.fontMedium,
    color: Colors.textPrimary,
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
    marginTop: 4,
  },
});

export default DashboardScreen;