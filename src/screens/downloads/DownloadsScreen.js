import React from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../constants/Colors";
import { Typography } from "../../constants/Typography";
import { Spacing } from "../../constants/Spacing";
import { getAndroidTitleMargin } from "../../utils/responsive";
import useNavigationBar from "../../hooks/useNavigationBar";

export default function DownloadsScreen({ navigation }) {
  // Hide Android navigation bar
  const navigationBar = useNavigationBar();
  navigationBar.useHidden();

  const downloadSections = [
    {
      title: "Temperature Records",
      icon: "thermometer-outline",
      screen: "TemperatureRecords",
      description: "Download fridge and delivery temperature logs",
    },
    {
      title: "Invoices",
      icon: "document-text-outline",
      screen: "InvoicesDownloads",
      description: "Download and manage restaurant invoices",
    },
    {
      title: "Shift Handovers",
      icon: "people-outline",
      screen: "PreviousHandovers",
      description: "View and download shift handover records",
    },
  ];

  const handleNavigation = (screenName) => {
    navigation.navigate(screenName);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.backHeader}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
              <Text style={styles.backArrow}>‹</Text>
            </TouchableOpacity>
            <View style={styles.titleContainer}>
              <Text style={styles.title}>Downloads</Text>
            </View>
          </View>
        </View>

        {/* Downloadable Sections */}
        <View style={styles.sectionsContainer}>
          {downloadSections.map((section, index) => (
            <TouchableOpacity
              key={index}
              style={styles.sectionCard}
              onPress={() => handleNavigation(section.screen)}
              activeOpacity={0.8}
            >
              <View style={styles.sectionIcon}>
                <Ionicons name={section.icon} size={24} color={Colors.primary} />
              </View>
              <View style={styles.sectionContent}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionDescription}>{section.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.gray400} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  backHeader: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    width: "100%",
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
  titleContainer: { flex: 1 },
  title: {
    fontSize: 22,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
  },
  sectionsContainer: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
  },
  sectionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.primary + "20",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  sectionContent: {
    flex: 1,
  },
  sectionTitle: {
    fontFamily: Typography.fontBold,
    fontSize: 18,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  sectionDescription: {
    fontFamily: Typography.fontRegular,
    fontSize: 16,
    color: Colors.textSecondary,
  },
});
