"use client"
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView } from "react-native"
import { Colors } from "../../constants/Colors"
import { Typography } from "../../constants/Typography"
import { Spacing } from "../../constants/Spacing"
import { ClipboardIcon, ChevronRightIcon } from "../../components/icons/NavigationIcons"

function TasksScreen({ navigation }) {
  const menuItems = [
    {
      title: "Prep List",
      subtitle: "View and manage today's prep tasks",
      icon: ClipboardIcon,
      iconColor: Colors.primary,
    },
    {
      title: "Order List",
      subtitle: "Check and update order items",
      icon: ClipboardIcon,
      iconColor: Colors.primary,
    },
    {
      title: "Fridge Temperature",
      subtitle: "Log and monitor fridge temps",
      icon: ClipboardIcon,
      iconColor: Colors.primary,
    },
    {
      title: "Delivery Temperature",
      subtitle: "Record delivery temperature",
      icon: ClipboardIcon,
      iconColor: Colors.primary,
    },
  ]

  const renderMenuItem = (item, idx) => (
    <TouchableOpacity
      key={item.title}
      style={styles.menuItem}
      activeOpacity={0.7}
    >
      <View style={styles.menuItemLeft}>
        <View style={styles.menuItemIcon}>
          <item.icon color={item.iconColor} size={28} />
        </View>
        <View>
          <Text style={styles.menuItemTitle}>{item.title}</Text>
          <Text style={styles.menuItemSubtitle}>{item.subtitle}</Text>
        </View>
      </View>
      <ChevronRightIcon color={Colors.gray400} size={20} />
    </TouchableOpacity>
  )

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Tasks</Text>
        </View>
        <View style={styles.menuContainer}>
          {menuItems.map(renderMenuItem)}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
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
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  menuContainer: {
    paddingHorizontal: Spacing.lg,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    elevation: 2,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  menuItemIcon: {
    width: 40,
    alignItems: "center",
    marginRight: Spacing.md,
  },
  menuItemTitle: {
    fontSize: Typography.base,
    fontWeight: "bold",
    color: Colors.textPrimary,
  },
  menuItemSubtitle: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    opacity: 0.7,
    marginTop: 4,
  },
})

export default TasksScreen
