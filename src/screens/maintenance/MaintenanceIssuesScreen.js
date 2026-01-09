import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getDocs, addDoc, updateDoc, doc, query, orderBy, Timestamp } from "firebase/firestore";
import { useRestaurant } from "../../contexts/RestaurantContext";
import { getRestaurantCollection } from "../../utils/firestoreHelpers";
import { auth } from "../../../firebase";
import AddMaintenanceIssueModal from "./AddMaintenanceIssueModal";

import { Colors } from "../../constants/Colors";
import { Typography } from "../../constants/Typography";
import { Spacing } from "../../constants/Spacing";
import { getAndroidTitleMargin } from "../../utils/responsive";
import useNavigationBar from "../../hooks/useNavigationBar";

export default function MaintenanceIssuesScreen({ navigation }) {
  const { restaurantId } = useRestaurant();
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Hide Android navigation bar
  const navigationBar = useNavigationBar();
  navigationBar.useHidden();

  // Fetch issues from maintenanceissues collection
  const fetchIssues = async () => {
    if (!restaurantId) return;

    try {
      console.log('🔍 Fetching maintenance issues for restaurant:', restaurantId);

      const issuesCollection = getRestaurantCollection(restaurantId, 'maintenanceissues');
      const q = query(issuesCollection, orderBy("createdAt", "desc"));
      const issuesSnapshot = await getDocs(q);

      let allIssues = [];
      issuesSnapshot.forEach(docSnap => {
        const data = docSnap.data();
        allIssues.push({
          id: docSnap.id,
          ...data,
        });
      });

      console.log('📋 Fetched maintenance issues:', allIssues.length);
      setIssues(allIssues);
    } catch (error) {
      console.error('❌ Error fetching maintenance issues:', error);
      Alert.alert('Error', 'Failed to load maintenance issues');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, [restaurantId]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchIssues();
  };

  const handleAddIssue = async (issueData) => {
    try {
      const issuesCollection = getRestaurantCollection(restaurantId, 'maintenanceissues');
      
      await addDoc(issuesCollection, {
        ...issueData,
        createdAt: Timestamp.now(),
        loggedBy: {
          userId: auth.currentUser.uid,
          email: auth.currentUser.email
        }
      });

      console.log('✅ Maintenance issue saved successfully');
      setShowAddModal(false);
      fetchIssues();
    } catch (error) {
      console.error('❌ Error saving maintenance issue:', error);
      Alert.alert('Error', 'Failed to save maintenance issue');
    }
  };

  const handleMarkResolved = async (issueId) => {
    try {
      const issuesCollection = getRestaurantCollection(restaurantId, 'maintenanceissues');
      await updateDoc(doc(issuesCollection, issueId), {
        status: 'Resolved',
        resolvedAt: Timestamp.now(),
      });
      fetchIssues();
    } catch (error) {
      console.error('❌ Error updating issue:', error);
      Alert.alert('Error', 'Failed to update issue');
    }
  };

  const handleMarkUnresolved = async (issueId) => {
    try {
      const issuesCollection = getRestaurantCollection(restaurantId, 'maintenanceissues');
      await updateDoc(doc(issuesCollection, issueId), {
        status: 'Open',
        resolvedAt: null,
      });
      fetchIssues();
    } catch (error) {
      console.error('❌ Error updating issue:', error);
      Alert.alert('Error', 'Failed to update issue');
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate?.() || new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate?.() || new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Resolved':
        return '#22c55e';
      case 'In Progress':
        return '#f59e0b';
      case 'Open':
      default:
        return '#ef4444';
    }
  };

  const getStatusBgColor = (status) => {
    switch (status) {
      case 'Resolved':
        return '#f0fdf4';
      case 'In Progress':
        return '#fffbeb';
      case 'Open':
      default:
        return '#fef2f2';
    }
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case 'Maintenance':
        return '#3b82f6';
      case 'Equipment':
        return '#8b5cf6';
      case 'Incident':
        return '#ef4444';
      default:
        return Colors.textSecondary;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading issues...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const openIssues = issues.filter(issue => issue.status !== 'Resolved');
  const resolvedIssues = issues.filter(issue => issue.status === 'Resolved');

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Maintenance and Incidents</Text>
          <Text style={styles.subtitle}>Track and manage issues</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Add New Issue Section */}
        <View style={styles.addIssueSection}>
          <TouchableOpacity style={styles.addIssueCard} onPress={() => setShowAddModal(true)}>
            <Ionicons name="add-circle" size={24} color={Colors.primary} />
            <Text style={styles.addIssueText}>Log an Issue</Text>
          </TouchableOpacity>
        </View>

        {/* Open Issues */}
        <View style={styles.issuesSection}>
          <Text style={styles.sectionTitle}>Open Issues ({openIssues.length})</Text>
          
          {openIssues.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-circle-outline" size={48} color={Colors.textSecondary} />
              <Text style={styles.emptyText}>No open issues</Text>
              <Text style={styles.emptySubtext}>
                All issues have been resolved
              </Text>
            </View>
          ) : (
            openIssues.map((issue) => (
              <View key={issue.id} style={styles.issueCard}>
                <View style={styles.issueHeader}>
                  <View style={styles.issueInfo}>
                    <View style={styles.issueTitleRow}>
                      <Text style={styles.issueTitle}>{issue.title}</Text>
                      <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(issue.category) + '20' }]}>
                        <Text style={[styles.categoryText, { color: getCategoryColor(issue.category) }]}>
                          {issue.category}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.issueTime}>
                      {formatDate(issue.createdAt)} at {formatTime(issue.createdAt)}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusBgColor(issue.status) }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(issue.status) }]}>
                      {issue.status || 'Open'}
                    </Text>
                  </View>
                </View>
                {issue.description && (
                  <Text style={styles.issueDescription}>{issue.description}</Text>
                )}
                {issue.status !== 'Resolved' && (
                  <TouchableOpacity
                    style={styles.resolveButton}
                    onPress={() => handleMarkResolved(issue.id)}
                  >
                    <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                    <Text style={styles.resolveButtonText}>Mark as Resolved</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </View>

        {/* Resolved Issues */}
        {resolvedIssues.length > 0 && (
          <View style={styles.issuesSection}>
            <Text style={styles.sectionTitle}>Resolved Issues ({resolvedIssues.length})</Text>
            {resolvedIssues.map((issue) => (
              <View key={issue.id} style={[styles.issueCard, styles.resolvedCard]}>
                <View style={styles.issueHeader}>
                  <View style={styles.issueInfo}>
                    <View style={styles.issueTitleRow}>
                      <Text style={[styles.issueTitle, styles.resolvedTitle]}>{issue.title}</Text>
                      <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(issue.category) + '20' }]}>
                        <Text style={[styles.categoryText, { color: getCategoryColor(issue.category) }]}>
                          {issue.category}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.issueTime}>
                      {formatDate(issue.createdAt)} at {formatTime(issue.createdAt)}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusBgColor(issue.status) }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(issue.status) }]}>
                      {issue.status}
                    </Text>
                  </View>
                </View>
                {issue.description && (
                  <Text style={[styles.issueDescription, styles.resolvedDescription]}>{issue.description}</Text>
                )}
                <TouchableOpacity
                  style={styles.unresolveButton}
                  onPress={() => handleMarkUnresolved(issue.id)}
                >
                  <Ionicons name="refresh-outline" size={16} color={Colors.textSecondary} />
                  <Text style={styles.unresolveButtonText}>Mark as Unresolved</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Add Issue Modal */}
      <AddMaintenanceIssueModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddIssue}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
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
    fontWeight: "300",
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
  scrollView: {
    flex: 1,
  },
  addIssueSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  addIssueCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e2e8f0",
    borderStyle: "dashed",
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  addIssueText: {
    fontSize: 16,
    fontFamily: Typography.fontMedium,
    color: Colors.primary,
    marginLeft: Spacing.sm,
  },
  issuesSection: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: Typography.fontSemiBold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  issueCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: Spacing.md,
  },
  resolvedCard: {
    opacity: 0.7,
  },
  issueHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
  issueInfo: {
    flex: 1,
  },
  issueTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    flexWrap: "wrap",
  },
  issueTitle: {
    fontSize: 16,
    fontFamily: Typography.fontSemiBold,
    color: Colors.textPrimary,
    marginRight: Spacing.sm,
    flex: 1,
  },
  resolvedTitle: {
    textDecorationLine: "line-through",
    color: Colors.textSecondary,
  },
  issueTime: {
    fontSize: 14,
    fontFamily: Typography.fontRegular,
    color: Colors.textSecondary,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryText: {
    fontSize: 12,
    fontFamily: Typography.fontMedium,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontFamily: Typography.fontSemiBold,
  },
  issueDescription: {
    fontSize: 14,
    fontFamily: Typography.fontRegular,
    color: Colors.textPrimary,
    marginTop: Spacing.sm,
    lineHeight: 20,
  },
  resolvedDescription: {
    color: Colors.textSecondary,
  },
  resolveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0fdf4",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: "#22c55e",
  },
  resolveButtonText: {
    fontSize: 14,
    fontFamily: Typography.fontMedium,
    color: "#22c55e",
    marginLeft: 6,
  },
  unresolveButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: Spacing.sm,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  unresolveButtonText: {
    fontSize: 13,
    fontFamily: Typography.fontRegular,
    color: Colors.textSecondary,
    marginLeft: 4,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontFamily: Typography.fontSemiBold,
    color: Colors.textPrimary,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: Typography.fontRegular,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
});

