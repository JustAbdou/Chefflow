import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Linking
} from 'react-native';
import { Colors } from '../../constants/Colors';
import { Typography } from '../../constants/Typography';
import { Spacing } from '../../constants/Spacing';
import { getAndroidTitleMargin } from '../../utils/responsive';
import useNavigationBar from '../../hooks/useNavigationBar';
import { useNavigation } from '@react-navigation/native';
import { useRestaurant } from '../../contexts/RestaurantContext';
import { collection, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import { getRestaurantCollection } from '../../utils/firestoreHelpers';
import { auth } from '../../../firebase';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
function PreviousHandoversScreen() {
  const navigation = useNavigation();
  const { restaurantId } = useRestaurant();
  const [handovers, setHandovers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigationBar = useNavigationBar();
  navigationBar.useHidden();
  const getCurrentDate = () => {
    const date = new Date();
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  };
  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown Date';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      if (isNaN(date.getTime())) {
        console.warn('Invalid date:', timestamp);
        return 'Invalid Date';
      }
      const options = { weekday: 'long', month: 'long', day: 'numeric' };
      return date.toLocaleDateString('en-US', options);
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Date Error';
    }
  };
  const fetchHandovers = async () => {
    if (!restaurantId || !auth.currentUser) {
      console.log('No restaurant ID or user available');
      setLoading(false);
      return;
    }
    try {
      console.log('🔍 Fetching handovers for user:', auth.currentUser.uid);
      console.log('🏪 Restaurant ID:', restaurantId);
      const handoversRef = getRestaurantCollection(restaurantId, 'handovers');
      const q = query(
        handoversRef,
        where('createdBy', '==', auth.currentUser.uid),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      console.log('📋 Executing Firestore query...');
      const querySnapshot = await getDocs(q);
      const handoversList = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        console.log('📄 Found handover:', doc.id, data);
        handoversList.push({
          id: doc.id,
          ...data
        });
      });
      console.log(`✅ Successfully fetched ${handoversList.length} handovers for user`);
      setHandovers(handoversList);
    } catch (error) {
      console.error('❌ Error fetching handovers:', error);
      if (error.code === 'failed-precondition' || error.message.includes('index')) {
        console.log('🔄 Trying fallback query without orderBy...');
        try {
          const handoversRef = getRestaurantCollection(restaurantId, 'handovers');
          const fallbackQuery = query(
            handoversRef,
            where('createdBy', '==', auth.currentUser.uid)
          );
          const querySnapshot = await getDocs(fallbackQuery);
          const handoversList = [];
          querySnapshot.forEach((doc) => {
            const data = doc.data();
            handoversList.push({
              id: doc.id,
              ...data
            });
          });
          handoversList.sort((a, b) => {
            const dateA = a.createdAt?.toDate() || new Date(0);
            const dateB = b.createdAt?.toDate() || new Date(0);
            return dateB - dateA;
          });
          console.log(`✅ Fallback query successful: ${handoversList.length} handovers`);
          setHandovers(handoversList);
        } catch (fallbackError) {
          console.error('❌ Fallback query also failed:', fallbackError);
          Alert.alert('Error', 'Failed to load previous handovers. Please try again.');
        }
      } else {
        Alert.alert('Error', 'Failed to load previous handovers. Please check your connection.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  useEffect(() => {
    console.log('🔄 PreviousHandoversScreen mounted, checking dependencies...');
    console.log('Restaurant ID:', restaurantId);
    console.log('User:', auth.currentUser?.uid);
    if (restaurantId && auth.currentUser) {
      fetchHandovers();
    } else {
      console.log('⏳ Waiting for restaurant ID and user authentication...');
      const timeout = setTimeout(() => {
        if (restaurantId && auth.currentUser) {
          fetchHandovers();
        } else {
          setLoading(false);
          console.log('⚠️ Dependencies not available after timeout');
        }
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [restaurantId, auth.currentUser]);
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHandovers();
  };
  const handleDownloadPDF = async (handover) => {
    try {
      console.log('📄 Attempting to download PDF for handover:', handover.id);
      if (handover.pdf && handover.pdf.trim() !== '') {
        console.log('Opening PDF:', handover.pdf);
        Alert.alert(
          'Download PDF',
          `Download handover from ${formatDate(handover.createdAt)}?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open in Browser',
              onPress: () => {
                if (handover.pdf.startsWith('http')) {
                  Linking.openURL(handover.pdf);
                } else {
                  Alert.alert('Invalid Link', 'This PDF link is not accessible.');
                }
              }
            },
            {
              text: 'Download to Device',
              onPress: async () => {
                try {
                  if (handover.pdf.startsWith('http')) {
                    const fileUri = FileSystem.documentDirectory + `handover_${handover.id}.pdf`;
                    const downloadResumable = FileSystem.createDownloadResumable(handover.pdf, fileUri);
                    const result = await downloadResumable.downloadAsync();
                    if (result) {
                      await Sharing.shareAsync(result.uri, { mimeType: 'application/pdf' });
                    }
                  } else {
                    Alert.alert('Invalid Link', 'This PDF link is not supported for download.');
                  }
                } catch (downloadError) {
                  console.error('Download error:', downloadError);
                  Alert.alert('Download Failed', 'Could not download the PDF.');
                }
              }
            }
          ]
        );
      } else {
        Alert.alert(
          'PDF Not Available',
          'PDF is not available for this handover. This might be an older handover created before PDF generation was implemented.',
          [
            { text: 'OK', style: 'default' }
          ]
        );
      }
    } catch (error) {
      console.error('Error handling PDF download:', error);
      Alert.alert('Error', 'Failed to process PDF request');
    }
  };
  const renderHandoverItem = (handover) => {
    const hasIssues = handover.problems || handover.stockIssues;
    const hasNotes = handover.serviceNotes;
    return (
      <TouchableOpacity
        key={handover.id}
        style={styles.handoverItem}
        onPress={() => handleDownloadPDF(handover)}
        activeOpacity={0.7}
      >
        <View style={styles.handoverInfo}>
          <Text style={styles.handoverDate}>{formatDate(handover.createdAt)}</Text>
          <View style={styles.statusContainer}>
            {hasNotes && (
              <View style={[styles.statusBadge, styles.notesBadge]}>
                <Text style={styles.statusBadgeText}>Notes</Text>
              </View>
            )}
            {handover.stockIssues && (
              <View style={[styles.statusBadge, styles.stockBadge]}>
                <Text style={styles.statusBadgeText}>Stock Issues</Text>
              </View>
            )}
            {handover.problems && (
              <View style={[styles.statusBadge, styles.problemsBadge]}>
                <Text style={styles.statusBadgeText}>Problems</Text>
              </View>
            )}
            {!hasIssues && !hasNotes && (
              <View style={[styles.statusBadge, styles.cleanBadge]}>
                <Text style={styles.statusBadgeText}>Clean Shift</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.downloadIcon}>
          <Text style={styles.downloadIconText}>↓</Text>
        </View>
      </TouchableOpacity>
    );
  };
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.titleContainer}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>‹</Text>
          </TouchableOpacity>
          <View style={styles.titleInfo}>
            <Text style={styles.title}>Previous Handovers</Text>
            <Text style={styles.date}>{getCurrentDate()}</Text>
          </View>
        </View>
        <View style={styles.handoversContainer}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Loading handovers...</Text>
            </View>
          ) : handovers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No previous handovers found</Text>
              <Text style={styles.emptySubtext}>Complete a handover to see it here</Text>
            </View>
          ) : (
            <>
              <Text style={styles.resultCount}>
                {handovers.length} handover{handovers.length !== 1 ? 's' : ''} found
              </Text>
              {handovers.map(renderHandoverItem)}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
    paddingTop: Spacing.xl + getAndroidTitleMargin(),
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
  titleInfo: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
  },
  date: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  handoversContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  handoverItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  handoverInfo: {
    flex: 1,
  },
  handoverDate: {
    fontSize: Typography.base,
    color: Colors.textPrimary,
    fontWeight: '500',
    marginBottom: Spacing.sm,
  },
  statusContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontSize: Typography.xs,
    fontWeight: '500',
    color: Colors.white,
  },
  notesBadge: {
    backgroundColor: Colors.primary,
  },
  stockBadge: {
    backgroundColor: Colors.warning,
  },
  problemsBadge: {
    backgroundColor: Colors.error,
  },
  cleanBadge: {
    backgroundColor: Colors.success,
  },
  downloadIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadIconText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  loadingText: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  loading: {
    marginTop: Spacing.xl,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyText: {
    fontSize: Typography.lg,
    color: Colors.textPrimary,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  emptySubtext: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  debugText: {
    fontSize: Typography.xs,
    color: Colors.textLight,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  resultCount: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    fontWeight: '500',
  },
});
export default PreviousHandoversScreen;
