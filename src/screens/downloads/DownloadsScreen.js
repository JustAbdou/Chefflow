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

const DownloadsScreen = ({ navigation }) => {
  // Hide Android navigation bar
  const navigationBar = useNavigationBar();
  navigationBar.useHidden();

  const downloadItems = [
    {
      title: 'Temperature Records',
      subtitle: 'Download temperature logs and reports',
      icon: 'thermometer-outline',
      iconColor: Colors.primary,
      screen: 'TemperatureRecords',
    },
    {
      title: 'Invoices',
      subtitle: 'Download and manage invoices',
      icon: 'document-text-outline',
      iconColor: Colors.primary,
      screen: 'InvoicesDownloads',
    },
    {
      title: 'Shift Handovers',
      subtitle: 'Download handover reports',
      icon: 'people-outline',
      iconColor: Colors.primary,
      screen: 'PreviousHandovers',
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Downloads</Text>
          <Text style={styles.subtitle}>Access your reports and documents</Text>
        </View>

        {/* Downloads List */}
        <View style={styles.downloadsSection}>
          {downloadItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.downloadItem}
              onPress={() => navigation.navigate(item.screen)}
            >
              <View style={styles.downloadItemLeft}>
                <View style={styles.downloadItemIcon}>
                  <Ionicons name={item.icon} size={24} color={item.iconColor} />
                </View>
                <View style={styles.downloadItemContent}>
                  <Text style={styles.downloadItemTitle}>{item.title}</Text>
                  <Text style={styles.downloadItemSubtitle}>{item.subtitle}</Text>
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
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg + getAndroidTitleMargin(),
    paddingBottom: Spacing.md,
  },
  title: {
    fontSize: Typography.xxl,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: Typography.base,
    fontFamily: Typography.fontRegular,
    color: Colors.textSecondary,
  },
  downloadsSection: {
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.lg,
  },
  downloadItem: {
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
  downloadItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  downloadItemIcon: {
    width: 40,
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  downloadItemContent: {
    flex: 1,
  },
  downloadItemTitle: {
    fontSize: Typography.base,
    fontFamily: Typography.fontMedium,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  downloadItemSubtitle: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontRegular,
    color: Colors.textSecondary,
    opacity: 0.7,
  },
});

export default DownloadsScreen;
