import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from "react-native"
import { Colors } from "../../constants/Colors"
import { Typography } from "../../constants/Typography"
import { Spacing } from "../../constants/Spacing"
import { ProfileIcon } from "../../components/icons/ProfileIcon"
import { ChevronRightIcon } from "../../components/icons/NavigationIcons"

function ProfileScreen() {
  const profileData = {
    name: "Chef Marux",
    title: "Head Chef",
  }

  const menuItems = [
    {
      title: "Account Settings",
      onPress: () => console.log("Account Settings pressed"),
    },
    {
      title: "Privacy & Security",
      onPress: () => console.log("Privacy & Security pressed"),
    },
    {
      title: "Help & Support",
      onPress: () => console.log("Help & Support pressed"),
    },
  ]

  const renderMenuItem = (item, index) => (
    <TouchableOpacity key={index} style={styles.menuItem} onPress={item.onPress} activeOpacity={0.7}>
      <Text style={styles.menuItemTitle}>{item.title}</Text>
      <ChevronRightIcon color={Colors.gray400} size={20} />
    </TouchableOpacity>
  )

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
        </View>

        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <ProfileIcon color="#FFFFFF" size={40} />
            </View>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profileData.name}</Text>
            <Text style={styles.profileTitle}>{profileData.title}</Text>
          </View>
        </View>

        <View style={styles.menuContainer}>{menuItems.map(renderMenuItem)}</View>
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
    paddingBottom: Spacing.xl,
  },
  title: {
    fontSize: 28,
    color: Colors.textPrimary,
    fontFamily: Typography.fontBold    
  },
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  avatarContainer: {
    marginRight: Spacing.lg,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#007AFF",
    alignItems: "center",
    justifyContent: "center",
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 25,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  profileTitle: {
    fontSize: Typography.lg,
    fontFamily: Typography.fontRegular,
    opacity: 0.7,
    color: Colors.textSecondary,
  },
  menuContainer: {
    paddingHorizontal: Spacing.lg,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  menuItemTitle: {
    fontSize: Typography.base,
    fontFamily: Typography.fontMedium,
    color: Colors.textPrimary,
  },
})

export default ProfileScreen
