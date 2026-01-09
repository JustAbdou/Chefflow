import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, Typography } from '../../constants';
import { getAndroidTitleMargin } from '../../utils/responsive';
import useNavigationBar from '../../hooks/useNavigationBar';

const InvoiceDetailScreen = ({ route, navigation }) => {
  const { invoice } = route.params;

  // Hide Android navigation bar
  const navigationBar = useNavigationBar();
  navigationBar.useHidden();

  // Format date
  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backArrow}>‹</Text>
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Invoice Details</Text>
            <Text style={styles.subtitle}>{invoice.invoiceNumber}</Text>
          </View>
        </View>

        {/* Invoice Information Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Invoice Information</Text>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Invoice Number</Text>
            <Text style={styles.detailValue}>{invoice.invoiceNumber}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Date</Text>
            <Text style={styles.detailValue}>{formatDate(invoice.createdAt)}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Supplier</Text>
            <Text style={styles.detailValue}>{invoice.supplier || 'N/A'}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Amount</Text>
            <Text style={[styles.detailValue, styles.amountValue]}>£{invoice.amount}</Text>
          </View>

          {invoice.description && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Description</Text>
              <Text style={styles.detailValue}>{invoice.description}</Text>
            </View>
          )}

          {invoice.category && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Category</Text>
              <Text style={styles.detailValue}>{invoice.category}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundPrimary,
  },
  scrollView: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
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
  subtitle: {
    ...Typography.body,
    color: Colors.gray400,
    marginTop: 2,
  },
  card: {
    backgroundColor: Colors.gray100,
    borderRadius: 16,
    padding: Spacing.lg,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  cardTitle: {
    fontFamily: Typography.fontBold,
    fontSize: Typography.lg,
    color: Colors.textPrimary,
    fontWeight: 'bold',
    marginBottom: Spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray200,
  },
  detailLabel: {
    ...Typography.body,
    color: Colors.gray400,
    flex: 1,
  },
  detailValue: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  amountValue: {
    color: Colors.primary,
    fontWeight: 'bold',
    fontSize: Typography.lg,
  },
});

export default InvoiceDetailScreen;
