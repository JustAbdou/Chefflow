import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography } from '../../constants';
import { getAndroidTitleMargin } from '../../utils/responsive';
import useNavigationBar from '../../hooks/useNavigationBar';

const FoodSafetyMonitoringScreen = ({ navigation }) => {
  // Hide Android navigation bar
  const navigationBar = useNavigationBar();
  navigationBar.useHidden();

  const foodSafetyItems = [
    {
      title: 'Fridge Temperature',
      subtitle: 'Monitor and log fridge temps',
      icon: 'thermometer-outline',
      iconColor: Colors.primary,
      screen: 'FridgeTempLogs',
    },
    {
      title: 'Delivery Temperature',
      subtitle: 'Log and monitor delivery temps',
      icon: 'thermometer-outline',
      iconColor: Colors.primary,
      screen: 'DeliveryTempLogs',
    },
    {
      title: 'Cooking & Reheating',
      subtitle: 'Temperature safety logs',
      icon: 'flame',
      iconColor: Colors.primary,
      screen: 'CoolingAndReheating',
    },
    {
      title: 'Cooling',
      subtitle: 'Log cooling temperatures',
      icon: 'snow-outline',
      iconColor: Colors.primary,
      screen: 'Cooling',
    },
    {
      title: 'Sous Vide Cooking',
      subtitle: 'Log sous vide cooking',
      icon: 'restaurant-outline',
      iconColor: Colors.primary,
      screen: 'SousVide',
    },
    {
      title: 'Hot Holding',
      subtitle: 'Log hot holding temperatures',
      icon: 'flame-outline',
      iconColor: Colors.primary,
      screen: 'HotHolding',
    },
    {
      title: 'Shellfish Recording',
      subtitle: 'Record shellfish information',
      icon: 'fish-outline',
      iconColor: Colors.primary,
      screen: 'ShellfishRecording',
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backArrow}>‹</Text>
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.title}>Food Safety Monitoring</Text>
            <Text style={styles.subtitle}>Temperature control and safety logs</Text>
          </View>
        </View>

        {/* Food Safety Items List */}
        <View style={styles.itemsSection}>
          {foodSafetyItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.item}
              onPress={() => navigation.navigate(item.screen)}
            >
              <View style={styles.itemLeft}>
                <View style={styles.itemIcon}>
                  <Ionicons name={item.icon} size={24} color={item.iconColor} />
                </View>
                <View style={styles.itemContent}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.gray400} />
            </TouchableOpacity>
          ))}
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg + getAndroidTitleMargin(),
    paddingBottom: Spacing.md,
  },
  backButton: {
    padding: Spacing.xs,
    marginRight: Spacing.md,
  },
  backArrow: {
    fontSize: 32,
    color: Colors.textPrimary,
    fontWeight: '300',
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: Typography.fontRegular,
    color: Colors.textSecondary,
  },
  itemsSection: {
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.lg,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: Spacing.lg,
    marginHorizontal: '2%',
    marginBottom: Spacing.md,
    elevation: 2,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemIcon: {
    width: 40,
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: Typography.base,
    fontFamily: Typography.fontMedium,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  itemSubtitle: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontRegular,
    color: Colors.textSecondary,
    opacity: 0.7,
  },
});

export default FoodSafetyMonitoringScreen;

