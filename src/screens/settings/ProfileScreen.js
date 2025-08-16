import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Alert, Linking } from "react-native"
import { Colors } from "../../constants/Colors"
import { Typography } from "../../constants/Typography"
import { Spacing } from "../../constants/Spacing"
import { scaleWidth, scaleHeight, scaleFont, getAndroidTitleMargin } from "../../utils/responsive"
import useNavigationBar from "../../hooks/useNavigationBar"
import { ProfileIcon } from "../../components/icons/ProfileIcon"
import { ChevronRightIcon } from "../../components/icons/NavigationIcons"
import { MaterialIcons } from '@expo/vector-icons'
import { signOut } from "firebase/auth"
import { auth } from "../../../firebase"
import { useNavigation } from "@react-navigation/native"
import { useRestaurant } from "../../contexts/RestaurantContext"
import { useState, useEffect } from "react"
import { doc, getDoc } from "firebase/firestore"
import { db } from "../../../firebase"

function ProfileScreen() {
  const navigation = useNavigation()
  const { restaurantId } = useRestaurant()
  const [userProfile, setUserProfile] = useState({
    name: "Chef",
    title: "Restaurant",
    fullName: ""
  })
  const [restaurantName, setRestaurantName] = useState("Restaurant")

  // Hide Android navigation bar
  const navigationBar = useNavigationBar();
  navigationBar.useHidden(); // Use hidden mode for complete immersion
  const [loading, setLoading] = useState(true)

  // Capitalize first letter of a string
  const capitalizeFirstLetter = (str) => {
    if (!str || typeof str !== 'string') return str
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
  }

  // Get first name from full name with proper capitalization
  const getFirstName = (fullName) => {
    if (!fullName || typeof fullName !== 'string') return "Chef"
    const firstName = fullName.trim().split(' ')[0]
    return firstName ? capitalizeFirstLetter(firstName) : "Chef"
  }

  // Capitalize title with proper formatting
  const formatTitle = (title) => {
    if (!title || typeof title !== 'string') return "Restaurant"
    return capitalizeFirstLetter(title)
  }

  // Fetch restaurant name from Firestore
  const fetchRestaurantName = async () => {
    if (!restaurantId) {
      setRestaurantName("Restaurant")
      return
    }

    try {
      console.log('🔍 Fetching restaurant name for:', restaurantId)
      
      const restaurantDocRef = doc(db, 'restaurants', restaurantId)
      const restaurantDoc = await getDoc(restaurantDocRef)

      if (restaurantDoc.exists()) {
        const restaurantData = restaurantDoc.data()
        const name = restaurantData.name || restaurantData.restaurantName || "Restaurant"
        console.log('🏪 Restaurant name:', name)
        setRestaurantName(name)
      } else {
        console.log('⚠️ Restaurant document not found')
        setRestaurantName("Restaurant")
      }
    } catch (error) {
      console.error('❌ Error fetching restaurant name:', error)
      setRestaurantName("Restaurant")
    }
  }

  // Fetch user profile from Firestore
  const fetchUserProfile = async () => {
    if (!auth.currentUser) {
      setLoading(false)
      return
    }

    try {
      console.log('🔍 Fetching user profile for:', auth.currentUser.uid)
      
      const userDocRef = doc(db, 'users', auth.currentUser.uid)
      const userDoc = await getDoc(userDocRef)

      if (userDoc.exists()) {
        const userData = userDoc.data()
        console.log('👤 User data:', userData)
        
        const fullName = userData.fullName || userData.name || userData.displayName || "Chef"
        const firstName = getFirstName(fullName)
        
        setUserProfile({
          name: firstName,
          title: restaurantName,
          fullName: fullName
        })
        
        console.log('✅ Profile updated - First name:', firstName, 'Restaurant:', restaurantName)
      } else {
        console.log('⚠️ User document not found, using defaults')
        // Fallback to auth user display name if available
        const authDisplayName = auth.currentUser.displayName
        if (authDisplayName) {
          const firstName = getFirstName(authDisplayName)
          setUserProfile(prev => ({
            ...prev,
            name: firstName,
            title: restaurantName,
            fullName: authDisplayName
          }))
        }
      }
    } catch (error) {
      console.error('❌ Error fetching user profile:', error)
      // Keep default values on error
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRestaurantName()
  }, [restaurantId])

  useEffect(() => {
    fetchUserProfile()
  }, [auth.currentUser, restaurantName])

  const profileData = userProfile

  const handleSignOut = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            try {
              await signOut(auth)
              navigation.replace('Login') // or your login screen name
            } catch (error) {
              console.error("Sign out error:", error)
            }
          }
        }
      ]
    )
  }

  const handlePrivacyPolicy = () => {
    Linking.openURL('https://chefflowapp.net/privacy-policy/')
      .catch(err => {
        console.error('Error opening privacy policy:', err)
        Alert.alert('Error', 'Unable to open privacy policy. Please check your internet connection.')
      })
  }

  const handleContactSupport = () => {
    Linking.openURL('mailto:contact@chefflowapp.net')
      .catch(err => {
        console.error('Error opening email:', err)
        Alert.alert('Error', 'Unable to open email app. Please check if you have an email app installed.')
      })
  }

  const menuItems = [
    {
      title: "Privacy & Security",
      onPress: handlePrivacyPolicy,
    },
    {
      title: "Help & Support",
      onPress: handleContactSupport,
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
        <View style={styles.headerRow}>
          <Text style={styles.title}>Profile</Text>
          <TouchableOpacity onPress={handleSignOut} style={styles.signOutButton}>
            <MaterialIcons name="logout" size={28} color="#E53935" />
          </TouchableOpacity>
        </View>

        {/* Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <ProfileIcon color="#FFFFFF" size={40} />
            </View>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {loading ? "Loading..." : profileData.name}
            </Text>
            <Text style={styles.profileTitle}>
              {loading ? "..." : restaurantName}
            </Text>
          </View>
        </View>

        {/* Menu Items */}
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl + getAndroidTitleMargin(),
    paddingBottom: Spacing.xl,
  },
  title: {
    fontSize: scaleFont(28),
    color: Colors.textPrimary,
    fontFamily: Typography.fontBold
  },
  signOutButton: {
    padding: scaleWidth(4),
    marginLeft: scaleWidth(12),
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
    width: scaleWidth(80),
    height: scaleWidth(80),
    borderRadius: scaleWidth(40),
    backgroundColor: "#007AFF",
    alignItems: "center",
    justifyContent: "center",
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: scaleFont(25),
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
    marginBottom: scaleHeight(4),
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
