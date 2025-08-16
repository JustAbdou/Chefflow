import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity
} from 'react-native';
import { Colors } from '../../constants/Colors';
import { Typography } from '../../constants/Typography';
import { Spacing } from '../../constants/Spacing';
import { useNavigation } from '@react-navigation/native';
function HandoverCompletionScreen({ route }) {
  const navigation = useNavigation();
  const { handoverData } = route.params || {};
  const getCurrentDateTime = () => {
    const date = new Date();
    const dateOptions = { weekday: 'long', month: 'long', day: 'numeric' };
    const timeOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
    const dateStr = date.toLocaleDateString('en-US', dateOptions);
    const timeStr = date.toLocaleTimeString('en-US', timeOptions);
    return { date: dateStr, time: timeStr };
  };
  const { date, time } = getCurrentDateTime();
  const handleBackToDashboard = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Main' }],
    });
  };
  const handleViewPreviousHandovers = () => {
    navigation.navigate('PreviousHandovers');
  };
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <Text style={styles.title}>Handover Complete</Text>
        </View>
      </View>
      <View style={styles.content}>
        <View style={styles.messageContainer}>
          <Text style={styles.successTitle}>Handover Submitted Successfully!</Text>
          <Text style={styles.successSubtitle}>
            Your handover has been recorded and is now available for the next shift. A PDF report has been generated and will be available for download shortly.
          </Text>
        </View>
        <View style={styles.infoContainer}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Date</Text>
            <Text style={styles.infoValue}>{date}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Time Submitted</Text>
            <Text style={styles.infoValue}>{time}</Text>
          </View>
        </View>
        {handoverData && (
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryTitle}>Handover Summary</Text>
            <View style={styles.summaryItems}>
              <View style={styles.summaryItem}>
                <View style={[styles.summaryIcon, {
                  backgroundColor: handoverData.serviceNotes ? Colors.success : Colors.gray200
                }]}>
                  <Text style={styles.summaryIconText}>📝</Text>
                </View>
                <Text style={styles.summaryText}>Service Notes</Text>
                <Text style={[styles.summaryStatus, {
                  color: handoverData.serviceNotes ? Colors.success : Colors.gray400
                }]}>
                  {handoverData.serviceNotes ? 'Included' : 'None'}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <View style={[styles.summaryIcon, {
                  backgroundColor: handoverData.stockIssues ? Colors.warning : Colors.gray200
                }]}>
                  <Text style={styles.summaryIconText}>📦</Text>
                </View>
                <Text style={styles.summaryText}>Stock Issues</Text>
                <Text style={[styles.summaryStatus, {
                  color: handoverData.stockIssues ? Colors.warning : Colors.gray400
                }]}>
                  {handoverData.stockIssues ? 'Reported' : 'None'}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <View style={[styles.summaryIcon, {
                  backgroundColor: handoverData.problems ? Colors.error : Colors.gray200
                }]}>
                  <Text style={styles.summaryIconText}>⚠️</Text>
                </View>
                <Text style={styles.summaryText}>Problems</Text>
                <Text style={[styles.summaryStatus, {
                  color: handoverData.problems ? Colors.error : Colors.gray400
                }]}>
                  {handoverData.problems ? 'Reported' : 'None'}
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>
      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleViewPreviousHandovers}
        >
          <Text style={styles.secondaryButtonText}>View Previous Handovers</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleBackToDashboard}
        >
          <Text style={styles.primaryButtonText}>Back to Dashboard</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  backButton: {
    padding: Spacing.sm,
    marginRight: Spacing.sm,
  },
  backButtonText: {
    fontSize: 32,
    color: Colors.textPrimary,
    fontWeight: '300',
  },
  headerTitle: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIconContainer: {
    padding: Spacing.lg,
    marginBottom: Spacing.xxl,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.success,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  checkmark: {
    fontSize: 40,
    color: Colors.white,
    fontWeight: 'bold',
  },
  messageContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  successTitle: {
    fontSize: Typography.xl,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  successSubtitle: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  infoContainer: {
    width: '100%',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  infoLabel: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
  },
  infoValue: {
    fontSize: Typography.base,
    fontFamily: Typography.fontSemiBold,
    color: Colors.textPrimary,
  },
  summaryContainer: {
    width: '100%',
    marginBottom: Spacing.xl,
  },
  summaryTitle: {
    fontSize: Typography.lg,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  summaryItems: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  summaryIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  summaryIconText: {
    fontSize: 16,
  },
  summaryText: {
    flex: 1,
    fontSize: Typography.base,
    color: Colors.textPrimary,
  },
  summaryStatus: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontSemiBold,
  },
  bottomActions: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  secondaryButton: {
    backgroundColor: Colors.white,
    paddingVertical: Spacing.lg,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryButtonText: {
    color: Colors.textPrimary,
    fontSize: Typography.base,
    fontFamily: Typography.fontSemiBold,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.lg,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButtonText: {
    color: Colors.white,
    fontSize: Typography.lg,
    fontFamily: Typography.fontBold,
  },
});
export default HandoverCompletionScreen;
